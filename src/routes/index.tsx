import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { KidShop } from "@/components/kid-shop";
import { bootstrapDesk, getStats } from "@/lib/copies-api";
import type { DeskStats } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
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
      <KidShop onSaved={() => void refresh()} />
    </AppShell>
  );
}
