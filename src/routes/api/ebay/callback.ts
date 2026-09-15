import { createFileRoute } from "@tanstack/react-router";
import { completeEbayOAuth } from "@/lib/marketplace-api";

export const Route = createFileRoute("/api/ebay/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error_description") || url.searchParams.get("error");
        const origin = `${url.protocol}//${url.host}`;
        if (err) {
          return Response.redirect(`${origin}/connect?ebay=error&detail=${encodeURIComponent(err)}`);
        }
        if (!code || !state) {
          return Response.redirect(`${origin}/connect?ebay=error&detail=${encodeURIComponent("Missing code from eBay.")}`);
        }
        const result = await completeEbayOAuth(state, code);
        if (!result.ok) {
          return Response.redirect(
            `${origin}/connect?ebay=error&detail=${encodeURIComponent(result.error ?? "eBay login failed.")}`,
          );
        }
        return Response.redirect(`${origin}/connect?ebay=connected`);
      },
    },
  },
});
