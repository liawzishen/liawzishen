import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Landing page skeleton — content per 02 §1. Visual polish lands in Phase 3. */

const valueProps = [
  {
    icon: "🌿",
    title: "Visibility",
    body: "See your entire farm at a glance from bird's-eye view",
  },
  {
    icon: "🤖",
    title: "Intelligence",
    body: "AI analyses plant health and gives you diagnosis",
  },
  {
    icon: "🔍",
    title: "Transparency",
    body: "Every plant has a traceable journey from seed to harvest",
  },
];

const steps = [
  { n: 1, title: "Set up your farm map" },
  { n: 2, title: "Record every plant's journey" },
  { n: 3, title: "Consumer scans QR to see the full story" },
];

const heroMarkers = [
  { left: "18%", top: "32%", ring: "border-brand", score: "92" },
  { left: "56%", top: "20%", ring: "border-brand", score: "88" },
  { left: "74%", top: "58%", ring: "border-warning", score: "61" },
  { left: "34%", top: "68%", ring: "border-critical", score: "34" },
];

export default function LandingPage() {
  return (
    <main className="pb-10">
      <header className="flex items-center justify-between px-6 pt-5">
        <span className="font-rustic text-[17px] font-bold text-[#5c3a21]">
          🌿 GreenMap
        </span>
        <div className="flex items-center gap-2">
          <Link href="/auth" className="px-2 text-[15px] font-medium text-brand">
            Log In
          </Link>
          <Button href="/auth" size="sm">
            Get Started
          </Button>
        </div>
      </header>

      <section className="px-6 pt-10">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-brand-dark">
          From seed to table
        </p>
        <h1 className="mt-2 font-rustic text-[34px] font-bold leading-[1.15]">
          Every step recorded, every plant verified, every harvest trusted.
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-secondary">
          AI-powered farm management and harvest transparency for Malaysian
          smallholder farmers.
        </p>
        <Button href="/auth" full className="mt-6">
          Get Started
        </Button>
      </section>

      {/* Hero visual — bird's-eye farm map mockup with health-ring markers */}
      <section className="px-6 pt-8">
        <Card className="p-0">
          <div
            aria-hidden
            className="relative h-44 overflow-hidden rounded-card bg-brand/10"
            style={{
              backgroundImage:
                "radial-gradient(rgba(79,119,45,0.25) 1.5px, transparent 1.5px)",
              backgroundSize: "14px 14px",
            }}
          >
            {heroMarkers.map((m) => (
              <span
                key={m.score}
                className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] bg-[#fdf9ee] text-[11px] font-bold shadow-card ${m.ring}`}
                style={{ left: m.left, top: m.top }}
              >
                {m.score}
              </span>
            ))}
          </div>
        </Card>
      </section>

      <section className="px-6 pt-8">
        <Card className="p-0">
          {valueProps.map((prop, i) => (
            <div
              key={prop.title}
              className={`flex items-center gap-3 p-4 ${i > 0 ? "hairline-t" : ""}`}
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand/15 text-[18px]"
              >
                {prop.icon}
              </span>
              <div>
                <p className="text-[15px] font-semibold">{prop.title}</p>
                <p className="text-[13px] text-secondary">{prop.body}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section className="px-6 pt-8">
        <h2 className="font-rustic text-[20px] font-semibold">How it works</h2>
        <div className="mt-3 space-y-3">
          {steps.map((step) => (
            <Card key={step.n} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-rustic text-[14px] font-bold text-[#f6ecd5]">
                {step.n}
              </span>
              <p className="text-[15px] font-medium">{step.title}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="px-6 pt-12 text-center text-[12px] leading-relaxed text-secondary">
        GreenMap · From seed to table
        <br />
        Codex Community Hackathon KL 2026 · AI for Malaysia 🇲🇾
      </footer>
    </main>
  );
}
