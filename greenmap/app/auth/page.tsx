"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { isPasswordValid } from "@/lib/auth/password";
import { cn } from "@/lib/utils";
import { SunflowerScene } from "@/components/auth/SunflowerScene";
import { TopoBackground } from "@/components/auth/map/TopoBackground";
import { Landscape } from "@/components/auth/map/Landscape";
import {
  WoodenSign,
  SeedPacket,
  GardeningTools,
  Butterfly,
  Bumblebee,
} from "@/components/auth/map/SceneProps";
import type { Role } from "@/types";

type Mode = "register" | "login";

/** Role cards — copy is locked by 02 §2. */
const roleCards: { value: Role; icon: string; title: string; body: string }[] = [
  { value: "grower", icon: "🌾", title: "Grower", body: "I manage a farm" },
  {
    value: "consumer",
    icon: "🛒",
    title: "Consumer",
    body: "Know my food's story",
  },
];

function destinationFor(role: Role | undefined) {
  return role === "consumer" ? "/consumer" : "/farms";
}

/* ── Small inline icons (no extra packages) ─────────────────────────────── */

function AppleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 12.54c-.03-2.62 2.14-3.88 2.24-3.94-1.22-1.79-3.12-2.03-3.8-2.06-1.61-.16-3.15.95-3.97.95-.82 0-2.08-.93-3.43-.9-1.76.03-3.39 1.02-4.29 2.6-1.83 3.18-.47 7.88 1.32 10.46.87 1.26 1.91 2.68 3.27 2.63 1.31-.05 1.81-.85 3.4-.85 1.58 0 2.03.85 3.42.82 1.42-.02 2.31-1.28 3.18-2.55 1-1.46 1.41-2.87 1.44-2.94-.03-.02-2.76-1.06-2.78-4.22ZM14.44 4.83c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.29.69-3.03 1.56-.66.77-1.25 2-1.09 3.18 1.15.09 2.33-.58 3.05-1.45Z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.92l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28A7.19 7.19 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.62H1.29a12 12 0 0 0 0 10.76l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

type SsoProvider = "apple" | "google";

/**
 * Which OAuth providers are switched on for this Supabase project. GoTrue's
 * public settings endpoint reports them, so a click on an unconfigured
 * provider can show a friendly message instead of bouncing the farmer to a
 * raw JSON error page. Cached for the page's lifetime; null = unknown
 * (endpoint unreachable) → optimistically attempt the sign-in.
 */
let settingsCache: Record<string, boolean> | null | undefined;
async function fetchEnabledProviders(): Promise<Record<string, boolean> | null> {
  if (settingsCache !== undefined) return settingsCache;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } }
    );
    const json = (await res.json()) as { external?: Record<string, boolean> };
    settingsCache = json.external ?? null;
  } catch {
    settingsCache = null;
  }
  return settingsCache;
}

/**
 * Live SSO buttons — real Supabase OAuth (PKCE). The flow lands on
 * /auth/callback, which exchanges the code and, for first-time users,
 * applies the role selected above (register mode). Providers must be
 * enabled in Supabase → Authentication → Providers (see README §Google
 * sign-in); Apple additionally needs a paid Apple Developer account.
 */
function SsoBlock({
  isRegister,
  busy,
  onSso,
}: {
  isRegister: boolean;
  busy: SsoProvider | null;
  onSso: (provider: SsoProvider) => void;
}) {
  const verb = isRegister ? "Sign up" : "Sign in";
  const woodBtn =
    "flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-wood-medium/50 bg-[#d2b48c]/40 font-rustic text-[13px] font-medium text-wood-dark transition hover:bg-[#d2b48c]/60 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-wood-medium/60">
        <span aria-hidden className="h-px flex-1 bg-wood-medium/25" />
        OR
        <span aria-hidden className="h-px flex-1 bg-wood-medium/25" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => onSso("apple")}
          className={woodBtn}
        >
          <AppleLogo /> {busy === "apple" ? "Opening…" : "Apple"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => onSso("google")}
          className={woodBtn}
        >
          <GoogleLogo /> {busy === "google" ? "Opening…" : "Google"}
        </button>
      </div>
      <p className="mt-2 text-center font-rustic text-[11px] italic text-wood-medium/60">
        {verb} with Apple or Google
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3-.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Local labelled field — parchment styling ───────────────────────────── */

function Field({
  label,
  hint,
  trailing,
  error,
  id,
  ...inputProps
}: {
  label: string;
  hint?: string;
  trailing?: React.ReactNode;
  error?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-wood-dark/90"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          suppressHydrationWarning
          className={cn(
            "h-[48px] w-full rounded-lg border-2 border-wood-light/40 bg-paper-dark/25 px-3.5 text-[15px] text-wood-dark placeholder:text-wood-medium/50",
            "outline-none transition focus:border-wood-medium focus:bg-paper-light",
            !!trailing && "pr-12",
            error && "border-critical/70"
          )}
          {...inputProps}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-2 flex items-center">
            {trailing}
          </div>
        )}
      </div>
      {hint && !error && (
        <p className="mt-1 text-[13px] text-wood-medium">{hint}</p>
      )}
      {error && <p className="mt-1 text-[13px] text-critical">{error}</p>}
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("register");
  const [role, setRole] = useState<Role>("grower");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Drives the sun cursor: on while the pointer is over the landscape (which
  // hides its native cursor), off over the form (which keeps a normal cursor).
  const [overLandscape, setOverLandscape] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [ssoBusy, setSsoBusy] = useState<SsoProvider | null>(null);

  const isRegister = mode === "register";

  // Surface an OAuth failure passed back by /auth/callback (?sso_error=…),
  // then clean the URL so a refresh doesn't re-show it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get("sso_error");
    if (ssoError) {
      setError(ssoError);
      window.history.replaceState(null, "", "/auth");
    }
  }, []);

  // Sunflower growth meter (register) + wilt penalty (login).
  const pwdCriteria = useMemo(
    () => [
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ],
    [password]
  );
  const strength = pwdCriteria.filter(Boolean).length;
  const locked = !isRegister && failedAttempts >= 3;

  /* Derived validity — drives the disabled state of the submit button. */
  const passwordOk = useMemo(() => isPasswordValid(password), [password]);
  const confirmOk = confirm.length > 0 && confirm === password;
  const nameOk = name.trim().length >= 2;
  const emailOk = /\S+@\S+\.\S+/.test(email);

  const canRegister = nameOk && emailOk && passwordOk && confirmOk;
  const canLogin = emailOk && password.length > 0;
  const canSubmit = (isRegister ? canRegister : canLogin) && !loading && !locked;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    // Clear password fields when switching so login rules aren't affected
    // by a half-typed registration password (and vice-versa).
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    setFailedAttempts(0);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return; // guard against double / invalid submits

    setError(null);
    setNotice(null);
    setLoading(true);
    const supabase = createClient();

    if (isRegister) {
      // Keep name + role in auth metadata. In Phase 2 a database trigger
      // mirrors them into the `profiles` table on signup.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim(), role } },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Happy path (email confirmation OFF): a session exists → go straight in.
      if (data.session) {
        // Hard navigation so the fresh auth cookie is sent on the first request.
        window.location.href = destinationFor(role);
        return;
      }

      // No session ⇒ this project still requires email confirmation.
      // Show a clean message and STAY on the page — do not switch to Login,
      // so the user is never asked to retype what they just entered.
      setNotice("Please check your email to confirm your account.");
      setLoading(false);
      return;
    }

    // Login
    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setFailedAttempts((n) => n + 1);
      setLoading(false);
      return;
    }

    const userRole = (data.user?.user_metadata as { role?: Role } | undefined)
      ?.role;
    window.location.href = destinationFor(userRole);
  }

  /** Real OAuth via Supabase. Prechecks the provider is enabled so farmers
   *  get a friendly message (not a raw JSON error) when it isn't. */
  async function handleSso(provider: SsoProvider) {
    setError(null);
    setNotice(null);
    setSsoBusy(provider);

    const enabled = await fetchEnabledProviders();
    if (enabled && !enabled[provider]) {
      setError(
        provider === "google"
          ? "Google sign-in isn't switched on for this server yet."
          : "Apple sign-in isn't switched on for this server yet."
      );
      setSsoBusy(null);
      return;
    }

    const supabase = createClient();
    const { error: ssoError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // The callback finalises role + name for first-time users. The role
        // hint comes from the selector above (defaults to grower on login).
        redirectTo: `${window.location.origin}/auth/callback?role=${role}`,
      },
    });
    // On success the browser navigates away; we only get here on failure.
    if (ssoError) {
      setError(ssoError.message);
      setSsoBusy(null);
    }
  }

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "Hide password" : "Show password"}
      className="flex h-8 w-8 items-center justify-center rounded-full text-wood-medium transition active:opacity-70"
    >
      <EyeIcon open={showPassword} />
    </button>
  );

  /* Rustic primary button — used for submit and the notice CTA. */
  const primaryBtn =
    "flex h-[50px] w-full items-center justify-center gap-2 rounded-lg wood-btn-shadow bg-meadow-green font-rustic text-[16px] font-semibold text-paper-light transition hover:bg-meadow-dark active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

  /* The form contents — shared by both columns / breakpoints. */
  const formPanel = (
    <div className="relative">
      <div>
        <h1 className="font-rustic text-[26px] font-bold tracking-wide text-wood-dark sm:text-[30px]">
          {isRegister ? "Join GreenMap" : "Welcome back!"}
        </h1>
        <p className="mt-1 font-rustic text-[14px] font-medium text-wood-medium/80">
          {isRegister
            ? "Map your farm, track crops, build trust."
            : "Please enter your details."}
        </p>
      </div>

      {/* Success notice (email confirmation path) replaces the form. */}
      {notice ? (
        <div className="mt-6 text-center">
          <div
            aria-hidden
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-meadow-green/15 text-[28px]"
          >
            📧
          </div>
          <p className="mt-3 font-rustic text-[16px] font-semibold text-wood-dark">
            Almost there!
          </p>
          <p
            className="mt-1 text-[14px] leading-relaxed text-wood-medium"
            role="status"
          >
            {notice}
          </p>
          <button
            type="button"
            className={cn(primaryBtn, "mt-5")}
            onClick={() => switchMode("login")}
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5" noValidate>
          {isRegister && (
            <>
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-wood-dark/90">
                  I am a…
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {roleCards.map((card) => {
                    const selected = role === card.value;
                    return (
                      <button
                        key={card.value}
                        type="button"
                        onClick={() => setRole(card.value)}
                        aria-pressed={selected}
                        className={cn(
                          "relative rounded-lg border-2 p-2.5 text-left transition",
                          selected
                            ? "border-wood-dark bg-[#e3d0a6]"
                            : "border-wood-light/40 bg-paper-light"
                        )}
                      >
                        <span aria-hidden className="text-[24px] leading-none">
                          {card.icon}
                        </span>
                        {selected && (
                          <span
                            aria-hidden
                            className="absolute right-2 top-2 grid h-[18px] w-[18px] place-items-center rounded-full bg-meadow-green text-[11px] font-bold text-white"
                          >
                            ✓
                          </span>
                        )}
                        <span className="mt-1.5 block font-rustic text-[15px] font-bold text-wood-dark">
                          {card.title}
                        </span>
                        <span className="mt-0.5 block text-[12px] font-medium leading-snug text-wood-dark">
                          {card.body}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field
                label="Full Name"
                placeholder="Ahmad bin Abdullah"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </>
          )}

          <Field
            label="Email"
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <div>
            <Field
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder={
                isRegister ? "Create a strong password" : "Your password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              trailing={passwordToggle}
            />
            {isRegister && <PasswordChecklist compact password={password} />}
          </div>

          {isRegister && (
            <Field
              label="Confirm Password"
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              error={
                confirm.length > 0 && !confirmOk
                  ? "Passwords do not match."
                  : undefined
              }
            />
          )}

          {error && (
            <p
              className="rounded-lg border border-critical/40 bg-critical/10 p-3 text-[14px] text-critical"
              role="alert"
            >
              {error}
            </p>
          )}

          {locked && (
            <div className="rounded-lg border border-critical/40 bg-critical/10 p-3 text-center text-[13px] text-critical">
              Too many attempts — the sunflowers wilted.{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => {
                  setFailedAttempts(0);
                  setError(null);
                }}
              >
                Reset & try again
              </button>
            </div>
          )}

          <button
            type="submit"
            className={primaryBtn}
            disabled={!canSubmit}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <Spinner />
                Please wait…
              </>
            ) : isRegister ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>

          <SsoBlock isRegister={isRegister} busy={ssoBusy} onSso={handleSso} />
        </form>
      )}

      {/* Mode switch */}
      {!notice && (
        <p className="mt-5 text-center font-rustic text-[13px] text-wood-medium">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="font-semibold text-meadow-green hover:underline"
                onClick={() => switchMode("login")}
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <button
                type="button"
                className="font-semibold text-meadow-green hover:underline"
                onClick={() => switchMode("register")}
              >
                Create one
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );

  return (
    <main className="auth-breakout relative min-h-dvh w-full overflow-x-hidden">
      {/* z-0 · Parchment map — the backdrop AND the paper the form sits on */}
      <TopoBackground interactive />

      {/* z-10 · Structural split (form-weighted 7 : 3). The form is the
             priority surface at the right (70%); the landscape sits at the
             left (30%). Not a floating card — the form lives directly on the
             parchment margin. */}
      <div className="relative z-10 grid min-h-dvh grid-cols-1 lg:grid-cols-[3fr_7fr]">
        {/* Left 62% — the landscape window (desktop). cursor-none here so the
            native cursor is replaced by the tracking sun. */}
        <div
          className="relative hidden p-5 lg:block lg:cursor-none"
          onMouseEnter={() => setOverLandscape(true)}
          onMouseLeave={() => setOverLandscape(false)}
        >
          <Landscape className="min-h-[540px]" />
          {/* frosted brand card, centered in the left panel */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="glass rounded-[20px] px-6 py-5 text-center">
              <p className="text-[19px] font-bold text-brand-dark">🌿 GreenMap</p>
              <p className="mt-1.5 text-[14px] font-semibold leading-snug text-[#2c3a30]">
                Empowering Farms &<br />
                Connecting Tables.
              </p>
            </div>
          </div>
        </div>

        {/* Right 38% — the form, contiguous with the parchment (no card). */}
        <div className="relative flex min-h-dvh flex-col justify-center px-6 sm:px-10 lg:pl-8 lg:pr-12 xl:pr-16">
          {/* soft textured divide on the parchment side (desktop) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r from-wood-dark/8 to-transparent lg:block"
          />
          <div className="pointer-events-auto relative mx-auto w-full max-w-[600px] pb-[240px] pt-28 lg:py-8">
            {formPanel}
          </div>
        </div>
      </div>

      {/* z-20 · Interactive sunflowers, planted as a click-through band that
             crosses the divide (petals overlap the form's lower-left). */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-20 h-[260px] w-full lg:w-[34%]">
        <SunflowerScene
          band
          sunActive={overLandscape}
          mode={isRegister ? "register" : "login"}
          penalty={failedAttempts}
          strength={strength}
          typing={password.length > 0}
          locked={locked}
        />
      </div>

      {/* z-30 · Organic overlaps — cross the edges to break the rectangle.
             pointer-events-none so nothing blocks the form. */}
      <div className="pointer-events-none absolute inset-0 z-30">
        {/* wooden sign straddling the top over the divide */}
        <div className="absolute left-1/2 top-3 -translate-x-1/2 lg:left-[30%]">
          <WoodenSign
            title="GreenMap"
            subtitle="Empowering Farms & Connecting Tables."
          />
        </div>

        {/* insects + props crossing the landscape / form edges (desktop) */}
        <div className="hidden lg:block">
          <Bumblebee style={{ left: "10%", top: "30%" }} />
          <Butterfly style={{ left: "22%", top: "44%" }} delay={1.5} />
          <Butterfly style={{ left: "33%", top: "26%" }} delay={4} />
          <GardeningTools
            type="pitchfork"
            rotation={16}
            className="absolute left-[30%] top-[54%] w-6"
          />
          <div className="absolute right-[5%] top-[46%] flex gap-2">
            <SeedPacket name="SEEDS" icon="🌾" rotation={-8} />
            <SeedPacket name="SOIL" icon="🪵" rotation={12} />
          </div>
        </div>

        {/* a touch of life on phones */}
        <Butterfly className="lg:hidden" style={{ right: "12%", top: "9%" }} delay={1} />
      </div>
    </main>
  );
}
