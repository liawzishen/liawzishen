"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
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
        className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-secondary"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          suppressHydrationWarning
          className={cn(
            "h-12 w-full rounded-input bg-fill px-4 text-[16px] text-label placeholder:text-secondary",
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
    <main className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6">
      {/* One garden-window container (user reference, 2026-07-04): the
          reactive sunflowers sit at the bottom of the warm left panel like
          mascots; the clean form panel is on the right with the mode switch
          pinned to its bottom. Stacks vertically on phones. */}
      <div className="w-full max-w-[430px] overflow-hidden rounded-[26px] glass md:grid md:max-w-[880px] md:grid-cols-[1.05fr_1fr]">
        {/* Garden half */}
        <div className="relative flex min-h-[240px] flex-col bg-gradient-to-b from-[#FFF7DF] via-[#F2FAEE] to-[#E4F2E0]">
          <div className="px-6 pt-6">
            <p className="text-[15px] font-bold text-brand-dark">🌿 GreenMap</p>
            <p className="mt-1 text-[13px] text-secondary">
              Grow trust, from seed to sale.
            </p>
          </div>
          <div className="mt-auto">
            <SunflowerScene
              mode={isRegister ? "register" : "login"}
              penalty={failedAttempts}
              strength={strength}
              typing={password.length > 0}
              locked={locked}
            />
          </div>
        </div>

        {/* Form half */}
        <div className="flex flex-col bg-white/85 p-6 backdrop-blur-xl md:min-h-[560px] md:p-8">
          <div className="text-center">
            <span aria-hidden className="text-[22px]">
              🌿
            </span>
            <h1 className="mt-1 text-[24px] font-bold leading-tight">
              {isRegister ? "Create your account" : "Welcome back!"}
            </h1>
            <p className="mt-1 text-[14px] leading-snug text-secondary">
              {isRegister
                ? "Map your farm, track every plant, earn consumer trust."
                : "Please enter your details."}
            </p>
          </div>

        <SegmentedControl
          className="mt-5"
          value={mode}
          onChange={switchMode}
          options={[
            { value: "register", label: "Register" },
            { value: "login", label: "Sign In" },
          ]}
        />

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
          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
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
                            "rounded-input p-3.5 text-left transition",
                            selected
                              ? "bg-brand/10 ring-2 ring-brand"
                              : "bg-fill ring-1 ring-transparent"
                          )}
                        >
                          <span
                            aria-hidden
                            className="text-[24px] leading-none"
                          >
                            {card.icon}
                          </span>
                          <span className="mt-1.5 flex items-center gap-1 text-[15px] font-semibold">
                            {card.title}
                            {selected && (
                              <span className="text-brand">✓</span>
                            )}
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
              {isRegister && (
                <p className="mt-1.5 text-[13px] leading-snug text-secondary">
                  Mix uppercase, lowercase, a number &amp; a symbol (8+ chars)
                  to grow your sunflower 🌻
                </p>
              )}
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
          </form>
        )}

        {/* Mode switch — pinned to the panel bottom like the reference */}
        {!notice && (
          <p className="mt-6 text-center text-[14px] text-secondary md:mt-auto md:pt-4">
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
