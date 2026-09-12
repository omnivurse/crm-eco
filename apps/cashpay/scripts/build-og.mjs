import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const logoPath = path.join(dir, 'logo.png');
const out = path.join(dir, 'og.png');

const logo = await sharp(logoPath)
  .resize({ width: 520, height: 210, fit: 'inside' })
  .png()
  .toBuffer();

const svg = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#F3FAFB"/>
  <rect width="1200" height="14" fill="#3B145B"/>
  <rect y="616" width="1200" height="8" fill="#1088A2"/>
  <rect y="608" width="1200" height="8" fill="#AC641F"/>
  <text x="80" y="360" font-family="Georgia, serif" font-size="72" font-weight="700" fill="#3B145B">Fair&#160;for&#160;All.</text>
  <text x="80" y="410" font-family="Arial, sans-serif" font-size="22" fill="#0C6F85">CASH&#160;PAY&#160;ADVOCATE</text>
  <text x="80" y="560" font-family="Arial, sans-serif" font-size="18" fill="#3B145B">cashpay.doublehelixhub.com</text>
</svg>`);

await sharp(svg)
  .composite([{ input: logo, left: 80, top: 70 }])
  .png()
  .toFile(out);

console.log('Wrote', out, fs.statSync(out).size);
