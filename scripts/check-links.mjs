#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routes = [
  '/',
  '/login',
  '/dashboard',
  '/tickets',
  '/tickets/new',
  '/requests',
  '/catalog',
  '/kb',
  '/problems',
  '/analytics',
  '/collaboration',
  '/reports',
  '/admin',
  '/admin/users',
  '/admin/workflows',
  '/admin/settings',
  '/admin/sla-insights',
  '/admin/audit',
  '/admin/staff-logs',
  '/admin/chat',
  '/admin/health',
];

const srcDir = path.join(__dirname, '..', 'src');

async function findHrefPlaceholders(dir) {
  const placeholders = [];

  async function scan(directory) {
    const files = await fs.readdir(directory, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(directory, file.name);

      if (file.isDirectory()) {
        if (!file.name.startsWith('.') && file.name !== 'node_modules') {
          await scan(fullPath);
        }
      } else if (file.name.endsWith('.tsx') || file.name.endsWith('.jsx')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (line.includes('href="#"') || line.includes("href='#'")) {
            placeholders.push({
              file: path.relative(srcDir, fullPath),
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      }
    }
  }

  await scan(dir);
  return placeholders;
}

async function checkLinks() {
  console.log('🔍 Checking for placeholder links...\n');

  const placeholders = await findHrefPlaceholders(srcDir);

  if (placeholders.length === 0) {
    console.log('✅ No placeholder links (href="#") found!');
    console.log('\n📋 Known routes:');
    routes.forEach(route => console.log(`  ✓ ${route}`));
    return 0;
  }

  console.log(`❌ Found ${placeholders.length} placeholder link(s):\n`);
  placeholders.forEach(({ file, line, content }) => {
    console.log(`  ${file}:${line}`);
    console.log(`    ${content}\n`);
  });

  return 1;
}

checkLinks()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
