/** Builds and validates walk.json from the per-run ledger files (EV-4). */
import fs from 'node:fs';
import path from 'node:path';
import { WALK_SCHEMA_PATH } from './env';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

interface Schema {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
  enum?: Json[];
  minimum?: number;
  minLength?: number;
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number' && Number.isInteger(v)) return 'integer';
  return typeof v;
}

/** Minimal draft-07 subset validator — enough for walk-schema.json; no deps. */
export function validateAgainstSchema(value: unknown, schema: Schema, at = '$', errors: string[] = []): string[] {
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    const ok = allowed.some((t) => t === actual || (t === 'number' && actual === 'integer'));
    if (!ok) {
      errors.push(`${at}: expected ${allowed.join('|')}, got ${actual}`);
      return errors;
    }
  }
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    errors.push(`${at}: ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${at}: ${value} < minimum ${schema.minimum}`);
  }
  if (typeof value === 'string' && schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push(`${at}: string shorter than ${schema.minLength}`);
  }
  if (typeOf(value) === 'object' && schema.properties) {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) errors.push(`${at}.${key}: required`);
    }
    for (const [key, v] of Object.entries(obj)) {
      const sub = schema.properties[key];
      if (!sub) {
        if (schema.additionalProperties === false) errors.push(`${at}.${key}: not allowed`);
        continue;
      }
      validateAgainstSchema(v, sub, `${at}.${key}`, errors);
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => validateAgainstSchema(item, schema.items as Schema, `${at}[${i}]`, errors));
  }
  return errors;
}

function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

export interface WalkEnv {
  baseURL: string;
  supabaseUrl: string;
  navProfile: 'full' | 'simple' | 'unknown';
  layoutV2: boolean;
  viewport: string;
  project: string;
  role: 'operator' | 'admin' | 'viewer';
}

export interface WalkJson {
  commit: string;
  startedAt: string;
  finishedAt: string;
  env: WalkEnv;
  traps: Array<{ name: string; pass: boolean; detail: string; phase?: string; project?: string }>;
  tasks: Array<Record<string, unknown>>;
}

/** Merge env.json + traps.jsonl + tasks.jsonl into walk.json, validate, write. */
export function buildWalkJson(dir: string, finishedAt = new Date().toISOString()): { file: string; doc: WalkJson; errors: string[] } {
  const envFile = path.join(dir, 'env.json');
  if (!fs.existsSync(envFile)) throw new Error(`walk-report: ${envFile} missing — global-setup did not run`);
  const head = JSON.parse(fs.readFileSync(envFile, 'utf8')) as { commit: string; startedAt: string; env: WalkEnv };
  const doc: WalkJson = {
    commit: head.commit,
    startedAt: head.startedAt,
    finishedAt,
    env: head.env,
    traps: readJsonl(path.join(dir, 'traps.jsonl')),
    tasks: readJsonl(path.join(dir, 'tasks.jsonl')),
  };
  const schema = JSON.parse(fs.readFileSync(WALK_SCHEMA_PATH, 'utf8')) as Schema;
  const errors = validateAgainstSchema(doc, schema);
  const file = path.join(dir, 'walk.json');
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
  return { file, doc, errors };
}

export function formatSummary(doc: WalkJson): string {
  const lines: string[] = [];
  lines.push(`walk.json · commit ${doc.commit.slice(0, 8)} · ${doc.env.baseURL} → ${doc.env.supabaseUrl} · nav=${doc.env.navProfile} · v2=${doc.env.layoutV2} · role=${doc.env.role}`);
  lines.push('traps:');
  for (const t of doc.traps) lines.push(`  ${t.pass ? 'PASS' : 'FAIL'}  ${t.name.padEnd(20)} ${t.project ? `[${t.project}] ` : ''}${t.detail}`);
  lines.push('tasks:');
  for (const t of doc.tasks) {
    const r = t as { id: string; project?: string; clicks: number; keypresses: number; budget: number; ms: number; pass: boolean };
    lines.push(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id.padEnd(20)} [${r.project ?? '-'}] clicks=${r.clicks}/${r.budget} keys=${r.keypresses} ${r.ms}ms`);
  }
  return lines.join('\n');
}
