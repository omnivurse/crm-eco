#!/usr/bin/env node

/**
 * PWA Icon Generator Script
 * Generates all required PWA icon sizes from a source image
 * 
 * Usage: node scripts/generate-pwa-icons.mjs <source-image> <output-dir>
 * Example: node scripts/generate-pwa-icons.mjs apps/crm/public/logo.png apps/crm/public/icons
 * 
 * Requirements: sharp (npm install sharp)
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// PWA icon sizes (all required for full PWA support)
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Apple splash screen sizes (optional but recommended)
const SPLASH_SIZES = [
  { width: 2048, height: 2732, name: 'apple-splash-2048-2732.png' },  // 12.9" iPad Pro
  { width: 1668, height: 2388, name: 'apple-splash-1668-2388.png' },  // 11" iPad Pro
  { width: 1536, height: 2048, name: 'apple-splash-1536-2048.png' },  // 9.7" iPad
  { width: 1125, height: 2436, name: 'apple-splash-1125-2436.png' },  // iPhone X/XS
  { width: 1242, height: 2688, name: 'apple-splash-1242-2688.png' },  // iPhone XS Max
  { width: 828, height: 1792, name: 'apple-splash-828-1792.png' },    // iPhone XR
  { width: 1242, height: 2208, name: 'apple-splash-1242-2208.png' },  // iPhone 8 Plus
  { width: 750, height: 1334, name: 'apple-splash-750-1334.png' },    // iPhone 8
  { width: 640, height: 1136, name: 'apple-splash-640-1136.png' },    // iPhone SE
];

/**
 * Generate PWA icons from source image
 */
async function generateIcons(sourcePath, outputDir) {
  // Validate source exists
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source image not found: ${sourcePath}`);
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }

  const image = sharp(sourcePath);
  const metadata = await image.metadata();
  
  console.log(`\n🖼️  Source: ${sourcePath}`);
  console.log(`   Dimensions: ${metadata.width}x${metadata.height}`);
  console.log(`   Format: ${metadata.format}\n`);

  // Check if source is large enough
  const maxSize = Math.max(...ICON_SIZES);
  if (metadata.width < maxSize || metadata.height < maxSize) {
    console.warn(`⚠️  Warning: Source image is smaller than ${maxSize}x${maxSize}px`);
    console.warn(`   This may result in blurry icons at larger sizes.\n`);
  }

  console.log('🔄 Generating icons...\n');

  // Generate each size
  for (const size of ICON_SIZES) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    
    await sharp(sourcePath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
      })
      .png()
      .toFile(outputPath);

    console.log(`   ✅ icon-${size}x${size}.png`);
  }

  // Generate favicon.ico (optional)
  const faviconPath = path.join(outputDir, '..', 'favicon.ico');
  await sharp(sourcePath)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toFile(path.join(outputDir, 'favicon-32x32.png'));
  console.log(`   ✅ favicon-32x32.png`);

  console.log(`\n✨ Generated ${ICON_SIZES.length + 1} icons in ${outputDir}`);
  
  // Print manifest.json icon array for reference
  console.log('\n📋 Add this to your manifest.json:\n');
  console.log('"icons": [');
  ICON_SIZES.forEach((size, i) => {
    const comma = i < ICON_SIZES.length - 1 ? ',' : '';
    console.log(`  {
    "src": "/icons/icon-${size}x${size}.png",
    "sizes": "${size}x${size}",
    "type": "image/png",
    "purpose": "maskable any"
  }${comma}`);
  });
  console.log(']');
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
PWA Icon Generator
==================

Usage: node scripts/generate-pwa-icons.mjs <source-image> <output-dir>

Examples:
  node scripts/generate-pwa-icons.mjs apps/crm/public/logo.png apps/crm/public/icons
  node scripts/generate-pwa-icons.mjs apps/portal/logo.svg apps/portal/public/icons

Requirements:
  - Node.js 18+
  - sharp package (npm install sharp)

Recommended source image:
  - At least 512x512 pixels
  - Square aspect ratio
  - PNG or SVG format
  - Transparent background for best results
`);
    process.exit(1);
  }

  const [sourcePath, outputDir] = args;
  
  try {
    await generateIcons(sourcePath, outputDir);
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

main();
