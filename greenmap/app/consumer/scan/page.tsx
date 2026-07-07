import Link from "next/link";
import { TopNav } from "@/components/layout/TopNav";

/**
 * Consumer scan page (Phase-3 preview). The camera scanner is a later phase;
 * for now this explains the flow and offers the sample passport so the
 * "growing story" can still be demoed end to end.
 */
const SAMPLE_QR = "/passport/00000000-0000-4000-8000-0000deadbeef";

export default function ConsumerScanPage() {
  return (
    <main className="px-6 pb-12 pt-2">
      <TopNav title="Scan Passport" backHref="/consumer" />

      {/* Camera viewfinder mock */}
      <div className="mx-auto mt-4 flex aspect-square max-w-[320px] items-center justify-center rounded-card bg-label/90">
        <div className="relative grid h-48 w-48 place-items-center">
          <span className="text-[52px]">📷</span>
          {/* corner brackets */}
          <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-white" />
          <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-white" />
          <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-white" />
          <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-white" />
        </div>
      </div>

      <h1 className="mt-6 text-center text-[20px] font-bold">
        Point at a GreenMap QR code
      </h1>
      <p className="mx-auto mt-1.5 max-w-[320px] text-center text-[14px] leading-relaxed text-secondary">
        Scan the code on any verified produce to see where it was grown, its AI
        health checks, and its full harvest journey.
      </p>

      <Link
        href={SAMPLE_QR}
        className="mx-auto mt-6 flex h-[50px] max-w-[320px] items-center justify-center rounded-btn bg-brand text-[16px] font-semibold text-white transition active:scale-[0.99]"
      >
        Try a sample passport
      </Link>
      <p className="mt-3 text-center text-[12px] text-secondary">
        Live camera scanning arrives in a later phase.
      </p>
    </main>
  );
}
