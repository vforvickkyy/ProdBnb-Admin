"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setSessionHint } from "@/lib/sessionHint";
import { INPUT_CLASS } from "@/components/ui/Field";
import { BRAND_NAME } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // An already-signed-in admin landing on /login (e.g. a stale bookmark)
  // should go straight to the dashboard rather than see the form again.
  // Refreshing the hint cookie first is what stops an infinite redirect
  // loop: the Supabase session (localStorage) and the middleware's hint
  // cookie have independent lifetimes, so a still-valid session with a
  // missing/expired cookie would otherwise bounce /dashboard -> /login ->
  // /dashboard forever.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionHint();
        router.replace("/dashboard");
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Sign-in goes directly through Supabase Auth -- the same authority
    // every client of the platform uses. This project never has its own password
    // store or a second auth system.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setSessionHint();
    router.replace("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4">
      {/* A faint grid and glow behind the card -- the only decoration in the console. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(var(--slate-200))_1px,transparent_1px),linear-gradient(90deg,rgb(var(--slate-200))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
      />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-500/10 blur-3xl" />
      <form onSubmit={handleSubmit} className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-pop">
        <div className="mb-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark.png" alt={BRAND_NAME} width={960} height={278} className="h-8 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark-light.png" alt={BRAND_NAME} width={960} height={278} className="hidden h-8 w-auto dark:block" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">Sign in to {BRAND_NAME} Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Use your {BRAND_NAME} admin account.</p>
        </div>
        <label htmlFor="login-email" className="mb-1.5 block text-[13px] font-medium text-slate-700">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`mb-4 h-9 ${INPUT_CLASS}`}
        />
        <label htmlFor="login-password" className="mb-1.5 block text-[13px] font-medium text-slate-700">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`mb-5 h-9 ${INPUT_CLASS}`}
        />
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="h-9 w-full rounded-lg bg-accent-500 text-sm font-medium text-snow shadow-sm transition-colors hover:bg-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          Only an account holding the {BRAND_NAME} <code className="rounded bg-slate-100 px-1 py-px text-slate-700">admin</code> role can access
          anything past this screen — everything else is enforced server-side.
        </p>
      </form>
    </div>
  );
}
