import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "default",
  children,
}: {
  className?: string;
  tone?: "default" | "cloth" | "good" | "stamp" | "warn";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
        tone === "default" && "bg-elevated text-muted border border-rule",
        tone === "cloth" && "bg-cloth text-cloth-fg",
        tone === "good" && "bg-good text-good-fg",
        tone === "stamp" && "bg-stamp text-stamp-fg",
        tone === "warn" && "bg-warn text-elevated",
        className,
      )}
    >
      {children}
    </span>
  );
}
