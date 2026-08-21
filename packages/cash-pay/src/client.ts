import 'server-only';

import type {
  GetRateDataPagedInput,
  GetRateDataPagedResult,
  HclPagedResponse,
} from './types';
import { parseHclPagedBody, userMessageForCode, defaultSpecialty } from './normalize';
import { buildCacheKey, getCached, setCached } from './cache';

const DEFAULT_BASE = 'https://healthcostlabsapp-hclapi.azurewebsites.net';
const PATH = '/api/Expose/GetRateDataPaged';
const TIMEOUT_MS = 15_000;

export interface HclClientConfig {
  baseUrl?: string;
  secretKey?: string;
  fetchImpl?: typeof fetch;
  /** Skip cache (tests). */
  skipCache?: boolean;
}

function readConfig(overrides?: HclClientConfig): {
  baseUrl: string;
  secretKey: string;
  fetchImpl: typeof fetch;
  skipCache: boolean;
} {
  const baseUrl = (overrides?.baseUrl || process.env.HCL_API_BASE_URL || DEFAULT_BASE).replace(
    /\/$/,
    '',
  );
  const secretKey =
    overrides && Object.prototype.hasOwnProperty.call(overrides, 'secretKey')
      ? overrides.secretKey || ''
      : process.env.HCL_SECRET_KEY || '';
  return {
    baseUrl,
    secretKey,
    fetchImpl: overrides?.fetchImpl || fetch,
    skipCache: Boolean(overrides?.skipCache),
  };
}

function buildMultipart(fields: Record<string, string>): {
  body: Blob;
  contentType: string;
} {
  const boundary = `----CashPayBoundary${Date.now().toString(36)}`;
  const chunks: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    );
  }
  chunks.push(`--${boundary}--\r\n`);
  return {
    body: new Blob([chunks.join('')], { type: `multipart/form-data; boundary=${boundary}` }),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function postOnce(
  url: string,
  secretKey: string,
  fields: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<{ status: number; json: HclPagedResponse }> {
  const { body, contentType } = buildMultipart(fields);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        SecretKey: secretKey,
      },
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    let json: HclPagedResponse = {};
    try {
      json = JSON.parse(text) as HclPagedResponse;
    } catch {
      json = { success: false, msg: text.slice(0, 200) || `HTTP ${res.status}` };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call HCL GetRateDataPaged. Never logs the secret key.
 * Retries once on 5xx / network abort.
 */
export async function getRateDataPaged(
  input: GetRateDataPagedInput,
  overrides?: HclClientConfig,
): Promise<GetRateDataPagedResult> {
  const cfg = readConfig(overrides);
  if (!cfg.secretKey) {
    return {
      ok: false,
      code: 'misconfigured',
      message: userMessageForCode('misconfigured'),
    };
  }

  const stateName = input.stateName?.trim();
  const msaName = input.msaName?.trim();
  if (!stateName || !msaName) {
    return {
      ok: false,
      code: 'invalid_input',
      message: userMessageForCode('invalid_input'),
    };
  }

  const specialty = (input.specialty || defaultSpecialty()).trim();
  const pageNumber = Math.max(1, Math.floor(input.pageNumber || 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize || 25)));

  const cacheKey = buildCacheKey({
    stateName,
    msaName,
    specialty,
    procedureCode: input.procedureCode,
    category: input.category,
    hospitalId: input.hospitalId,
    id: input.id,
    pageNumber,
    pageSize,
  });

  if (!cfg.skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  const fields: Record<string, string> = {
    stateName,
    msaName,
    specialty,
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
    secretkey: cfg.secretKey,
  };
  if (input.procedureCode?.trim()) fields.procedureCode = input.procedureCode.trim();
  if (input.category?.trim()) fields.category = input.category.trim();
  if (input.hospitalId != null) fields.hospitalId = String(input.hospitalId);
  if (input.id?.trim()) fields.id = input.id.trim();

  const url = `${cfg.baseUrl}${PATH}`;

  let lastError: GetRateDataPagedResult | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { status, json } = await postOnce(url, cfg.secretKey, fields, cfg.fetchImpl);
      const parsed = parseHclPagedBody(json, status);
      if (!parsed.ok) {
        const fail: GetRateDataPagedResult = {
          ok: false,
          code: parsed.code || 'upstream',
          message: parsed.message || userMessageForCode(parsed.code || 'upstream'),
        };
        // Cache invalid_key / no_msa briefly so we don't burn the meter
        if (fail.code === 'invalid_key' || fail.code === 'no_msa_mapping') {
          setCached(cacheKey, fail, 60_000);
        }
        return fail;
      }
      const success: GetRateDataPagedResult = {
        ok: true,
        pageNumber: parsed.pageNumber,
        pageSize: parsed.pageSize,
        totalCount: parsed.totalCount,
        hasMore: parsed.hasMore,
        rates: parsed.rates,
        source: 'hcl',
      };
      setCached(cacheKey, success);
      return success;
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      lastError = {
        ok: false,
        code: 'upstream',
        message: userMessageForCode('upstream'),
      };
      if (!aborted && attempt === 0) continue;
      break;
    }
  }

  return lastError || {
    ok: false,
    code: 'upstream',
    message: userMessageForCode('upstream'),
  };
}
