"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function SignOutButton({ full }: { full?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Hard navigation so the cleared auth cookie applies from the first request.
    window.location.href = "/auth";
  }

  return (
    <Button
      variant="fill"
      full={full}
      type="button"
      onClick={handleSignOut}
      disabled={loading}
    >
      {loading ? "Signing out…" : "Sign Out"}
    </Button>
  );
}
