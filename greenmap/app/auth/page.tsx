"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { isPasswordValid } from "@/lib/auth/password";
import { cn } from "@/lib/utils";
import { SunflowerScene } from "@/components/auth/SunflowerScene";
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

/**
 * Disabled SSO previews (user decision B, 2026-07-05): the reference layout's
 * Apple/Google buttons, shown honestly — no OAuth is configured (and Apple
 * sign-in needs a paid developer account), so they are real <button disabled>
 * elements with a "coming soon" caption instead of dead clickable controls.
 */
function SsoBlock({ isRegister }: { isRegister: boolean }) {
  const verb = isRegister ? "Sign up" : "Sign in";
  return (
    <div className="mt-3">
      <div className="flex items-center gap-3 text-[12px] font-medium text-tertiary">
        <span aria-hidden className="h-px flex-1 bg-black/10" />
        OR
        <span aria-hidden className="h-px flex-1 bg-black/10" />
      </div>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled
          className="flex h-10 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-[12px] bg-black text-[14px] font-semibold text-white opacity-55"
        >
          <AppleLogo /> Apple
        </button>
        <button
          type="button"
          disabled
          className="flex h-10 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-[12px] border border-black/10 bg-white text-[14px] font-semibold text-label opacity-70"
        >
          <GoogleLogo /> Google
        </button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-tertiary">
        {verb} with Apple or Google — coming soon
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

/* ── Local labelled field (shared Input doesn't take a trailing button) ─── */

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
        className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-secondary"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          suppressHydrationWarning
          className={cn(
            "h-[52px] w-full rounded-[12px] bg-[#F5F5F7] px-4 text-[16px] text-label placeholder:text-[#a0a3a7]",
            "focus:outline-none focus:ring-2 focus:ring-brand/50",
            !!trailing && "pr-12",
            error && "ring-2 ring-critical/60"
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
        <p className="mt-1 text-[13px] text-secondary">{hint}</p>
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const isRegister = mode === "register";

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

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "Hide password" : "Show password"}
      className="flex h-8 w-8 items-center justify-center rounded-full text-secondary transition active:opacity-70"
    >
      <EyeIcon open={showPassword} />
    </button>
  );

  return (
    <main className="auth-breakout flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6">
      {/* Split card — LAYOUT from the user's reference (45/55 split, tagline
          top-left, sunflowers planted at the base, switch link at the panel
          bottom); COLORS from the app's own design system so the page matches
          the rest of GreenMap (user feedback 2026-07-04: no dark backdrop —
          keep the ambient page background). */}
      <div className="w-full min-w-0 max-w-[880px] overflow-hidden rounded-[26px] glass sm:flex sm:h-[870px]">
        {/* Left panel — the visual panel. The scene FILLS it (fill prop):
            the sun cursor works across the whole pale-yellow area, the sky is
            seamless, clouds drift up top and a bee wanders the flowers, which
            stay planted at the base. */}
        <div className="relative min-h-[300px] overflow-hidden bg-gradient-to-b from-[#FFEFC2] via-[#F8F4DC] to-[#DFF2E4] sm:w-[50%]">
          <SunflowerScene
            fill
            mode={isRegister ? "register" : "login"}
            penalty={failedAttempts}
            strength={strength}
            typing={password.length > 0}
            locked={locked}
          />
          {/* Centered frosted-glass brand card (top-centered on phones so it
              clears the flowers; true center on sm+). pointer-events-none so
              the sun cursor keeps working through it. */}
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-10 sm:items-center sm:pt-0">
            <div className="glass rounded-[20px] px-7 py-6 text-center">
              <p className="text-[20px] font-bold text-brand-dark">🌿 GreenMap</p>
              <p className="mt-2 text-[15px] font-semibold leading-snug text-[#2c3a30]">
                Empowering Farms &<br />
                Connecting Tables.
              </p>
            </div>
          </div>
        </div>

        {/* Right panel — the form panel */}
        <div className="flex flex-col bg-white/85 p-6 backdrop-blur-xl sm:w-[50%] sm:overflow-y-auto sm:p-7 lg:px-11 lg:py-6">
        {/* Login's shorter content centers vertically; register fills the panel */}
        <div className={cn(!isRegister && "sm:my-auto")}>
          <div className="text-center">
            <h1 className="text-[24px] font-bold leading-tight sm:text-[27px]">
              {isRegister ? "Join GreenMap" : "Welcome back!"}
            </h1>
            <p className="mt-1.5 text-[14px] leading-snug text-secondary">
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
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-[28px]"
            >
              📧
            </div>
            <p className="mt-3 text-[16px] font-semibold">Almost there!</p>
            <p
              className="mt-1 text-[15px] leading-relaxed text-secondary"
              role="status"
            >
              {notice}
            </p>
            <Button
              variant="fill"
              full
              className="mt-5"
              type="button"
              onClick={() => switchMode("login")}
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-2.5" noValidate>
            {isRegister && (
              <>
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-secondary">
                    I am a…
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {roleCards.map((card) => {
                      const selected = role === card.value;
                      return (
                        <button
                          key={card.value}
                          type="button"
                          onClick={() => setRole(card.value)}
                          aria-pressed={selected}
                          className={cn(
                            "relative rounded-[14px] border p-2.5 text-left shadow-[0_2px_10px_rgb(20_50_35/0.06)] transition",
                            selected
                              ? "border-[#7ed49a] bg-brand/8"
                              : "border-black/5 bg-white"
                          )}
                        >
                          <span
                            aria-hidden
                            className="text-[24px] leading-none"
                          >
                            {card.icon}
                          </span>
                          {selected && (
                            <span
                              aria-hidden
                              className="absolute right-2 top-2 grid h-[18px] w-[18px] place-items-center rounded-full bg-brand text-[11px] font-bold text-white"
                            >
                              ✓
                            </span>
                          )}
                          <span className="mt-1.5 block text-[15px] font-semibold">
                            {card.title}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-secondary">
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
                className="rounded-input bg-critical/10 p-3 text-[14px] text-critical"
                role="alert"
              >
                {error}
              </p>
            )}

            {locked && (
              <div className="rounded-input bg-critical/10 p-3 text-center text-[13px] text-critical">
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

            <Button
              type="submit"
              full
              disabled={!canSubmit}
              aria-busy={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Please wait…
                </span>
              ) : isRegister ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </Button>

            <SsoBlock isRegister={isRegister} />
          </form>
        )}
        </div>

        {/* Mode switch — pinned to the panel bottom like the reference */}
        {!notice && (
          <p className="mt-6 text-center text-[14px] text-secondary sm:mt-auto sm:pt-4">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="font-semibold text-brand"
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
                className="font-semibold text-brand"
                onClick={() => switchMode("register")}
              >
                Create one
              </button>
            </>
          )}
        </p>
        )}
        </div>
      </div>
    </main>
  );
}
