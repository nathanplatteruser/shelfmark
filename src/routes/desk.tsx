import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DeskStation } from "@/components/desk-station";
import { bootstrapDesk, getStats } from "@/lib/copies-api";
import type { DeskStats } from "@/lib/types";

export const Route = createFileRoute("/desk")({ component: DeskPage });

function DeskPage() {
  const [stats, setStats] = useState<DeskStats | null>(null);

  const refresh = useCallback(async () => {
    await bootstrapDesk();
    const s = await getStats();
    setStats(s);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AppShell listedToday={stats?.listedToday} goal={stats?.goal}>
      <DeskStation onSaved={() => void refresh()} />
    </AppShell>
  );
}
