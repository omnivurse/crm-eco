/** Merge the run ledger into walk.json and validate it against report/walk-schema.json. */
import fs from 'node:fs';
import path from 'node:path';
import { WALK_ROOT } from './env';
import { buildWalkJson, formatSummary } from './walk-report';

export default async function globalTeardown(): Promise<void> {
  const dir = process.env.WALK_RUN_DIR;
  if (!dir || !fs.existsSync(path.join(dir, 'env.json'))) {
    console.warn('[walk] no run dir / env.json — global-setup failed before login; no walk.json written');
    return;
  }
  const { file, doc, errors } = buildWalkJson(dir);
  fs.writeFileSync(path.join(WALK_ROOT, 'latest.txt'), `${dir}\n`);
  console.log(`\n[walk] ${formatSummary(doc)}`);
  console.log(`[walk] wrote ${file}`);
  if (errors.length > 0) {
    throw new Error(`walk.json failed schema validation:\n  ${errors.join('\n  ')}`);
  }
}
