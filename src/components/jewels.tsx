import { Timer, TrendingUp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { money, type BookTicket, type ChannelLine, type JewelKind } from "@/lib/cashflow";
import { cn } from "@/lib/utils";

const JEWEL_META: { kind: JewelKind; label: string; hint: string; icon: typeof TrendingUp }[] = [
  { kind: "perDay", label: "The jewel", hint: "Highest net per day", icon: TrendingUp },
  { kind: "mostMoney", label: "Most money", hint: "Highest net, ignore speed", icon: Wallet },
  { kind: "fastest", label: "Sells first", hint: "Fastest shelf, even at a loss", icon: Timer },
];

function lineFor(ticket: BookTicket, kind: JewelKind): ChannelLine {
  if (kind === "mostMoney") return ticket.jewels.mostMoney;
  if (kind === "fastest") return ticket.jewels.fastest;
  return ticket.jewels.perDay;
}

function valueFor(line: ChannelLine, kind: JewelKind): string {
  if (kind === "mostMoney") return money(line.net);
  if (kind === "fastest") return `~${line.days}d`;
  return `${money(line.netPerDay)}/d`;
}

export function JewelsCard({
  ticket,
  compact = false,
}: {
  ticket: BookTicket;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      {compact ? (
        <Card className="divide-y divide-rule p-0">
          {JEWEL_META.map((meta) => {
            const line = lineFor(ticket, meta.kind);
            const Icon = meta.icon;
            const jewel = meta.kind === "perDay";
            return (
              <div
                key={meta.kind}
                className={cn("flex items-center gap-3 px-4 py-3", jewel && "bg-cloth text-cloth-fg")}
              >
                <Icon className="size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs uppercase tracking-[0.16em]", jewel ? "text-cloth-fg/70" : "text-muted")}>
                    {meta.label}
                  </p>
                  <p className="truncate font-medium">{line.name}</p>
                </div>
                <p className="font-display text-lg tabular-nums">{valueFor(line, meta.kind)}</p>
              </div>
            );
          })}
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {JEWEL_META.map((meta) => {
            const line = lineFor(ticket, meta.kind);
            const Icon = meta.icon;
            const jewel = meta.kind === "perDay";
            return (
              <Card
                key={meta.kind}
                className={cn("p-4", jewel && "border-cloth bg-cloth text-cloth-fg")}
              >
                <p
                  className={cn(
                    "flex items-center gap-2 text-xs uppercase tracking-[0.16em]",
                    jewel ? "text-cloth-fg/70" : "text-muted",
                  )}
                >
                  <Icon className="size-3.5" />
                  {meta.label}
                </p>
                <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{line.name}</p>
                <p className="mt-1 font-display text-lg tabular-nums">{valueFor(line, meta.kind)}</p>
                <p className={cn("mt-1 text-xs", jewel ? "text-cloth-fg/70" : "text-subtle")}>
                  {meta.hint}
                  {meta.kind !== "fastest" && ` · net ${money(line.net)}`}
                  {meta.kind !== "fastest" && ` · ~${line.days}d`}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {!compact && (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Same stamp on every shelf</p>
            <p className="text-sm tabular-nums text-muted">
              Media Mail {ticket.stampLb} lb {money(ticket.shipping)} + mailer {money(ticket.mailer)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-rule text-xs uppercase tracking-[0.12em] text-muted">
                <tr>
                  {["Shelf", "Gross", "Fees", "Stamp", "Net", "Days", "$/day"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ticket.lines.map((line) => {
                  const win =
                    line.slug === ticket.jewels.perDay.slug
                      ? "jewel"
                      : line.slug === ticket.jewels.mostMoney.slug
                        ? "money"
                        : line.slug === ticket.jewels.fastest.slug
                          ? "fast"
                          : "";
                  return (
                    <tr
                      key={line.slug}
                      className={cn(
                        "border-b border-rule/60 last:border-0",
                        win === "jewel" && "bg-cloth/10",
                        line.net < 0 && "text-stamp",
                      )}
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium text-ink">{line.name}</span>
                        <span className="ml-2 inline-flex flex-wrap gap-1">
                          {win === "jewel" && <Badge tone="cloth">Jewel</Badge>}
                          {win === "money" && line.slug !== ticket.jewels.perDay.slug && (
                            <Badge tone="good">Most</Badge>
                          )}
                          {win === "fast" &&
                            line.slug !== ticket.jewels.perDay.slug &&
                            line.slug !== ticket.jewels.mostMoney.slug && (
                              <Badge tone="warn">Fast</Badge>
                            )}
                        </span>
                        <p className="text-[11px] text-subtle">
                          {line.feeRateLabel}
                          {line.feeNote === "estimate" ? " · estimate" : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{money(line.gross)}</td>
                      <td className="px-3 py-2 tabular-nums">{money(line.fees)}</td>
                      <td className="px-3 py-2 tabular-nums">{money(line.shipping + line.mailer)}</td>
                      <td className="px-3 py-2 tabular-nums font-medium">{money(line.net)}</td>
                      <td className="px-3 py-2 tabular-nums text-muted">~{line.days}</td>
                      <td className="px-3 py-2 tabular-nums">{money(line.netPerDay)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-subtle">
            Fees confirmed from public 2026 seller pages where noted. Days-to-sale are estimates so
            the jewel can exist — not sold comps. Stamp is the same Media Mail cost on every
            channel. Monthly store fees are ignored on purpose.
          </p>
        </Card>
      )}
    </div>
  );
}

export function ScoreProgress({
  done,
  total,
  title,
}: {
  done: number;
  total: number;
  title: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mx-auto max-w-xl space-y-6 py-8">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Scoring the pile</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Titles first. Math second.</h1>
        <p className="mt-3 text-muted">
          The reel already captured every ISBN. Now each copy gets the three jewels, top to bottom.
        </p>
      </div>
      <Card className="space-y-4 p-6">
        <div className="flex items-end justify-between gap-3">
          <p className="font-display text-5xl font-semibold tabular-nums tracking-tight">{pct}%</p>
          <p className="text-sm tabular-nums text-muted">
            {done} / {total}
          </p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-rule/70" aria-hidden>
          <div
            className="h-full rounded-full bg-cloth transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
          />
        </div>
        <p className="truncate text-sm text-muted" aria-live="polite">
          {title || "Waiting"}
        </p>
      </Card>
    </div>
  );
}
