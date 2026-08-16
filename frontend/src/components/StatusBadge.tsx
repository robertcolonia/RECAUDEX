export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll("_", "-");
  const label = value.replaceAll("_", " ");
  return <span className={`status status-${normalized}`}>{label}</span>;
}

