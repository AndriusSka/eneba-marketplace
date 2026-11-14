/** DESIGN.md › Smaller pieces › Skeletons: `surface` blocks with animate-pulse. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-sm bg-surface ${className}`} />
}
