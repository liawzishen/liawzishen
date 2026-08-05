import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Severity } from "@/types/database";
import type { ScanResult } from "@/lib/ai/validate";

const SEV: Record<Severity, { label: string; tone: "brand" | "warning" | "critical" }> = {
  none: { label: "Healthy", tone: "brand" },
  mild: { label: "Mild", tone: "warning" },
  moderate: { label: "Moderate", tone: "warning" },
  severe: { label: "Severe", tone: "critical" },
};

export function AIScanResultCard({ result }: { result: ScanResult }) {
  // Honest failure state — never shows a "Healthy" badge or a save-score line.
  if (result.error) {
    return (
      <Card className="mt-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-[18px]">⚠️</span>
          <p className="text-[14px] font-semibold text-warning-ink">
            Couldn&apos;t analyse the photo
          </p>
        </div>
        <p className="mt-2 text-[14px] text-secondary">{result.diagnosis}</p>
      </Card>
    );
  }

  const sev = SEV[result.severity] ?? SEV.none;
  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
          Diagnosis
        </p>
        <Badge tone={sev.tone}>{sev.label}</Badge>
      </div>
      <p className="mt-2 text-[16px] font-medium leading-snug">{result.diagnosis}</p>

      {result.mock && (
        <p className="mt-2 rounded-input bg-warning/10 p-2 text-[12px] text-warning-ink">
          Sample result — add GEMINI_API_KEY for real AI analysis.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[12px] text-secondary">Confidence</span>
        {/* The bar is a duplicate of the "%" text beside it — hide the graphic
            so it isn't announced as an unlabelled group. */}
        <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-fill">
          <div
            className="h-full rounded-full bg-info"
            style={{ width: `${result.confidence}%` }}
          />
        </div>
        <span className="text-[12px] font-semibold">{result.confidence}%</span>
      </div>

      <p className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Recommendations
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {result.recommendations.map((r, i) => (
          <li key={i} className="flex gap-2 text-[14px]">
            <span aria-hidden className="text-brand-dark">•</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[12px] text-secondary">
        Saving adds an AI score of {result.ai_sub_score}/100 (40% of health).
      </p>
    </Card>
  );
}
