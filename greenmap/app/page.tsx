import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Landing page. Mobile (<1024px): the original vertical stack inside the
 * phone frame. Desktop (≥1024px): escapes the frame (.desktop-breakout) into
 * a horizontal split hero + 3-across rows, mirroring /auth's wide layout
 * (2026-07-10 spec).
 */

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
    <main id="main-content" className="desktop-breakout pb-10 lg:pb-16">
      <div className="lg:mx-auto lg:w-full lg:max-w-[1200px] lg:px-8">
        <header className="flex items-center justify-between px-6 pt-5 lg:px-0 lg:pt-8">
          <span className="font-rustic text-[17px] font-bold text-[#5c3a21] lg:text-[20px]">
            🌿 GreenMap
          </span>
          <div className="flex items-center gap-2">
            {/* min-h-24 keeps this text link at the 24×24 target floor
                (WCAG 2.5.8) without growing the 36px-tall header row. */}
            <Link
              href="/auth"
              className="inline-flex min-h-[24px] items-center px-2 text-[15px] font-medium text-brand transition-opacity active:opacity-60"
            >
              Log In
            </Link>
            <Button href="/auth" size="sm">
              Get Started
            </Button>
          </div>
        </header>

        {/* Hero — stacked on phones, split text|visual at lg */}
        <div className="lg:grid lg:grid-cols-[6fr_5fr] lg:items-center lg:gap-12 lg:pt-16">
          <section className="px-6 pt-10 lg:px-0 lg:pt-0">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-brand-dark">
              From seed to table
            </p>
            <h1 className="mt-2 font-rustic text-[34px] font-bold leading-[1.15] lg:text-[44px]">
              Every step recorded, every plant verified, every harvest trusted.
            </h1>
            <p className="mt-3 text-[16px] leading-relaxed text-secondary lg:text-[18px]">
              AI-powered farm management and harvest transparency for Malaysian
              smallholder farmers.
            </p>
            <div className="mt-6 lg:max-w-[280px]">
              <Button href="/auth" full>
                Get Started
              </Button>
            </div>
          </section>

          {/* Hero visual — bird's-eye farm map mockup with health-ring markers */}
          <section className="px-6 pt-8 lg:px-0 lg:pt-0">
            <Card className="p-0">
              <div
                aria-hidden
                className="relative h-44 overflow-hidden rounded-card bg-brand/10 lg:h-[320px]"
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
        </div>

        {/* Value props — grouped rows on phones, 3-across at lg */}
        <section className="px-6 pt-8 lg:px-0 lg:pt-14">
          <Card className="p-0 lg:grid lg:grid-cols-3 lg:divide-x lg:divide-[rgb(92_58_33_/_0.16)]">
            {valueProps.map((prop, i) => (
              <div
                key={prop.title}
                className={`flex items-center gap-3 p-4 lg:flex-col lg:items-start lg:gap-2 lg:p-6 ${
                  i > 0 ? "max-lg:hairline-t" : ""
                }`}
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

        {/* How it works — vertical list on phones, 3 horizontal steps at lg */}
        <section className="px-6 pt-8 lg:px-0 lg:pt-12">
          <h2 className="font-rustic text-[20px] font-semibold">How it works</h2>
          <div className="mt-3 space-y-3 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
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

        <footer className="px-6 pt-12 text-center text-[12px] leading-relaxed text-secondary lg:pt-16">
          GreenMap · From seed to table
          <br />
          Codex Community Hackathon KL 2026 · AI for Malaysia 🇲🇾
        </footer>
      </div>
    </main>
  );
}
