import { ean13SvgPath } from "@/lib/ean13";
import { formatIsbnDisplay } from "@/lib/isbn";
import { cn } from "@/lib/utils";

export function EanMark({
  isbn13,
  className,
}: {
  isbn13: string;
  className?: string;
}) {
  const path = ean13SvgPath(isbn13, 2, 64);
  if (!path) {
    return <p className="font-mono text-sm text-muted">{isbn13}</p>;
  }
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <svg
        viewBox={`0 0 ${path.width} ${path.height}`}
        className="h-16 w-full max-w-sm text-ink"
        role="img"
        aria-label={`ISBN ${isbn13}`}
      >
        <rect width={path.width} height={path.height} fill="var(--color-elevated)" />
        <path d={path.d} fill="currentColor" />
      </svg>
      <p className="font-mono text-sm tracking-wide text-ink">{formatIsbnDisplay(isbn13)}</p>
    </div>
  );
}
