import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "../test/server";
import { TokenGate } from "../components/TokenGate";
import { Dashboard, DashboardErrorBoundary } from "./Dashboard";

const base = "http://localhost:3100/api";
const timestamp = new Date(Date.now() - 12 * 60000).toISOString();
const metrics = {
  window: "7d" as const,
  generatedAt: timestamp,
  deploymentFrequency: { total: 7, perDay: Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, count: index === 2 ? 2 : 1 })) },
  changeFailureRate: { value: 0.1, failed: 1, total: 10 },
  mttr: { medianSeconds: 1800, p90Seconds: 3600, resolvedCount: 2 },
  openIncidents: []
};
const run = { id: 42, environment: "production", state: "success", startedAt: timestamp, updatedAt: new Date().toISOString(), sha: "abc123456789" };

function installDashboardHandlers() {
  server.use(
    http.get(`${base}/repos`, () => HttpResponse.json([{ id: 1, fullName: "acme/api", productionEnvironment: "production" }])),
    http.get(`${base}/repos/:id/metrics`, () => HttpResponse.json(metrics)),
    http.get(`${base}/repos/:id/incidents`, () => HttpResponse.json({ data: [], nextCursor: null })),
    http.get(`${base}/repos/:id/runs`, () => HttpResponse.json({ data: [run], nextCursor: null }))
  );
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, refetchInterval: false } } });
  const result = render(<QueryClientProvider client={client}><Dashboard /></QueryClientProvider>);
  return { ...result, client };
}

beforeEach(() => {
  sessionStorage.setItem("shipwatch.dashboardToken", "test-token");
  vi.stubEnv("VITE_API_URL", "http://localhost:3100");
  installDashboardHandlers();
});
afterEach(() => vi.unstubAllEnvs());

describe("dashboard states", () => {
  it("keeps the final layout footprint while loading", async () => {
    server.use(http.get(`${base}/repos`, async () => { await delay(100); return HttpResponse.json([]); }));
    renderDashboard();
    expect(screen.getByRole("status", { name: "Loading dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("Your delivery data will appear here")).toBeInTheDocument();
  });

  it("renders metrics, live status, accessible chart table toggle, and runs", async () => {
    const user = userEvent.setup();
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Production overview" })).toBeInTheDocument();
    expect(screen.getByText("All clear")).toBeInTheDocument();
    expect(screen.getByText("1.0 / day")).toBeInTheDocument();
    expect(screen.getByText("10.0%")).toBeInTheDocument();
    expect(screen.getByText("30m")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "View as table" }, { timeout: 5000 }));
    expect(screen.getByRole("table", { name: "Successful deployments by UTC day" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "UTC date" })).toHaveAttribute("scope", "col");
    expect(screen.getAllByText("abc1234")).toHaveLength(2);
  });

  it("keeps last metrics visible and announces stale data after a failed refresh", async () => {
    const { client } = renderDashboard();
    expect(await screen.findByRole("heading", { name: "Production overview" })).toBeInTheDocument();
    server.use(http.get(`${base}/repos/:id/metrics`, () => HttpResponse.json({ error: "unavailable" }, { status: 503 })));
    await client.refetchQueries({ queryKey: ["metrics"] });
    expect(await screen.findByText(/Showing data from .* ago, reconnecting…/)).toBeInTheDocument();
    expect(screen.getByText("10.0%")).toBeInTheDocument();
  });

  it("shows a retry action for an initial service error", async () => {
    let requestCount = 0;
    server.use(http.get(`${base}/repos/:id/metrics`, () => {
      requestCount += 1;
      return requestCount === 1 ? HttpResponse.json({ error: "unavailable" }, { status: 503 }) : HttpResponse.json(metrics);
    }));
    const user = userEvent.setup();
    renderDashboard();
    expect(await screen.findByText("Unable to refresh dashboard data")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Production overview" })).toBeInTheDocument();
  });

  it("prompts again with an error when the dashboard token is rejected", async () => {
    server.use(http.get(`${base}/repos`, () => HttpResponse.json({ error: "Unauthorized" }, { status: 401 })));
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Connect your dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("That token was not accepted");
  });

  it("renders configuration guidance for an invalid API URL", async () => {
    vi.stubEnv("VITE_API_URL", "not-a-url");
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Check the API endpoint" })).toBeInTheDocument();
  });

  it("shows friendly webhook guidance when no repository is connected", async () => {
    server.use(http.get(`${base}/repos`, () => HttpResponse.json([])));
    renderDashboard();
    expect(await screen.findByText("Your delivery data will appear here")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:3100/api/webhooks/github")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders explicit em dashes and no-data labels for empty metrics", async () => {
    server.use(
      http.get(`${base}/repos/:id/metrics`, () => HttpResponse.json({ ...metrics, deploymentFrequency: { total: 0, perDay: metrics.deploymentFrequency.perDay.map((day) => ({ ...day, count: 0 })) }, changeFailureRate: { value: null, failed: 0, total: 0 }, mttr: { medianSeconds: null, p90Seconds: null, resolvedCount: 0 } })),
      http.get(`${base}/repos/:id/runs`, () => HttpResponse.json({ data: [], nextCursor: null }))
    );
    renderDashboard();
    expect(await screen.findAllByText("No data in this window", { selector: "p" })).toHaveLength(3);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(await screen.findByText("No deployment runs in this window.")).toBeInTheDocument();
    expect(await screen.findByText("Your delivery data will appear here")).toBeInTheDocument();
  });

  it("contains rendering failures behind the page boundary", () => {
    function BrokenChild(): never { throw new Error("render failure"); }
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<DashboardErrorBoundary><BrokenChild /></DashboardErrorBoundary>);
    expect(screen.getByRole("heading", { name: "Dashboard paused" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it("does not put tokens into navigation when submitting the gate", async () => {
    sessionStorage.removeItem("shipwatch.dashboardToken");
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<TokenGate unauthorized={false} onSaved={onSaved} />);
    await user.type(screen.getByLabelText("Read token"), "short-lived-token");
    await user.click(screen.getByRole("button", { name: "Open dashboard" }));
    expect(sessionStorage.getItem("shipwatch.dashboardToken")).toBe("short-lived-token");
    expect(onSaved).toHaveBeenCalledOnce();
    expect(window.location.search).toBe("");
  });
});
