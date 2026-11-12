// Builds the PWA icons from the mascot in public/logo.svg.
// The logo draws the face with SVG-font glyphs, which rasterizers skip, so the
// glyph outlines are read from the logo and drawn as plain paths.
//
// Dependency: this script imports `sharp`, which is NOT listed in package.json.
// It is available only as a transitive dependency of Next.js (image
// optimization). Do not add it to package.json for this script; if a Next
// upgrade drops it, `node_modules/sharp` will be missing and the script fails.
// The generated PNGs are committed, so it only needs to run when the logo or
// icon sizes change.
//
// Usage: node scripts/generate-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logo = readFileSync(join(root, "public/logo.svg"), "utf8");

const BACKGROUND = "#121214";
const LIGHT = "#00B37E";
const DARK = "#015F43";
const GLYPH_SCALE = 544.81 / 1000; // font-size / units per em

const glyph = logo.match(/<glyph unicode="e"[^>]*\sd="([^"]+)"/)?.[1];
const paths = [...logo.matchAll(/<path class="(fil[23])" d="([^"]+)"/g)];
if (!glyph || paths.length === 0) {
  throw new Error("Could not read the mascot from public/logo.svg");
}
const fillFor = (cls) => (cls === "fil2" ? LIGHT : DARK);

// Mascot bounding box in logo coordinates, measured from the rendered paths
// (ears at the top, face below). Icons are centred on it.
const MASCOT = { minX: 1699, maxX: 2607, minY: 0, maxY: 863 };
const MASCOT_SIZE = Math.max(
  MASCOT.maxX - MASCOT.minX,
  MASCOT.maxY - MASCOT.minY,
);
const CENTER_X = (MASCOT.minX + MASCOT.maxX) / 2;
const CENTER_Y = (MASCOT.minY + MASCOT.maxY) / 2;

function mascotSvg() {
  const eyes = `
    <path fill="${LIGHT}" transform="translate(1845.42 853.92) scale(${GLYPH_SCALE} ${-GLYPH_SCALE})" d="${glyph}"/>
    <path fill="${LIGHT}" transform="matrix(-1 0 0 1 3862.06 1022.29) translate(1449.11 -168.37) scale(${GLYPH_SCALE} ${-GLYPH_SCALE})" d="${glyph}"/>`;
  const shapes = paths
    .map(([, cls, d]) => `<path fill="${fillFor(cls)}" d="${d}"/>`)
    .join("");
  return eyes + shapes;
}

// `fill` is the share of the icon the mascot may take up
function iconSvg(fill) {
  const size = MASCOT_SIZE / fill;
  const x = CENTER_X - size / 2;
  const y = CENTER_Y - size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}">
    <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${BACKGROUND}"/>
    ${mascotSvg()}
  </svg>`;
}

const targets = [
  // Any-purpose icons keep a small margin
  { file: "icons/icon-192.png", size: 192, fill: 0.78 },
  { file: "icons/icon-512.png", size: 512, fill: 0.78 },
  // Maskable icons must keep the artwork inside the 80% safe zone
  { file: "icons/icon-maskable-512.png", size: 512, fill: 0.58 },
  { file: "icons/apple-touch-icon.png", size: 180, fill: 0.7 },
];

const render = (size, fill) =>
  sharp(Buffer.from(iconSvg(fill)), { density: 300 })
    .resize(size, size)
    .flatten({ background: BACKGROUND })
    .png()
    .toBuffer();

for (const { file, size, fill } of targets) {
  writeFileSync(join(root, "public", file), await render(size, fill));
  console.log(`public/${file}`);
}

// favicon.ico with PNG entries (16, 32, 48); sharp can't write ICO itself
const FAVICON_SIZES = [16, 32, 48];
const images = await Promise.all(FAVICON_SIZES.map((s) => render(s, 0.86)));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((png, i) => {
  const entry = 6 + 16 * i;
  header.writeUInt8(FAVICON_SIZES[i], entry);
  header.writeUInt8(FAVICON_SIZES[i], entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
writeFileSync(
  join(root, "src/app/favicon.ico"),
  Buffer.concat([header, ...images]),
);
console.log("src/app/favicon.ico");
