"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { isPasswordValid } from "@/lib/auth/password";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LanguageSetting } from "@/components/profile/LanguageSetting";

/**
 * Profile screen — a "comcard" (name-card) header over a Messenger-style
 * settings list. The primary action flips the page into an inline edit form
 * where the grower can change their avatar, name, headline and password.
 *
 * Storage: avatars reuse the public `farm-backgrounds` bucket under an
 * `avatars/` prefix (no extra migration). The URL + headline live in the auth
 * user_metadata; `profiles.name` is kept in sync because the public Harvest
 * Passport reads the grower's name from there.
 */

type Props = {
  userId: string;
  email: string;
  role: "grower" | "consumer";
  initialName: string;
  headline: string;
  avatarUrl: string | null;
  isVerified: boolean;
  memberSince: string; // ISO timestamp
  /** Optional card rendered under the comcard in view mode (e.g. My Plan row). */
  planSlot?: React.ReactNode;
};

const AVATAR_BUCKET = "farm-backgrounds"; // public; reused via an avatars/ prefix

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "🌱";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function fmtMonthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

/** Centre-crop to a 512×512 JPEG so avatars stay small and square. */
async function compressAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const out = 512;
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  for (const q of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", q)
    );
    if (blob && (blob.size <= 400_000 || q === 0.55)) return blob;
  }
  throw new Error("Could not process the image");
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2l.9-1.4A1 1 0 0 1 8.4 4h7.2a1 1 0 0 1 .8.6L17.3 6h1.2A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function VerifiedTick() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m4.5 12.5 2.2 4.3a1 1 0 0 0 1.7.1L19.5 6"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProfileClient(props: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(props.initialName);
  const [headline, setHeadline] = useState(props.headline);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const roleLabel = props.role === "consumer" ? "Consumer" : "Grower";
  const shownAvatar = avatarPreview ?? props.avatarUrl;
  const shownName = name.trim() || props.initialName || roleLabel;
  const shownHeadline = headline.trim();

  const nameOk = name.trim().length >= 2;
  const wantsPwd = password.length > 0;
  const pwdOk = !wantsPwd || (isPasswordValid(password) && password === confirm);
  const canSave = nameOk && pwdOk && !saving;

  function startEdit() {
    setName(props.initialName);
    setHeadline(props.headline);
    setPassword("");
    setConfirm("");
    setAvatarBlob(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setError(null);
    setSuccess(false);
    setEditing(true);
  }

  function cancelEdit() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarBlob(null);
    setName(props.initialName);
    setHeadline(props.headline);
    setPassword("");
    setConfirm("");
    setError(null);
    setEditing(false);
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const blob = await compressAvatar(file);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarBlob(blob);
      setAvatarPreview(URL.createObjectURL(blob));
    } catch {
      setError("Couldn't read that image. Try another photo (JPG or PNG).");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      let avatar_url = props.avatarUrl;
      if (avatarBlob) {
        const path = `avatars/${props.userId}-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, avatarBlob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw new Error(`Avatar upload failed: ${upErr.message}`);
        avatar_url = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
          .data.publicUrl;
      }

      const { error: updErr } = await supabase.auth.updateUser({
        ...(wantsPwd ? { password } : {}),
        data: {
          name: name.trim(),
          role: props.role,
          headline: headline.trim(),
          avatar_url,
        },
      });
      if (updErr) throw new Error(updErr.message);

      // Keep profiles.name in sync — the public Harvest Passport reads it.
      await supabase
        .from("profiles")
        .update({ name: name.trim() })
        .eq("id", props.userId);

      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      setAvatarBlob(null);
      setPassword("");
      setConfirm("");
      setEditing(false);
      setSuccess(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onPickAvatar}
        className="hidden"
      />

      {/* ── Comcard ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-card glass">
        <div className="h-24 bg-gradient-to-br from-[#0DB074] via-[#15998C] to-[#1E434A]" />
        <div className="px-5 pb-5">
          <div className="relative -mt-12 inline-block">
            <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-fill ring-4 ring-white/80">
              {shownAvatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={shownAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[28px] font-bold text-secondary">
                  {initialsOf(shownName)}
                </span>
              )}
            </div>
            {editing && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Change photo"
                className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-brand text-white shadow-card ring-2 ring-white/80 active:opacity-80"
              >
                <CameraIcon />
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <h1 className="text-[22px] font-bold leading-tight">{shownName}</h1>
            {props.isVerified && (
              <span
                title="Verified Grower"
                className="grid h-5 w-5 place-items-center rounded-full bg-brand text-white"
              >
                <VerifiedTick />
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[12px] font-semibold text-brand">
              {roleLabel}
            </span>
            {props.isVerified ? (
              <span className="rounded-full bg-fill px-2.5 py-0.5 text-[12px] font-medium text-secondary">
                ✓ Verified
              </span>
            ) : (
              <span className="rounded-full bg-fill px-2.5 py-0.5 text-[12px] font-medium text-secondary">
                Member since {fmtMonthYear(props.memberSince)}
              </span>
            )}
          </div>

          {shownHeadline ? (
            <p className="mt-3 text-[14px] leading-snug text-label">
              {shownHeadline}
            </p>
          ) : editing ? (
            <p className="mt-3 text-[14px] italic leading-snug text-secondary">
              Add a headline below — e.g. “Tomato grower · Johor”.
            </p>
          ) : null}

          <p className="mt-1 text-[13px] text-secondary">{props.email}</p>
        </div>
      </section>

      {!editing && props.planSlot}

      {success && (
        <p
          role="status"
          className="mt-4 rounded-input bg-brand/10 p-3 text-center text-[14px] font-medium text-brand"
        >
          ✓ Profile updated
        </p>
      )}

      {/* ── View mode: details list + actions ───────────────────── */}
      {!editing && (
        <>
          <div className="mt-4 overflow-hidden rounded-card glass">
            {[
              { label: "Name", value: shownName },
              { label: "Email", value: props.email },
              { label: "Role", value: roleLabel },
              { label: "Member since", value: fmtMonthYear(props.memberSince) },
            ].map((row, i) => (
              <div
                key={row.label}
                className={`flex items-center justify-between gap-4 p-4 ${
                  i > 0 ? "hairline-t" : ""
                }`}
              >
                <span className="text-[15px] text-secondary">{row.label}</span>
                <span className="truncate text-[15px] font-medium">
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <LanguageSetting />
          </div>

          <Button full className="mt-4" onClick={startEdit}>
            Edit your profile
          </Button>
          <div className="mt-3">
            <SignOutButton full />
          </div>
        </>
      )}

      {/* ── Edit mode: form ─────────────────────────────────────── */}
      {editing && (
        <div className="mt-4 rounded-card p-5 glass">
          <p className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-secondary">
            Edit profile
          </p>

          <div className="space-y-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              error={
                name.length > 0 && !nameOk
                  ? "Use at least 2 characters."
                  : undefined
              }
            />
            <Input
              label="Headline (optional)"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Tomato grower · Johor"
              maxLength={60}
            />

            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-secondary">
                Email
              </p>
              <div className="flex h-12 items-center rounded-input bg-fill px-4 text-[16px] text-secondary">
                {props.email}
              </div>
              <p className="mt-1 text-[12px] text-secondary">
                Email can&apos;t be changed here.
              </p>
            </div>

            <div className="hairline-t pt-4">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
                Change password
              </p>
              <p className="mb-3 mt-0.5 text-[12px] text-secondary">
                Leave blank to keep your current password.
              </p>
              <div className="space-y-4">
                <Input
                  label="New password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                />
                {wantsPwd && <PasswordChecklist password={password} />}
                {wantsPwd && (
                  <Input
                    label="Confirm new password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    error={
                      confirm.length > 0 && confirm !== password
                        ? "Passwords do not match."
                        : undefined
                    }
                  />
                )}
              </div>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-input bg-critical/10 p-3 text-[14px] text-critical-ink"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <Button variant="fill" full onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
            <Button full onClick={save} disabled={!canSave}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
