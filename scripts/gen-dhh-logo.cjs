#!/usr/bin/env node
/**
 * Double Helix Hub brand asset generator.
 *
 * Source of truth (transparent PNG exports):
 *   - Color-Rectangle@2x.png  -> full color wordmark (light backgrounds)
 *   - White-Rectangle@2x.png  -> full white wordmark (dark backgrounds)
 *
 * Emits, into each target public/ dir:
 *   logo.png           full color wordmark   (~1024w)
 *   logo-white.png     full white wordmark   (~1024w)
 *   logo-icon.png      helix mark, square    256x256
 *   favicon-32.png     32x32
 *   apple-touch-icon.png 180x180
 *   icon-192.png       192x192   (PWA)
 *   icon-512.png       512x512   (PWA)
 *
 * The helix crop is found by detecting the widest fully-transparent vertical
 * gutter in the left ~60% of the wordmark (the gap between the helix mark and
 * the "Double" glyph), so we never clip the strand tip or include text.
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const DL = '/Users/qloudagent/Downloads';
const COLOR_SRC = path.join(DL, 'Color-Rectangle@2x.png');
const WHITE_SRC = path.join(DL, 'White-Rectangle@2x.png');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  path.join(ROOT, 'apps/admin/public'),
  path.join(ROOT, 'apps/crm/public'),
];

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const FULL_WIDTH = 1024; // master width for the wordmark

async function findHelixCutFraction(src) {
  // Analyse a downsampled copy for speed.
  const W = 660;
  const { data, info } = await sharp(src)
    .resize({ width: W })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const colInk = new Array(width).fill(false);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const a = data[(y * width + x) * channels + (channels - 1)];
      if (a > 16) { colInk[x] = true; break; }
    }
  }
  // Find the widest empty run that is preceded by ink, within left 60%.
  const limit = Math.floor(width * 0.62);
  let bestStart = -1, bestLen = 0;
  let seenInk = false, runStart = -1;
  for (let x = 0; x <= limit; x++) {
    const ink = colInk[x];
    if (ink) seenInk = true;
    if (!ink && seenInk) {
      if (runStart === -1) runStart = x;
    } else if (ink && runStart !== -1) {
      const len = x - runStart;
      if (len > bestLen) { bestLen = len; bestStart = runStart; }
      runStart = -1;
    }
  }
  if (bestStart === -1) throw new Error('Could not locate helix/wordmark gutter');
  // Cut at the middle of the gutter, expressed as a fraction of full width.
  const cutCol = bestStart + Math.floor(bestLen / 2);
  return cutCol / width;
}

async function buildHelixMaster(src) {
  const cutFrac = await findHelixCutFraction(src);
  const meta = await sharp(src).metadata();
  const cutX = Math.max(1, Math.min(meta.width, Math.round(meta.width * cutFrac)));
  console.log(`  src ${meta.width}x${meta.height}, helix cut at x=${cutX} (${(cutFrac * 100).toFixed(1)}%)`);
  // Crop the helix region, then trim transparent margins to a tight bbox.
  const region = await sharp(src)
    .extract({ left: 0, top: 0, width: cutX, height: meta.height })
    .png()
    .toBuffer();
  return await sharp(region).trim().png().toBuffer();
}

async function squareIcon(helixBuf, size, padFrac = 0.08, background = TRANSPARENT) {
  const inner = Math.round(size * (1 - padFrac * 2));
  const border = Math.round((size - inner) / 2);
  return sharp(helixBuf)
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .extend({ top: border, bottom: border, left: border, right: border, background })
    .resize(size, size, { fit: 'fill' }) // normalise any rounding to exact size
    .flatten(background.alpha === 1 ? { background } : false)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// Maskable PWA icon: helix well within the 80% safe zone on a solid white field
// so launchers (circle/squircle masks) never clip the mark.
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
async function maskableIcon(helixBuf, size) {
  return squareIcon(helixBuf, size, 0.22, WHITE);
}

async function writeFull(src, outPath) {
  await sharp(src)
    .resize({ width: FULL_WIDTH })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

(async () => {
  for (const s of [COLOR_SRC, WHITE_SRC]) {
    if (!fs.existsSync(s)) throw new Error(`Missing source: ${s}`);
  }
  console.log('Building helix master from color rectangle...');
  const helix = await buildHelixMaster(COLOR_SRC);
  const helixMeta = await sharp(helix).metadata();
  console.log(`  helix bbox: ${helixMeta.width}x${helixMeta.height}`);

  for (const dir of TARGETS) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`\n-> ${dir}`);

    await writeFull(COLOR_SRC, path.join(dir, 'logo.png'));
    await writeFull(WHITE_SRC, path.join(dir, 'logo-white.png'));
    console.log('  logo.png, logo-white.png');

    const iconSizes = {
      'logo-icon.png': 256,
      'favicon-32.png': 32,
      'apple-touch-icon.png': 180,
      'icon-192.png': 192,
      'icon-512.png': 512,
    };
    for (const [name, size] of Object.entries(iconSizes)) {
      const buf = await squareIcon(helix, size);
      fs.writeFileSync(path.join(dir, name), buf);
    }
    console.log('  ' + Object.keys(iconSizes).join(', '));
  }

  // Refresh CRM PWA icon set (icons/ dir) so old brand is fully replaced.
  const crmIcons = path.join(ROOT, 'apps/crm/public/icons');
  if (fs.existsSync(crmIcons)) {
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    for (const sz of sizes) {
      const buf = await squareIcon(helix, sz);
      fs.writeFileSync(path.join(crmIcons, `icon-${sz}x${sz}.png`), buf);
    }
    fs.writeFileSync(path.join(crmIcons, 'favicon-32x32.png'), await squareIcon(helix, 32));
    console.log(`\n-> ${crmIcons}\n  icon-{72..512}x*.png, favicon-32x32.png`);
  }

  // CRM maskable icons (white field, safe-zone padding) for the PWA manifest.
  const crmPublic = path.join(ROOT, 'apps/crm/public');
  for (const sz of [192, 512]) {
    fs.writeFileSync(path.join(crmPublic, `icon-${sz}-maskable.png`), await maskableIcon(helix, sz));
  }
  console.log(`\n-> ${crmPublic}\n  icon-192-maskable.png, icon-512-maskable.png`);

  console.log('\nDone.');
})().catch((e) => { console.error(e); process.exit(1); });
