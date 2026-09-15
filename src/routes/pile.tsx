import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PileStation } from "@/components/pile-station";

export const Route = createFileRoute("/pile")({ component: PilePage });

function PilePage() {
  return (
    <AppShell>
      <PileStation />
    </AppShell>
  );
}
