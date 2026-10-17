import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

globalThis.ResizeObserver = class ResizeObserverMock implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element): void {
    const entry: ResizeObserverEntry = {
      target,
      contentRect: new DOMRect(0, 0, 600, 256),
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: []
    };
    this.callback([entry], this);
  }
  unobserve(): void {}
  disconnect(): void {}
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());
