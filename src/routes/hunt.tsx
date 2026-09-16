import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { HuntStation } from "@/components/hunt-station";

export const Route = createFileRoute("/hunt")({ component: HuntPage });

function HuntPage() {
  return (
    <AppShell>
      <HuntStation />
    </AppShell>
  );
}
