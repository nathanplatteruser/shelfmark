import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { listCopies, updateStatus } from "@/lib/copies-api";
import { copiesToAmazonLoader } from "@/lib/listing-files";
import {
  ebayAuthorizeUrl,
  exchangeEbayCode,
  refreshEbayToken,
  ensureEbayReady,
  publishEbayOffer,
  type EbayCreds,
} from "@/lib/ebay-sell";
import { submitAmazonInventoryLoader, AMAZON_US_MARKETPLACE, type AmazonCreds } from "@/lib/amazon-sp";
import type { CopyRecord } from "@/lib/types";

type AccountRow = {
  user_id: string;
  channel: string;
  client_id: string;
  client_secret: string;
  runame: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  seller_id: string;
  marketplace_id: string;
  ship_city: string;
  ship_region: string;
  ship_postal: string;
  ship_country: string;
  merchant_location_key: string;
  fulfillment_policy_id: string;
  payment_policy_id: string;
  return_policy_id: string;
  connected: boolean;
  connected_at: string | null;
  last_error: string;
  last_list_at: string | null;
};

export type PublicAccount = {
  channel: string;
  connected: boolean;
  connectedAt: string | null;
  lastError: string;
  lastListAt: string | null;
  hasClientId: boolean;
  hasRefresh: boolean;
  sellerId: string;
  marketplaceId: string;
  runame: string;
  shipCity: string;
  shipRegion: string;
  shipPostal: string;
  merchantLocationKey: string;
  callbackPath: string;
};

function publicize(row: AccountRow | undefined, channel: string): PublicAccount {
  return {
    channel,
    connected: Boolean(row?.connected && (row.access_token || row.refresh_token)),
    connectedAt: row?.connected_at ?? null,
    lastError: row?.last_error ?? "",
    lastListAt: row?.last_list_at ?? null,
    hasClientId: Boolean(row?.client_id),
    hasRefresh: Boolean(row?.refresh_token),
    sellerId: row?.seller_id ?? "",
    marketplaceId: row?.marketplace_id || (channel === "amazon" ? AMAZON_US_MARKETPLACE : "EBAY_US"),
    runame: row?.runame ?? "",
    shipCity: row?.ship_city ?? "",
    shipRegion: row?.ship_region ?? "",
    shipPostal: row?.ship_postal ?? "",
    merchantLocationKey: row?.merchant_location_key || "SHELFMARK-HOME",
    callbackPath: channel === "ebay" ? "/api/ebay/callback" : "/api/amazon/callback",
  };
}

async function loadAccount(userId: string, channel: string): Promise<AccountRow | undefined> {
  const sql = await getSql();
  const rows = await sql<AccountRow>`
    select * from marketplace_accounts
    where user_id = ${userId} and channel = ${channel}
  `;
  return rows[0];
}

async function upsertAccount(
  userId: string,
  channel: string,
  patch: Partial<AccountRow>,
) {
  const sql = await getSql();
  const cur = (await loadAccount(userId, channel)) ?? ({} as Partial<AccountRow>);
  const next = { ...cur, ...patch };
  const now = new Date().toISOString();
  await sql`
    insert into marketplace_accounts (
      user_id, channel, client_id, client_secret, runame,
      access_token, refresh_token, token_expires_at,
      seller_id, marketplace_id,
      ship_city, ship_region, ship_postal, ship_country,
      merchant_location_key, fulfillment_policy_id, payment_policy_id, return_policy_id,
      connected, connected_at, last_error, last_list_at, updated_at
    ) values (
      ${userId}, ${channel},
      ${next.client_id ?? ""}, ${next.client_secret ?? ""}, ${next.runame ?? ""},
      ${next.access_token ?? ""}, ${next.refresh_token ?? ""}, ${next.token_expires_at ?? null},
      ${next.seller_id ?? ""}, ${next.marketplace_id ?? ""},
      ${next.ship_city ?? ""}, ${next.ship_region ?? ""}, ${next.ship_postal ?? ""}, ${next.ship_country ?? "US"},
      ${next.merchant_location_key ?? "SHELFMARK-HOME"},
      ${next.fulfillment_policy_id ?? ""}, ${next.payment_policy_id ?? ""}, ${next.return_policy_id ?? ""},
      ${Boolean(next.connected)}, ${next.connected_at ?? null}, ${next.last_error ?? ""}, ${next.last_list_at ?? null},
      ${now}
    )
    on conflict (user_id, channel) do update set
      client_id = excluded.client_id,
      client_secret = excluded.client_secret,
      runame = excluded.runame,
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      token_expires_at = excluded.token_expires_at,
      seller_id = excluded.seller_id,
      marketplace_id = excluded.marketplace_id,
      ship_city = excluded.ship_city,
      ship_region = excluded.ship_region,
      ship_postal = excluded.ship_postal,
      ship_country = excluded.ship_country,
      merchant_location_key = excluded.merchant_location_key,
      fulfillment_policy_id = excluded.fulfillment_policy_id,
      payment_policy_id = excluded.payment_policy_id,
      return_policy_id = excluded.return_policy_id,
      connected = excluded.connected,
      connected_at = excluded.connected_at,
      last_error = excluded.last_error,
      last_list_at = excluded.last_list_at,
      updated_at = excluded.updated_at
  `;
}

export const getMarketplaceStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ebay = await loadAccount(context.userId, "ebay");
    const amazon = await loadAccount(context.userId, "amazon");
    return {
      ebay: publicize(ebay, "ebay"),
      amazon: publicize(amazon, "amazon"),
    };
  });

export const saveEbayApp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      runame: z.string().min(1),
      shipCity: z.string().optional(),
      shipRegion: z.string().optional(),
      shipPostal: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const cur = await loadAccount(context.userId, "ebay");
    await upsertAccount(context.userId, "ebay", {
      ...(cur ?? ({} as AccountRow)),
      user_id: context.userId,
      channel: "ebay",
      client_id: data.clientId.trim(),
      client_secret: data.clientSecret.trim(),
      runame: data.runame.trim(),
      ship_city: data.shipCity?.trim() ?? cur?.ship_city ?? "",
      ship_region: data.shipRegion?.trim() ?? cur?.ship_region ?? "",
      ship_postal: data.shipPostal?.trim() ?? cur?.ship_postal ?? "",
      last_error: "",
    });
    return { ok: true as const };
  });

export const startEbayOAuth = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const acc = await loadAccount(context.userId, "ebay");
    if (!acc?.client_id || !acc.client_secret || !acc.runame) {
      return { ok: false as const, error: "Save your eBay App ID, Cert ID, and RuName first." };
    }
    const state = crypto.randomUUID();
    const sql = await getSql();
    await sql`
      insert into marketplace_oauth_state (state, user_id, channel)
      values (${state}, ${context.userId}, ${"ebay"})
    `;
    const url = ebayAuthorizeUrl(
      { clientId: acc.client_id, clientSecret: acc.client_secret, runame: acc.runame },
      state,
    );
    return { ok: true as const, url };
  });

export const saveEbayUserToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      accessToken: z.string().min(10),
      refreshToken: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const cur = await loadAccount(context.userId, "ebay");
    const now = new Date().toISOString();
    await upsertAccount(context.userId, "ebay", {
      ...(cur ?? ({} as AccountRow)),
      user_id: context.userId,
      channel: "ebay",
      access_token: data.accessToken.trim(),
      refresh_token: data.refreshToken?.trim() || cur?.refresh_token || "",
      token_expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      connected: true,
      connected_at: now,
      last_error: "",
    });
    return { ok: true as const };
  });

export async function completeEbayOAuth(state: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const sql = await getSql();
  const rows = await sql<{ user_id: string; channel: string }>`
    select user_id, channel from marketplace_oauth_state where state = ${state}
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "This eBay login expired. Start Connect again." };
  await sql`delete from marketplace_oauth_state where state = ${state}`;
  const acc = await loadAccount(row.user_id, "ebay");
  if (!acc?.client_id) return { ok: false, error: "eBay app keys are missing." };
  try {
    const tokens = await exchangeEbayCode(
      { clientId: acc.client_id, clientSecret: acc.client_secret, runame: acc.runame },
      code,
    );
    const now = new Date().toISOString();
    await upsertAccount(row.user_id, "ebay", {
      ...acc,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken || acc.refresh_token,
      token_expires_at: tokens.expiresAt,
      connected: true,
      connected_at: now,
      last_error: "",
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "eBay login failed.";
    await upsertAccount(row.user_id, "ebay", { ...acc, last_error: message, connected: false });
    return { ok: false, error: message };
  }
}

async function liveEbayAccess(userId: string): Promise<{ token: string; creds: EbayCreds; acc: AccountRow }> {
  const acc = await loadAccount(userId, "ebay");
  if (!acc) throw new Error("Connect eBay first.");
  const creds: EbayCreds = {
    clientId: acc.client_id,
    clientSecret: acc.client_secret,
    runame: acc.runame,
  };
  const expired =
    !acc.token_expires_at || new Date(acc.token_expires_at).getTime() < Date.now() + 30_000;
  if (acc.refresh_token && (expired || !acc.access_token) && creds.clientId) {
    const tokens = await refreshEbayToken(creds, acc.refresh_token);
    await upsertAccount(userId, "ebay", {
      ...acc,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: tokens.expiresAt,
      connected: true,
      last_error: "",
    });
    return { token: tokens.accessToken, creds, acc: { ...acc, access_token: tokens.accessToken } };
  }
  if (!acc.access_token) throw new Error("eBay is not connected. Paste a user token or click Connect with eBay.");
  return { token: acc.access_token, creds, acc };
}

async function markListed(copy: CopyRecord, channel: string, remoteId: string, method: string) {
  const sql = await getSql();
  const now = new Date().toISOString();
  await sql`
    insert into channel_listings (
      copy_id, channel_slug, remote_id, status, push_method, last_error, listed_at, ended_at
    ) values (
      ${copy.id}, ${channel}, ${remoteId}, ${"live"}, ${method}, ${""}, ${now}, ${null}
    )
    on conflict (copy_id, channel_slug) do update set
      remote_id = excluded.remote_id,
      status = excluded.status,
      push_method = excluded.push_method,
      last_error = '',
      listed_at = excluded.listed_at,
      ended_at = null
  `;
  await sql`
    update copies set status = ${"listed"}, listed_at = ${now}, updated_at = ${now}
    where id = ${copy.id} and status <> ${"sold"} and status <> ${"shipped"}
  `;
  await sql`
    insert into activity (kind, copy_id, detail)
    values (${"listed"}, ${copy.id}, ${`Live on ${channel}: ${remoteId}`})
  `;
  await sql`
    update channel_accounts set connected = true, last_push_at = ${now}
    where slug = ${channel}
  `;
}

async function findCopy(copyId: number): Promise<CopyRecord> {
  const all = await listCopies({ data: { status: "all" } });
  const copy = all.find((c) => c.id === copyId);
  if (!copy) throw new Error("Copy not found.");
  if (copy.status === "sold" || copy.status === "shipped" || copy.status === "skipped") {
    throw new Error("This copy is not listable.");
  }
  return copy;
}

export const listLiveOnEbay = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ copyId: z.number() }))
  .handler(async ({ context, data }) => {
    try {
      const copy = await findCopy(data.copyId);
      const { token, acc } = await liveEbayAccess(context.userId);
      const policies = await ensureEbayReady(token, {
        city: acc.ship_city,
        region: acc.ship_region,
        postal: acc.ship_postal,
        country: acc.ship_country || "US",
        key: acc.merchant_location_key || "SHELFMARK-HOME",
      });
      await upsertAccount(context.userId, "ebay", {
        ...acc,
        merchant_location_key: policies.locationKey,
        fulfillment_policy_id: policies.fulfillmentPolicyId,
        payment_policy_id: policies.paymentPolicyId,
        return_policy_id: policies.returnPolicyId,
        last_error: "",
      });
      const published = await publishEbayOffer(token, copy, policies);
      await markListed(copy, "ebay", published.listingId, "api");
      await upsertAccount(context.userId, "ebay", {
        ...(await loadAccount(context.userId, "ebay"))!,
        last_list_at: new Date().toISOString(),
        last_error: "",
        connected: true,
      });
      return {
        ok: true as const,
        listingId: published.listingId,
        url: `https://www.ebay.com/itm/${published.listingId}`,
        title: copy.title,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "eBay listing failed.";
      const acc = await loadAccount(context.userId, "ebay");
      if (acc) await upsertAccount(context.userId, "ebay", { ...acc, last_error: message });
      return { ok: false as const, error: message };
    }
  });

export const saveAmazonApp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      refreshToken: z.string().optional(),
      sellerId: z.string().optional(),
      marketplaceId: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const cur = await loadAccount(context.userId, "amazon");
    const refresh = data.refreshToken?.trim() || cur?.refresh_token || "";
    const now = new Date().toISOString();
    await upsertAccount(context.userId, "amazon", {
      ...(cur ?? ({} as AccountRow)),
      user_id: context.userId,
      channel: "amazon",
      client_id: data.clientId?.trim() || cur?.client_id || "",
      client_secret: data.clientSecret?.trim() || cur?.client_secret || "",
      refresh_token: refresh,
      seller_id: data.sellerId?.trim() || cur?.seller_id || "",
      marketplace_id: data.marketplaceId?.trim() || cur?.marketplace_id || AMAZON_US_MARKETPLACE,
      connected: Boolean(refresh),
      connected_at: refresh ? now : cur?.connected_at ?? null,
      last_error: "",
    });
    return { ok: true as const, connected: Boolean(refresh) };
  });

export const listLiveOnAmazon = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ copyIds: z.array(z.number()).min(1) }))
  .handler(async ({ context, data }) => {
    try {
      const acc = await loadAccount(context.userId, "amazon");
      if (!acc?.refresh_token || !acc.client_id || !acc.client_secret) {
        return {
          ok: false as const,
          error: "Amazon API keys are not connected. Use the Inventory Loader upload tonight, or paste LWA credentials.",
          fileFallback: true as const,
        };
      }
      const all = await listCopies({ data: { status: "all" } });
      const copies = all.filter((c) => data.copyIds.includes(c.id));
      if (copies.length === 0) return { ok: false as const, error: "No copies to list." };
      const tsv = copiesToAmazonLoader(copies, "add");
      const creds: AmazonCreds = {
        clientId: acc.client_id,
        clientSecret: acc.client_secret,
        refreshToken: acc.refresh_token,
        sellerId: acc.seller_id,
        marketplaceId: acc.marketplace_id || AMAZON_US_MARKETPLACE,
      };
      const { feedId } = await submitAmazonInventoryLoader(creds, tsv);
      for (const copy of copies) {
        await markListed(copy, "amazon", feedId, "feed");
      }
      await upsertAccount(context.userId, "amazon", {
        ...acc,
        last_list_at: new Date().toISOString(),
        last_error: "",
        connected: true,
      });
      return { ok: true as const, feedId, count: copies.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Amazon listing failed.";
      const acc = await loadAccount(context.userId, "amazon");
      if (acc) await upsertAccount(context.userId, "amazon", { ...acc, last_error: message });
      return { ok: false as const, error: message, fileFallback: true as const };
    }
  });

export const disconnectChannel = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ channel: z.enum(["ebay", "amazon"]) }))
  .handler(async ({ context, data }) => {
    const acc = await loadAccount(context.userId, data.channel);
    if (!acc) return { ok: true as const };
    await upsertAccount(context.userId, data.channel, {
      ...acc,
      access_token: "",
      refresh_token: "",
      connected: false,
      last_error: "",
    });
    return { ok: true as const };
  });

export { updateStatus };
