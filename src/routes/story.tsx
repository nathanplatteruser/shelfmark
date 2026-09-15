import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StoryBook } from "@/components/story-book";

export const Route = createFileRoute("/story")({ component: StoryPage });

function StoryPage() {
  return (
    <AppShell>
      <StoryBook />
    </AppShell>
  );
}
