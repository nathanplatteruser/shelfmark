import { channelBySlug, type ChannelListing, type ListingStatus } from "@/lib/channels";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<ListingStatus, string> = {
  queued: "queued",
  live: "live",
  sold: "sold",
  delisting: "pulling",
  ended: "ended",
  failed: "failed",
};

function tone(status: ListingStatus): string {
  if (status === "live") return "border-good/40 bg-good text-good-fg";
  if (status === "sold") return "border-stamp/40 bg-stamp text-stamp-fg";
  if (status === "ended" || status === "delisting") return "border-rule bg-paper text-subtle line-through";
  if (status === "failed") return "border-stamp/30 bg-elevated text-stamp";
  return "border-rule bg-elevated text-muted";
}

export function ChannelPills({
  listings,
  className,
}: {
  listings: ChannelListing[];
  className?: string;
}) {
  if (listings.length === 0) {
    return <span className="text-xs text-subtle">Not on a shelf yet</span>;
  }
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {listings.map((l) => {
        const ch = channelBySlug(l.channelSlug);
        return (
          <span
            key={l.id}
            title={`${ch?.name ?? l.channelSlug} · ${STATUS_LABEL[l.status]}`}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] uppercase tracking-[0.12em]",
              tone(l.status),
            )}
          >
            <span className="font-medium tracking-[0.08em]">{ch?.mark ?? l.channelSlug}</span>
            <span className="font-sans tracking-normal normal-case opacity-80">{STATUS_LABEL[l.status]}</span>
          </span>
        );
      })}
    </div>
  );
}

export function ChannelMark({ slug, dim }: { slug: string; dim?: boolean }) {
  const ch = channelBySlug(slug);
  return (
    <span
      className={cn(
        "inline-grid size-7 place-items-center rounded-sm text-[10px] font-semibold tracking-[0.12em]",
        dim ? "bg-paper text-subtle border border-rule" : "bg-cloth text-cloth-fg",
      )}
    >
      {ch?.mark ?? (slug ? slug.slice(0, 2).toUpperCase() : "SM")}
    </span>
  );
}
