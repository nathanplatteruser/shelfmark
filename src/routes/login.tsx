import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { SignInGate } from "@/lib/auth/gates";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-svh place-items-center bg-paper px-6 py-12 text-ink">
      <div className="w-full max-w-md space-y-6">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Family shop</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Sign in to list live</h1>
        <p className="text-muted">
          Parent signs in once. Then Connect eBay and Amazon. The kids keep scanning — they do not
          need this screen.
        </p>
        <SignInGate fallback={<LoginForm />}>
          <p className="text-sm text-muted">You are signed in.</p>
          <Link to="/connect" className="inline-flex h-12 items-center rounded-md bg-cloth px-4 text-sm font-medium text-cloth-fg no-underline">
            Open Connect
          </Link>
        </SignInGate>
      </div>
    </main>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!authEnabled) {
    return <p className="text-sm text-muted">Sign-in is disabled.</p>;
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({ email, password, name: name || "Shelfmark" });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message);
      }
      window.location.href = "/connect";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {GROK_PROVIDERS.map((p) => (
        <button
          key={p.providerId}
          type="button"
          onClick={() => void signIn(p.providerId, { callbackURL: "/connect" })}
          className="h-12 w-full rounded-md border border-rule bg-elevated px-4 text-sm"
        >
          Continue with {p.label}
        </button>
      ))}
      <p className="pt-2 text-xs uppercase tracking-[0.18em] text-muted">Or a family email</p>
      <form onSubmit={(e) => void onEmail(e)} className="space-y-2">
        {mode === "up" ? (
          <input
            className="h-12 w-full rounded-md border border-rule bg-elevated px-3"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        ) : null}
        <input
          className="h-12 w-full rounded-md border border-rule bg-elevated px-3"
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="h-12 w-full rounded-md border border-rule bg-elevated px-3"
          type="password"
          required
          minLength={8}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-stamp">{error}</p> : null}
        <button type="submit" disabled={busy} className="h-12 w-full rounded-md bg-cloth text-sm font-medium text-cloth-fg">
          {busy ? "Working…" : mode === "up" ? "Create family login" : "Sign in with email"}
        </button>
      </form>
      <button
        type="button"
        className="text-sm text-muted underline decoration-rule underline-offset-4"
        onClick={() => setMode((m) => (m === "in" ? "up" : "in"))}
      >
        {mode === "in" ? "Need a family login? Create one" : "Already have one? Sign in"}
      </button>
    </div>
  );
}
