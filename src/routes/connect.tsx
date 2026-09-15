import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  disconnectChannel,
  getMarketplaceStatus,
  saveAmazonApp,
  saveEbayApp,
  saveEbayUserToken,
  startEbayOAuth,
  type PublicAccount,
} from "@/lib/marketplace-api";
import { toast } from "sonner";

export const Route = createFileRoute("/connect")({ component: ConnectPage });

function ConnectPage() {
  const { user, isPending } = useCurrentUserState();
  return (
    <AppShell>
      {isPending ? <ConnectSkeleton /> : user ? <ConnectDesk /> : <NeedLogin />}
    </AppShell>
  );
}

function NeedLogin() {
  return (
    <Card className="mx-auto max-w-lg space-y-4 p-6">
      <p className="text-xs uppercase tracking-[0.22em] text-muted">Tonight</p>
      <h1 className="font-display text-3xl font-semibold">Parent signs in first</h1>
      <p className="text-muted">
        eBay and Amazon keys stay on this family account. Kids keep using Shop and Reel after you
        connect.
      </p>
      <Button asChild>
        <Link to="/login">Open sign-in</Link>
      </Button>
    </Card>
  );
}

function ConnectSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-28 max-w-xl rounded-md bg-rule/30" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-h-80 animate-pulse bg-elevated p-6" />
        <Card className="min-h-80 animate-pulse bg-elevated p-6" />
      </div>
    </div>
  );
}

function ConnectDesk() {
  const search = useRouterState({ select: (s) => s.location.search });
  const [ebay, setEbay] = useState<PublicAccount | null>(null);
  const [amazon, setAmazon] = useState<PublicAccount | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const s = await getMarketplaceStatus();
    setEbay(s.ebay);
    setAmazon(s.amazon);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(typeof search === "string" ? search : "");
    if (typeof search === "object" && search && "ebay" in (search as object)) {
      /* tanstack search object */
    }
    const raw = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(raw);
    if (params.get("ebay") === "connected") toast.success("eBay is connected.");
    if (params.get("ebay") === "error") toast.error(params.get("detail") || "eBay login failed.");
  }, [search]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Live production</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Connect the two shops
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            eBay can list from this desk tonight. Amazon lists tonight with the Inventory Loader —
            or with SP-API keys if you already have them. AbeBooks and the rest wait.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {ebay ? <EbayCard acc={ebay} busy={busy} setBusy={setBusy} onSaved={() => void load()} /> : <Card className="min-h-64 p-6" />}
        {amazon ? (
          <AmazonCard acc={amazon} busy={busy} setBusy={setBusy} onSaved={() => void load()} />
        ) : (
          <Card className="min-h-64 p-6" />
        )}
      </div>
    </div>
  );
}

function EbayCard({
  acc,
  busy,
  setBusy,
  onSaved,
}: {
  acc: PublicAccount;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [runame, setRuname] = useState(acc.runame);
  const [city, setCity] = useState(acc.shipCity);
  const [region, setRegion] = useState(acc.shipRegion);
  const [postal, setPostal] = useState(acc.shipPostal);
  const [userToken, setUserToken] = useState("");
  const callback = useMemo(() => {
    if (typeof window === "undefined") return acc.callbackPath;
    return `${window.location.origin}${acc.callbackPath}`;
  }, [acc.callbackPath]);

  async function saveKeys() {
    setBusy(true);
    try {
      await saveEbayApp({
        data: { clientId, clientSecret, runame, shipCity: city, shipRegion: region, shipPostal: postal },
      });
      toast.success("eBay app keys saved.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save keys.");
    } finally {
      setBusy(false);
    }
  }

  async function connectOAuth() {
    setBusy(true);
    try {
      if (clientId && clientSecret && runame) {
        await saveEbayApp({
          data: { clientId, clientSecret, runame, shipCity: city, shipRegion: region, shipPostal: postal },
        });
      }
      const res = await startEbayOAuth();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start eBay login.");
    } finally {
      setBusy(false);
    }
  }

  async function pasteToken() {
    setBusy(true);
    try {
      await saveEbayUserToken({ data: { accessToken: userToken } });
      toast.success("eBay user token saved. You can list from Listings.");
      setUserToken("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Token was not saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Channel 1</p>
          <h2 className="font-display text-3xl font-semibold">eBay</h2>
        </div>
        <StatusDot on={acc.connected} />
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
        <li>
          Open{" "}
          <a className="text-ink underline decoration-rule underline-offset-4" href="https://developer.ebay.com/my/keys" target="_blank" rel="noreferrer">
            developer.ebay.com/my/keys
          </a>{" "}
          and create a Production keyset (App ID + Cert ID).
        </li>
        <li>
          Create an RuName whose redirect URL is exactly
          <code className="mt-1 block break-all rounded-md bg-elevated px-2 py-1 text-xs text-ink">{callback}</code>
        </li>
        <li>Save the keys here, then Connect with eBay. Sign in as the selling account.</li>
      </ol>
      <div className="grid gap-2">
        <Input placeholder="App ID (Client ID)" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
        <Input placeholder="Cert ID (Client Secret)" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} type="password" autoComplete="off" />
        <Input placeholder="RuName" value={runame} onChange={(e) => setRuname(e.target.value)} autoComplete="off" />
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Ship city" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input placeholder="ST" value={region} onChange={(e) => setRegion(e.target.value)} />
          <Input placeholder="ZIP" value={postal} onChange={(e) => setPostal(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !clientId || !clientSecret || !runame} onClick={() => void saveKeys()}>
          Save keys
        </Button>
        <Button disabled={busy || (!acc.hasClientId && !clientId)} variant="secondary" onClick={() => void connectOAuth()}>
          Connect with eBay
        </Button>
      </div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Faster tonight — paste a user token</p>
      <p className="text-sm text-muted">
        On the same Keys page, Get a User Token Now for Production. Paste it below. Tokens expire;
        OAuth is the lasting path.
      </p>
      <Input placeholder="eBay user access token" value={userToken} onChange={(e) => setUserToken(e.target.value)} />
      <Button variant="secondary" disabled={busy || userToken.length < 12} onClick={() => void pasteToken()}>
        Save token
      </Button>
      {acc.lastError ? <p className="text-sm text-stamp">{acc.lastError}</p> : null}
      {acc.connected ? (
        <button
          type="button"
          className="text-sm text-muted underline decoration-rule underline-offset-4"
          onClick={() => void disconnectChannel({ data: { channel: "ebay" } }).then(onSaved)}
        >
          Disconnect eBay
        </button>
      ) : null}
    </Card>
  );
}

function AmazonCard({
  acc,
  busy,
  setBusy,
  onSaved,
}: {
  acc: PublicAccount;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [sellerId, setSellerId] = useState(acc.sellerId);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refresh, setRefresh] = useState("");

  async function save() {
    setBusy(true);
    try {
      const res = await saveAmazonApp({
        data: {
          sellerId,
          clientId,
          clientSecret,
          refreshToken: refresh,
          marketplaceId: "ATVPDKIKX0DER",
        },
      });
      toast.success(res.connected ? "Amazon API connected. Listings can push a feed." : "Seller ID saved. Use the Inventory Loader tonight.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save Amazon.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Channel 2</p>
          <h2 className="font-display text-3xl font-semibold">Amazon</h2>
        </div>
        <StatusDot on={acc.connected} />
      </div>
      <p className="text-sm leading-relaxed text-muted">
        Amazon does not let a new app list books through SP-API until a developer profile is
        approved. That is days, not tonight. Tonight: generate the Inventory Loader on Listings,
        then upload it in Seller Central. If you already have LWA keys, paste them and we push the
        same file through Feeds.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
        <li>
          Open{" "}
          <a className="text-ink underline decoration-rule underline-offset-4" href="https://sellercentral.amazon.com/listing/upload" target="_blank" rel="noreferrer">
            Seller Central → Add products via upload
          </a>
          .
        </li>
        <li>On Listings, download Amazon loader, then upload that file as Inventory Loader.</li>
        <li>Optional: paste SP-API LWA Client ID, Secret, and refresh token if you already have them.</li>
      </ol>
      <Input placeholder="Merchant / seller ID (optional)" value={sellerId} onChange={(e) => setSellerId(e.target.value)} />
      <Input placeholder="LWA Client ID (optional)" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
      <Input placeholder="LWA Client Secret (optional)" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} type="password" autoComplete="off" />
      <Input placeholder="LWA refresh token (optional)" value={refresh} onChange={(e) => setRefresh(e.target.value)} />
      <Button disabled={busy} onClick={() => void save()}>
        Save Amazon
      </Button>
      {acc.lastError ? <p className="text-sm text-stamp">{acc.lastError}</p> : null}
      {acc.connected ? (
        <button
          type="button"
          className="text-sm text-muted underline decoration-rule underline-offset-4"
          onClick={() => void disconnectChannel({ data: { channel: "amazon" } }).then(onSaved)}
        >
          Disconnect Amazon API
        </button>
      ) : null}
    </Card>
  );
}

function StatusDot({ on }: { on: boolean }) {
  return (
    <span className={on ? "rounded-full bg-good px-3 py-1 text-xs text-good-fg" : "rounded-full border border-rule px-3 py-1 text-xs text-muted"}>
      {on ? "Connected" : "Not connected"}
    </span>
  );
}
