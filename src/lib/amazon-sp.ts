const LWA = "https://api.amazon.com/auth/o2/token";
const SP_NA = "https://sellingpartnerapi-na.amazon.com";
export const AMAZON_US_MARKETPLACE = "ATVPDKIKX0DER";

export type AmazonCreds = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  sellerId: string;
  marketplaceId: string;
};

export async function amazonAccessToken(creds: AmazonCreds): Promise<string> {
  const res = await fetch(LWA, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  });
  const body = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || `Amazon login failed (${res.status}).`);
  }
  return body.access_token;
}

/**
 * Upload an Inventory Loader TSV via SP-API Feeds.
 * Works for used books already in the Amazon catalog (ISBN match).
 * Requires a self-authorized SP-API app with the Feeds / Listings role.
 */
export async function submitAmazonInventoryLoader(
  creds: AmazonCreds,
  tsv: string,
): Promise<{ feedId: string }> {
  const token = await amazonAccessToken(creds);
  const marketplaceId = creds.marketplaceId || AMAZON_US_MARKETPLACE;

  const docRes = await fetch(`${SP_NA}/feeds/2021-06-30/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-amz-access-token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contentType: "text/tab-separated-values; charset=UTF-8" }),
  });
  const doc = (await docRes.json()) as { feedDocumentId?: string; url?: string; errors?: Array<{ message?: string }> };
  if (!docRes.ok || !doc.feedDocumentId || !doc.url) {
    throw new Error(doc.errors?.[0]?.message || "Amazon would not open a feed document. Check SP-API Feeds permission.");
  }

  const put = await fetch(doc.url, {
    method: "PUT",
    headers: { "Content-Type": "text/tab-separated-values; charset=UTF-8" },
    body: tsv,
  });
  if (!put.ok) throw new Error(`Amazon feed upload failed (${put.status}).`);

  const feedRes = await fetch(`${SP_NA}/feeds/2021-06-30/feeds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-amz-access-token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      feedType: "POST_FLAT_FILE_INVLOADER_DATA",
      marketplaceIds: [marketplaceId],
      inputFeedDocumentId: doc.feedDocumentId,
    }),
  });
  const feed = (await feedRes.json()) as { feedId?: string; errors?: Array<{ message?: string }> };
  if (!feedRes.ok || !feed.feedId) {
    throw new Error(feed.errors?.[0]?.message || "Amazon rejected the Inventory Loader feed.");
  }
  return { feedId: feed.feedId };
}
