type StatusChipProps = { status: string };

const statusDetails: Record<string, { label: string; icon: string; tone: string }> = {
  success: { label: "Succeeded", icon: "✓", tone: "border-success/40 bg-success/10 text-success" },
  resolved: { label: "Resolved", icon: "✓", tone: "border-success/40 bg-success/10 text-success" },
  failure: { label: "Failed", icon: "×", tone: "border-danger/40 bg-danger/10 text-danger" },
  error: { label: "Error", icon: "!", tone: "border-danger/40 bg-danger/10 text-danger" },
  open: { label: "Open", icon: "!", tone: "border-danger/40 bg-danger/10 text-danger" },
  in_progress: { label: "In progress", icon: "◷", tone: "border-warning/40 bg-warning/10 text-warning" },
  queued: { label: "Queued", icon: "◷", tone: "border-warning/40 bg-warning/10 text-warning" }
};

export function StatusChip({ status }: StatusChipProps) {
  const detail = statusDetails[status.toLowerCase()] ?? { label: status.replaceAll("_", " "), icon: "•", tone: "border-border bg-raised text-muted" };
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1 text-xs font-medium capitalize ${detail.tone}`}><span aria-hidden="true">{detail.icon}</span>{detail.label}</span>;
}
