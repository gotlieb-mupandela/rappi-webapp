/** @deprecated Silhouette placeholders removed — keep empty plate only. */
export function ProductVisual({
  className,
}: {
  product?: unknown;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{ background: "var(--bg-elevated)" }}
      aria-hidden
    />
  );
}
