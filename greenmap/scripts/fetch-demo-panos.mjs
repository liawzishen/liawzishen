/**
 * Fetch 3 CC0 farmland panoramas (Poly Haven tonemapped JPGs, ~8K) and resize
 * to 2048×1024 q80 into public/demo/pano-{1,2,3}.jpg. If a download fails,
 * generate a stylized SVG panorama instead so the demo never breaks offline.
 * URL format verified 2026-07-12 (HTTP 200):
 *   https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/<slug>.jpg
 * License: CC0 (https://polyhaven.com/license) — no attribution required.
 *
 * Run: node scripts/fetch-demo-panos.mjs   (npm run demo:panos)
 */
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const SLUGS = [
  "flower_road",
  "meadow_2",
  "sunflowers_puresky",
  "hilly_terrain_01",
  "kloppenheim_06",
];
const OUT = resolve(process.cwd(), "public/demo");
const W = 2048;
const H = 1024;

function fallbackSvg(i) {
  const skies = [
    ["#BFE3FF", "#EAF6FF"],
    ["#FFD9A0", "#FFF3DC"],
    ["#C9E8FF", "#F2FAFF"],
  ];
  const [top, bottom] = skies[i % skies.length];
  const rows = Array.from({ length: 7 }, (_, r) => {
    const y = H * 0.55 + r * (H * 0.06);
    return `<rect x="0" y="${y}" width="${W}" height="${H * 0.028}" fill="#5c7d4a" opacity="0.5" rx="8"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H * 0.55}" fill="url(#sky)"/>
    <rect y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="#79a35c"/>
    <circle cx="${W * 0.78}" cy="${H * 0.18}" r="46" fill="#F5D77A"/>
    ${rows}
  </svg>`;
}

async function fetchSlug(slug) {
  const url = `https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/${slug}.jpg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

await mkdir(OUT, { recursive: true });
let written = 0;
for (const slug of SLUGS) {
  if (written >= 3) break;
  try {
    const raw = await fetchSlug(slug);
    const jpg = await sharp(raw)
      .resize(W, H, { fit: "fill" })
      .jpeg({ quality: 80 })
      .toBuffer();
    await writeFile(resolve(OUT, `pano-${written + 1}.jpg`), jpg);
    console.log(`✓ pano-${written + 1}.jpg ← ${slug} (${(jpg.length / 1024) | 0} KB)`);
    written++;
  } catch (err) {
    console.warn(`⚠ ${slug} failed: ${err.message}`);
  }
}
while (written < 3) {
  const jpg = await sharp(Buffer.from(fallbackSvg(written)))
    .jpeg({ quality: 80 })
    .toBuffer();
  await writeFile(resolve(OUT, `pano-${written + 1}.jpg`), jpg);
  console.log(`✓ pano-${written + 1}.jpg ← generated fallback`);
  written++;
}
console.log("Done — 3 demo panoramas in public/demo/.");
