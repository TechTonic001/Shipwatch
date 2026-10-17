type Repo = { id: number; fullName: string };

export function RepoSelect({ repos, value, onChange }: { repos: Repo[]; value: number; onChange: (id: number) => void }) {
  return <label className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm">
    <span aria-hidden="true" className="text-muted">⌘</span>
    <span className="sr-only">Repository</span>
    <select aria-label="Repository" className="max-w-48 bg-transparent text-text" value={value} onChange={(event) => onChange(Number(event.target.value))}>{repos.map((repo) => <option key={repo.id} value={repo.id}>{repo.fullName}</option>)}</select>
  </label>;
}
