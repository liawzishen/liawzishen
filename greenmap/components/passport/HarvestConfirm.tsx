"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/** Grower confirm step: harvest the plant + generate its passport, then view it. */
export function HarvestConfirm({
  plantId,
  plantName,
}: {
  plantId: string;
  plantName: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function harvest() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/passports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.qr_token) {
        throw new Error(data?.error ?? "Could not generate the passport.");
      }
      router.push(`/passport/${data.qr_token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="px-6 pt-2">
      <Card className="text-center">
        <div className="text-[40px]" aria-hidden>🧺</div>
        <h1 className="mt-2 text-[20px] font-bold">Harvest {plantName}?</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-secondary">
          This freezes a Harvest Passport — the plant&apos;s full growing story,
          trust badges and a QR code for buyers. The plant moves to harvested and
          its record stops updating.
        </p>
      </Card>

      {error && (
        <p className="mt-3 rounded-input bg-critical/10 p-3 text-[14px] text-critical">
          {error}
        </p>
      )}

      <Button full onClick={harvest} disabled={saving} className="mt-5">
        {saving ? "Generating Passport…" : "Mark as Harvested & Generate Passport"}
      </Button>
    </div>
  );
}
