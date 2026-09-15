import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ClickTour } from "@/components/click-tour";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Shelfmark";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#2F463C" },
      {
        name: "description",
        content: "Scan a book once. List it everywhere. The first sale closes the rest.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <ClickTour />
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "font-sans",
              style: {
                background: "#FAF7F1",
                color: "#1C1916",
                border: "1px solid #C9C3B8",
              },
            }}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
