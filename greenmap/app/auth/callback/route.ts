import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/types";

/**
 * GET /auth/callback — OAuth landing (Google / Apple via Supabase Auth).
 *
 * The auth page starts `signInWithOAuth` with
 * `redirectTo = /auth/callback?role=<selected role>`; Supabase sends the
 * user back here with a PKCE `code`. We exchange it for a session (the
 * @supabase/ssr client persists the cookies), then — for FIRST-TIME OAuth
 * users only, who never saw the Grower/Consumer picker during a normal
 * signup — stamp the chosen role + display name into auth metadata and
 * mirror it into `profiles` (service role, because 0005 restricts client
 * profile updates to `name`). Existing users keep their stored role.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const fail = (message: string) =>
    NextResponse.redirect(
      `${origin}/auth?sso_error=${encodeURIComponent(message)}`
    );

  // Provider / user-cancel errors come back as query params.
  const providerError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) return fail(providerError);

  const code = url.searchParams.get("code");
  if (!code) return fail("Sign-in was cancelled. Please try again.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return fail(error?.message ?? "Could not complete sign-in. Please try again.");
  }

  const user = data.user;
  const meta = (user.user_metadata ?? {}) as {
    role?: string;
    name?: string;
    full_name?: string;
  };

  let role: Role = meta.role === "consumer" ? "consumer" : "grower";

  // First OAuth sign-in: no role in metadata yet → apply the role selected
  // on the auth page (default grower) and a display name from the provider.
  if (meta.role !== "grower" && meta.role !== "consumer") {
    role = url.searchParams.get("role") === "consumer" ? "consumer" : "grower";
    const name =
      (meta.name ?? meta.full_name ?? "").trim() ||
      (user.email?.split("@")[0] ?? "");

    await supabase.auth.updateUser({ data: { role, name } });

    // Mirror into profiles (the signup trigger defaulted it to 'grower').
    // Best-effort: without a service key the app still works — role checks
    // read auth metadata, which is already correct.
    try {
      const admin = createAdminClient();
      await admin.from("profiles").update({ role, name }).eq("id", user.id);
    } catch {
      /* no service key configured — skip the mirror */
    }
  }

  return NextResponse.redirect(
    `${origin}${role === "consumer" ? "/consumer" : "/farms"}`
  );
}
