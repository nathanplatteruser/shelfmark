import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { LooksGallery } from "@/components/looks-gallery";

export const Route = createFileRoute("/looks")({ component: LooksPage });

function LooksPage() {
  return (
    <AppShell>
      <LooksGallery />
    </AppShell>
  );
}
