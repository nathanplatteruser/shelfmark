import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { JarLedger } from "@/components/jar-ledger";

export const Route = createFileRoute("/jar")({ component: JarPage });

function JarPage() {
  return (
    <AppShell>
      <JarLedger />
    </AppShell>
  );
}
