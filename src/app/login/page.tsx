"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setSessionHint } from "@/lib/sessionHint";

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
    // every ProdBnb client uses. This project never has its own password
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
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-lg font-semibold">ProdBnb Admin</h1>
        <label htmlFor="login-email" className="mb-1 block text-sm text-slate-600">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <label htmlFor="login-password" className="mb-1 block text-sm text-slate-600">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        {error && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-xs text-slate-500">
          Only an account holding the ProdBnb <code>admin</code> role can access anything past this
          screen — everything else is enforced server-side.
        </p>
      </form>
    </div>
  );
}
