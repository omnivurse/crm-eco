/**
 * DATA WALK v1 — types for the deterministic data-quality SQL engine.
 *
 * Identity (rule keys, labels, severity tiers) and THE score formula live in
 * `./score.ts` — the single source of truth shared with the prod audit script
 * and the ratchet test. This file adds the types for the SQL side: declared
 * queries plus an injected executor, so the same catalog runs against the
 * local stack (tests), prod (audit script) and the service-role conduit
 * (Data Health route) without this module knowing about clients or keys.
 *
 * PII DISCIPLINE: rule output carries record IDs and counts ONLY — never
 * names, phones, emails, or DOBs. Sample IDs are capped at 20 per rule.
 */

import type { RuleDefinition } from './score';

/** Extra headline number some rules carry (e.g. dismissed duplicate pairs). */
export interface RuleContext {
  label: string;
  value: number;
}

/**
 * One executable rule: catalog identity plus its org-pinned, read-only SQL.
 * `buildSql(orgId)` returns a single SELECT yielding rows shaped
 * `{ id: text | null, total: number }` — `total` is the full match count
 * (window count), `id` rows are the sample (LIMIT 20 in SQL; the engine caps
 * again defensively).
 */
export interface RuleDef extends RuleDefinition {
  /**
   * OWNER-FACING copy, rendered verbatim on the card. Plain language: no table
   * or column names, no `cron`, no `NOT NULL`. Enforced by
   * `describe-vocabulary.test.ts`.
   */
  describe: string;
  /**
   * ENGINEER-FACING note on why the SQL is shaped the way it is. Deliberately
   * NOT part of `RuleSweepResult`, so it cannot reach the API payload or the
   * page — `normalizeRuleRows` builds the result field by field.
   */
  rationale?: string;
  buildSql(orgId: string): string;
  /** Optional context metric: SQL returning one row `{ value: number }`. */
  buildContextSql?(orgId: string): string;
  contextLabel?: string;
}

/** Normalized outcome of one rule run — the page's DataHealthRule shape. */
export interface RuleSweepResult extends RuleDefinition {
  describe: string;
  count: number;
  /** Record ids only (never PII), capped at 20. */
  sampleIds: string[];
  context?: RuleContext;
}

/** A rule that could not run (schema drift, timeout, …) — shown, never silently skipped. */
export interface RuleError {
  key: string;
  message: string;
}

/** The versioned sweep report — the data-quality twin of walk.json. */
export interface DataHealthReport {
  version: 1;
  formulaVersion: number;
  generatedAt: string;
  orgId: string;
  /** Active (non-deleted) crm_records in the org — the book the score describes. */
  bookSize: number;
  /** Composite 0–100 score, one decimal — computeScore over the rule counts. */
  score: number;
  rules: RuleSweepResult[];
  errors: RuleError[];
}

/**
 * Injected execution seam. Receives one read-only SELECT statement and
 * returns its rows as plain objects. Implementations: psql child process
 * (local runner), service-role client (route).
 */
export type SqlExecutor = (sql: string) => Promise<Array<Record<string, unknown>>>;
