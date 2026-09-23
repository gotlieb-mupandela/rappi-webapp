"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authCallbackUrl, userFromAuth } from "@/lib/auth/session";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/catalog";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/lib/stores/auth";
import { useT } from "@/components/locale-provider";

const LOGIN_VISUAL = "/brand/hero-athlete.png";

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/account";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const login = useAuth((s) => s.login);
  const setUser = useAuth((s) => s.setUser);
  const user = useAuth((s) => s.user);
  const t = useT();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (searchParams.get("error") === "auth") {
      toast.error(t("login.authError"));
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function applySessionUser() {
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", authUser.id)
      .maybeSingle();
    setUser({
      email: profile?.email ?? authUser.email ?? email,
      name: profile?.full_name || userFromAuth(authUser).name,
    });
    return true;
  }

  async function onGoogle() {
    if (!configured) {
      toast.error(t("login.supabaseRequired"));
      return;
    }
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authCallbackUrl(next),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error(error.message);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (configured) {
      const supabase = createClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() || email.split("@")[0] },
            emailRedirectTo: authCallbackUrl(next),
          },
        });
        if (error) {
          setLoading(false);
          toast.error(error.message);
          return;
        }
        const signedIn = await applySessionUser();
        setLoading(false);
        if (signedIn) {
          toast.success(t("login.welcome"));
          router.push(next);
        } else {
          toast.success(t("login.checkEmail"));
          setMode("signin");
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (!error) {
        await applySessionUser();
        toast.success(t("login.welcome"));
        setLoading(false);
        router.push(next);
        return;
      }
      setLoading(false);
      toast.error(error.message || t("login.invalid"));
      return;
    }

    const result = login(email, password);
    setLoading(false);
    if (result.ok) {
      toast.success(t("login.welcome"));
      router.push(next);
    } else {
      toast.error(t("login.invalid"));
    }
  }

  return (
    <div className="grid min-h-[calc(100dvh-var(--header-h))] lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[var(--accent-dim)] lg:block">
        <div className="absolute inset-4 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGIN_VISUAL}
            alt=""
            className="h-full w-full max-w-none object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--accent-dim)]/90 via-[var(--accent-dim)]/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
              {t("home.tagline")}
            </p>
            <p className="mt-3 max-w-sm font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase leading-tight">
              {t("home.title")}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex flex-col justify-center bg-white px-4 py-10 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 h-28 overflow-hidden rounded-2xl lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGIN_VISUAL}
              alt=""
              className="h-full w-full object-cover object-center"
            />
          </div>

          <BrandLogo className="mb-5 h-20 w-auto sm:h-24" />
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
            {t("home.tagline")}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-oswald)] text-4xl font-bold uppercase text-[var(--text-secondary)]">
            {mode === "signup" ? t("login.createTitle") : t("login.title")}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {next === "/checkout" ? t("login.checkoutHint") : t("login.hint")}
          </p>

          {configured ? (
            <Button
              type="button"
              variant="outline"
              className="mt-6 w-full normal-case tracking-normal"
              size="lg"
              disabled={googleLoading || loading}
              onClick={() => void onGoogle()}
            >
              <GoogleMark />
              {googleLoading ? t("login.signingIn") : t("login.google")}
            </Button>
          ) : null}

          {configured ? (
            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-[var(--muted-2)]">
              <span className="h-px flex-1 bg-[var(--border)]" />
              {t("login.orEmail")}
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>
          ) : (
            <div className="mt-6" />
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("login.name")}</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading || googleLoading}>
              {loading
                ? t("login.signingIn")
                : mode === "signup"
                  ? t("login.createAccount")
                  : t("login.submit")}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-[var(--muted)]">
            {mode === "signup" ? (
              <>
                {t("login.haveAccount")}{" "}
                <button
                  type="button"
                  className="font-semibold text-[var(--accent)]"
                  onClick={() => setMode("signin")}
                >
                  {t("login.submit")}
                </button>
              </>
            ) : (
              <>
                {t("login.noAccount")}{" "}
                <button
                  type="button"
                  className="font-semibold text-[var(--accent)]"
                  onClick={() => setMode("signup")}
                >
                  {t("login.createAccount")}
                </button>
              </>
            )}
          </p>

          {!configured ? (
            <p className="mt-4 text-xs text-[var(--muted-2)]">
              {t("login.demo", { email: DEMO_EMAIL, password: DEMO_PASSWORD })}
            </p>
          ) : null}

          <Button asChild variant="outline" className="mt-6 w-full">
            <Link href="/">{t("login.continueShopping")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center px-4 py-16 text-sm text-[var(--muted)]">
          …
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
