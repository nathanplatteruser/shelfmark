import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ReelStation } from "@/components/reel-station";
import { bootstrapDesk, getStats } from "@/lib/copies-api";
import { bootstrapCrew } from "@/lib/crew-api";
import { useCallback, useEffect, useState } from "react";
import type { DeskStats } from "@/lib/types";

export const Route = createFileRoute("/reel")({ component: ReelPage });

function ReelPage() {
  const [stats, setStats] = useState<DeskStats | null>(null);

  const refresh = useCallback(async () => {
    await bootstrapDesk();
    await bootstrapCrew();
    setStats(await getStats());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AppShell listedToday={stats?.listedToday} goal={stats?.goal}>
      <ReelStation />
    </AppShell>
  );
}
