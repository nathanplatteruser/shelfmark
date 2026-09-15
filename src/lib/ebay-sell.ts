import type { CopyRecord } from "@/lib/types";
import { clipTitle } from "@/lib/pricing";
import { EBAY_BOOKS_CATEGORY } from "@/lib/ebay-csv";

export const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.identity",
].join(" ");

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const API = "https://api.ebay.com";
const AUTH = "https://auth.ebay.com/oauth2/authorize";

export type EbayCreds = {
  clientId: string;
  clientSecret: string;
  runame: string;
};

export type EbayTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

function basicAuth(id: string, secret: string) {
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

function ebayCondition(grade: string): string {
  if (grade === "LN") return "LIKE_NEW";
  if (grade === "VG") return "USED_VERY_GOOD";
  if (grade === "G") return "USED_GOOD";
  if (grade === "A") return "USED_ACCEPTABLE";
  return "USED_GOOD";
}

async function parseEbay(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function ebayMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const o = body as { errors?: Array<{ message?: string; longMessage?: string }>; error_description?: string };
  if (o.error_description) return o.error_description;
  const first = o.errors?.[0];
  return first?.longMessage || first?.message || fallback;
}

export function ebayAuthorizeUrl(creds: EbayCreds, state: string): string {
  const u = new URL(AUTH);
  u.searchParams.set("client_id", creds.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", creds.runame);
  u.searchParams.set("scope", EBAY_SCOPES);
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeEbayCode(creds: EbayCreds, code: string): Promise<EbayTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(creds.clientId, creds.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: creds.runame,
    }),
  });
  const body = (await parseEbay(res)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;
  if (!res.ok || !body?.access_token) {
    throw new Error(ebayMessage(body, `eBay token exchange failed (${res.status}).`));
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? "",
    expiresAt: new Date(Date.now() + Math.max(60, (body.expires_in ?? 7200) - 120) * 1000).toISOString(),
  };
}

export async function refreshEbayToken(creds: EbayCreds, refreshToken: string): Promise<EbayTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(creds.clientId, creds.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: EBAY_SCOPES,
    }),
  });
  const body = (await parseEbay(res)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;
  if (!res.ok || !body?.access_token) {
    throw new Error(ebayMessage(body, `eBay refresh failed (${res.status}). Reconnect eBay.`));
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + Math.max(60, (body.expires_in ?? 7200) - 120) * 1000).toISOString(),
  };
}

async function ebayFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Content-Language": "en-US",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await parseEbay(res);
  return { res, body };
}

export async function ensureEbayReady(
  accessToken: string,
  ship: { city: string; region: string; postal: string; country: string; key: string },
): Promise<{ locationKey: string; fulfillmentPolicyId: string; paymentPolicyId: string; returnPolicyId: string }> {
  await ebayFetch(accessToken, "/sell/account/v1/program/opt_in", {
    method: "POST",
    body: JSON.stringify({ programType: "SELLING_POLICY_MANAGEMENT" }),
  });

  const locKey = ship.key || "SHELFMARK-HOME";
  const loc = await ebayFetch(accessToken, `/sell/inventory/v1/location/${encodeURIComponent(locKey)}`);
  if (loc.res.status === 404) {
    const created = await ebayFetch(accessToken, `/sell/inventory/v1/location/${encodeURIComponent(locKey)}`, {
      method: "POST",
      body: JSON.stringify({
        location: {
          address: {
            city: ship.city || "Denver",
            stateOrProvince: ship.region || "CO",
            postalCode: ship.postal || "80202",
            country: ship.country || "US",
          },
        },
        locationTypes: ["WAREHOUSE"],
        name: "Shelfmark home",
        merchantLocationStatus: "ENABLED",
      }),
    });
    if (!created.res.ok && created.res.status !== 204) {
      throw new Error(ebayMessage(created.body, "Could not create an eBay inventory location. Add a city, state, and ZIP on Connect."));
    }
  }

  async function firstPolicy(kind: "fulfillment" | "payment" | "return"): Promise<string> {
    const { res, body } = await ebayFetch(
      accessToken,
      `/sell/account/v1/${kind}_policy?marketplace_id=EBAY_US`,
    );
    const list = (body as { fulfillmentPolicies?: Array<{ fulfillmentPolicyId?: string }>; paymentPolicies?: Array<{ paymentPolicyId?: string }>; returnPolicies?: Array<{ returnPolicyId?: string }> } | null);
    const id =
      kind === "fulfillment"
        ? list?.fulfillmentPolicies?.[0]?.fulfillmentPolicyId
        : kind === "payment"
          ? list?.paymentPolicies?.[0]?.paymentPolicyId
          : list?.returnPolicies?.[0]?.returnPolicyId;
    if (!res.ok || !id) {
      throw new Error(
        `eBay needs a ${kind} business policy before we can publish. Open Seller Hub → Account → Business policies, create one, then list again.`,
      );
    }
    return id;
  }

  const [fulfillmentPolicyId, paymentPolicyId, returnPolicyId] = await Promise.all([
    firstPolicy("fulfillment"),
    firstPolicy("payment"),
    firstPolicy("return"),
  ]);

  return { locationKey: locKey, fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
}

export async function publishEbayOffer(
  accessToken: string,
  copy: CopyRecord,
  policies: { locationKey: string; fulfillmentPolicyId: string; paymentPolicyId: string; returnPolicyId: string },
): Promise<{ listingId: string; offerId: string }> {
  if (!copy.sku) throw new Error("Copy is missing a SKU.");
  const sku = encodeURIComponent(copy.sku);
  const title = clipTitle(copy.ebayTitle || `${copy.title} ${copy.author}`.trim());
  const description =
    copy.ebayDescription ||
    copy.conditionDescription ||
    `${copy.title} by ${copy.author}. Used copy. Media Mail from the same shop.`;
  const isbn = copy.isbn13 || copy.isbn10;
  const imageUrls = [copy.coverUrl, ...copy.photos].filter(Boolean).slice(0, 12);
  const price = String(copy.listPrice ?? 9.99);

  const item = await ebayFetch(accessToken, `/sell/inventory/v1/inventory_item/${sku}`, {
    method: "PUT",
    body: JSON.stringify({
      availability: { shipToLocationAvailability: { quantity: 1 } },
      condition: ebayCondition(copy.conditionGrade),
      conditionDescription: copy.conditionDescription || undefined,
      product: {
        title,
        description,
        aspects: Object.fromEntries(
          Object.entries({
            Author: copy.author ? [copy.author] : [],
            Format: copy.format ? [copy.format] : [],
            Language: [copy.language || "English"],
            ISBN: isbn ? [isbn] : [],
          }).filter(([, v]) => v.length),
        ),
        isbn: isbn ? [isbn] : undefined,
        imageUrls: imageUrls.length ? imageUrls : undefined,
      },
    }),
  });
  if (!item.res.ok && item.res.status !== 204) {
    throw new Error(ebayMessage(item.body, "eBay rejected the inventory item."));
  }

  const existing = await ebayFetch(accessToken, `/sell/inventory/v1/offer?sku=${sku}`);
  const offers = (existing.body as { offers?: Array<{ offerId?: string }> } | null)?.offers ?? [];
  let offerId = offers[0]?.offerId ?? "";

  const offerBody = {
    sku: copy.sku,
    marketplaceId: "EBAY_US",
    format: copy.listFormat === "auction" ? "AUCTION" : "FIXED_PRICE",
    listingDescription: description,
    listingDuration: copy.listFormat === "auction" ? "DAYS_7" : "GTC",
    availableQuantity: 1,
    categoryId: EBAY_BOOKS_CATEGORY,
    merchantLocationKey: policies.locationKey,
    listingPolicies: {
      fulfillmentPolicyId: policies.fulfillmentPolicyId,
      paymentPolicyId: policies.paymentPolicyId,
      returnPolicyId: policies.returnPolicyId,
      bestOfferTerms: copy.listFormat === "auction" ? undefined : { bestOfferEnabled: true },
    },
    pricingSummary: {
      price: { value: price, currency: "USD" },
    },
  };

  if (offerId) {
    const updated = await ebayFetch(accessToken, `/sell/inventory/v1/offer/${offerId}`, {
      method: "PUT",
      body: JSON.stringify(offerBody),
    });
    if (!updated.res.ok && updated.res.status !== 204) {
      throw new Error(ebayMessage(updated.body, "eBay could not update the offer."));
    }
  } else {
    const created = await ebayFetch(accessToken, "/sell/inventory/v1/offer", {
      method: "POST",
      body: JSON.stringify(offerBody),
    });
    const createdId = (created.body as { offerId?: string } | null)?.offerId;
    if (!created.res.ok || !createdId) {
      throw new Error(ebayMessage(created.body, "eBay could not create the offer."));
    }
    offerId = createdId;
  }

  const published = await ebayFetch(accessToken, `/sell/inventory/v1/offer/${offerId}/publish`, {
    method: "POST",
  });
  const listingId = (published.body as { listingId?: string } | null)?.listingId;
  if (!published.res.ok || !listingId) {
    throw new Error(ebayMessage(published.body, "eBay did not publish the listing."));
  }
  return { listingId, offerId };
}
