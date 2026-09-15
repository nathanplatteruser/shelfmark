import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-rule bg-elevated shadow-[var(--shadow-ticket)]",
        className,
      )}
      {...props}
    />
  );
}
