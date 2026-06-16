"use client";

import { useEffect, useState } from "react";

/**
 * Blue AI suggestion card on the plant detail page. Uses a 60-minute
 * sessionStorage cache per plant (docs/01 §2) so it doesn't re-call Gemini on
 * every visit. Never counts as a scan.
 */
export function SuggestionCard({ plantId }: { plantId: string }) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = `suggest:${plantId}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached) as { suggestion?: string; ts?: number };
        if (
          typeof parsed.suggestion === "string" &&
          typeof parsed.ts === "number" &&
          Date.now() - parsed.ts < 60 * 60 * 1000
        ) {
          setSuggestion(parsed.suggestion);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore cache errors
    }

    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/ai/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plantId }),
        });
        const data = await res.json();
        if (!active) return;
        if (typeof data?.suggestion === "string") {
          setSuggestion(data.suggestion);
          try {
            sessionStorage.setItem(
              key,
              JSON.stringify({ suggestion: data.suggestion, ts: Date.now() })
            );
          } catch {
            // ignore
          }
        }
      } catch {
        // leave suggestion null on failure
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [plantId]);

  if (loading) {
    return (
      <div className="mt-4 rounded-card bg-info/10 p-4 text-[14px] text-info">
        Thinking of a tip…
      </div>
    );
  }
  if (!suggestion) return null;

  return (
    <div className="mt-4 flex gap-3 rounded-card bg-info/10 p-4">
      <span className="text-[20px]">💡</span>
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-info">
          AI Suggestion
        </p>
        <p className="mt-0.5 text-[14px] leading-snug">{suggestion}</p>
      </div>
    </div>
  );
}
