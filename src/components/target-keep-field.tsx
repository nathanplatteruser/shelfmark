import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { listPriceForKeep, money, parseMoneyInput } from "@/lib/pricing";
import { readTargetKeep, writeTargetKeep } from "@/lib/target-keep";

export function TargetKeepField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (keep: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? "" : value.toFixed(2));

  useEffect(() => {
    setText(value == null ? "" : value.toFixed(2));
  }, [value]);

  function commit(raw: string) {
    const parsed = parseMoneyInput(raw);
    onChange(parsed);
    writeTargetKeep(parsed);
    setText(parsed == null ? "" : parsed.toFixed(2));
  }

  const amazon = value == null ? null : listPriceForKeep({ keep: value, format: "paperback", shop: "amazon" });
  const ebay = value == null ? null : listPriceForKeep({ keep: value, format: "paperback", shop: "ebay" });

  return (
    <Card className="space-y-3 border-cloth p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Wait for the jar</p>
      <label className="block">
        <span className="font-display text-2xl font-semibold">I want to keep</span>
        <span className="mt-2 flex items-center gap-2">
          <span className="font-display text-3xl">$</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="5.00"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-14 w-40 rounded-md border border-rule bg-elevated px-3 font-display text-3xl tabular-nums"
            aria-label="Target net profit per book in dollars"
          />
          <span className="text-muted">per book</span>
        </span>
      </label>
      <p className="text-sm leading-relaxed text-muted">
        Type dollars and cents — $1.00 or $5.00. We reverse the shop, the envelope, and the stamp
        into a tag. We wait as long as it takes. Leave blank to use the market guess.
      </p>
      {value != null && amazon != null && ebay != null && (
        <p className="font-display text-lg">
          Keep {money(value)} → Amazon tag {money(amazon)} · eBay tag {money(ebay)}
          <span className="block text-sm font-sans text-muted">Paperback example. Each book uses its own weight.</span>
        </p>
      )}
    </Card>
  );
}

export function useTargetKeep(): [number | null, (keep: number | null) => void] {
  const [keep, setKeep] = useState<number | null>(null);
  useEffect(() => {
    setKeep(readTargetKeep());
  }, []);
  return [keep, setKeep];
}
