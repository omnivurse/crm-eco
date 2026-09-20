/**
 * Phase 2 ACH vault — encrypt member routing/account at collection time.
 *
 * NMI Customer Vault and Authorize.Net CIM return last4 only. They cannot
 * hydrate a NACHA file. Capture the numbers while we still have them, store
 * AES-256-GCM ciphertext in system_settings (is_sensitive), decrypt only on
 * the server at export. Never log plaintext. Never invent routing/account.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { digitsOnly, isAbaRoutingNumber, isLast4OnlyAccount } from './nacha';
import type { NachaAccountType } from './nacha';

export const ACH_VAULT_SETTING_PREFIX = 'ach_vault.';
export const ACH_VAULT_KEY_ENV = ['ACH_VAULT_KEY', 'ENCRYPTION_KEY'] as const;

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const CIPHER_PREFIX = 'v1:';

export class AchVaultError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AchVaultError';
    this.code = code;
  }
}

export interface AchBankDetails {
  routingNumber: string;
  accountNumber: string;
  accountType: NachaAccountType;
  last4: string;
}

export function achVaultSettingKey(paymentProfileId: string): string {
  return `${ACH_VAULT_SETTING_PREFIX}${paymentProfileId}`;
}

export function resolveAchVaultKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = (env.ACH_VAULT_KEY || env.ENCRYPTION_KEY || '').trim();
  if (!raw) {
    throw new AchVaultError(
      'ACH_VAULT_KEY_MISSING',
      'ACH vault key is not configured. Set ACH_VAULT_KEY or ENCRYPTION_KEY.',
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return createHash('sha256').update(raw).digest();
}

export function normalizeAchBankDetails(input: {
  routingNumber: string;
  accountNumber: string;
  accountType?: string | null;
}): AchBankDetails {
  const routingNumber = digitsOnly(input.routingNumber || '');
  const accountNumber = digitsOnly(input.accountNumber || '');
  if (!isAbaRoutingNumber(routingNumber)) {
    throw new AchVaultError('INVALID_ROUTING', 'Routing number must be a valid 9-digit ABA.');
  }
  if (accountNumber.length < 5 || accountNumber.length > 17) {
    throw new AchVaultError('INVALID_ACCOUNT', 'Account number must be 5–17 digits.');
  }
  if (isLast4OnlyAccount(accountNumber)) {
    throw new AchVaultError('LAST4_ONLY', 'Full account number is required. Last4 is not enough.');
  }
  const rawType = (input.accountType || 'checking').toLowerCase();
  if (rawType === 'businesschecking' || rawType === 'business_checking') {
    throw new AchVaultError(
      'UNSUPPORTED_ACCOUNT_TYPE',
      'PPD NACHA files only support consumer checking or savings.',
    );
  }
  const accountType: NachaAccountType = rawType === 'savings' ? 'savings' : 'checking';
  return {
    routingNumber,
    accountNumber,
    accountType,
    last4: accountNumber.slice(-4),
  };
}

export function encryptAchBankDetails(
  details: AchBankDetails,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = resolveAchVaultKey(env);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const payload = JSON.stringify({
    v: 1,
    r: details.routingNumber,
    a: details.accountNumber,
    t: details.accountType,
  });
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return CIPHER_PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptAchBankDetails(
  ciphertext: string,
  env: NodeJS.ProcessEnv = process.env,
): AchBankDetails {
  if (!ciphertext || !ciphertext.startsWith(CIPHER_PREFIX)) {
    throw new AchVaultError('INVALID_CIPHERTEXT', 'ACH vault ciphertext is missing or the wrong version.');
  }
  const key = resolveAchVaultKey(env);
  const combined = Buffer.from(ciphertext.slice(CIPHER_PREFIX.length), 'base64');
  if (combined.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new AchVaultError('INVALID_CIPHERTEXT', 'ACH vault ciphertext is truncated.');
  }
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(json) as { r?: string; a?: string; t?: string };
    return normalizeAchBankDetails({
      routingNumber: parsed.r ?? '',
      accountNumber: parsed.a ?? '',
      accountType: parsed.t,
    });
  } catch (error) {
    if (error instanceof AchVaultError) throw error;
    throw new AchVaultError('DECRYPT_FAILED', 'Could not decrypt ACH vault details.');
  }
}

export async function persistAchVault(
  supabase: SupabaseClient,
  organizationId: string,
  paymentProfileId: string,
  input: { routingNumber: string; accountNumber: string; accountType?: string | null },
  changedBy?: string | null,
): Promise<AchBankDetails> {
  const details = normalizeAchBankDetails(input);
  const ciphertext = encryptAchBankDetails(details);
  const { error } = await supabase.from('system_settings').upsert(
    {
      organization_id: organizationId,
      setting_key: achVaultSettingKey(paymentProfileId),
      setting_value: ciphertext,
      setting_type: 'encrypted',
      category: 'billing',
      subcategory: 'ach_vault',
      label: 'ACH member vault (encrypted)',
      description: 'AES-256-GCM member routing/account. Decrypt only at NACHA export.',
      is_active: true,
      is_sensitive: true,
      is_required: false,
      last_changed_by: changedBy ?? null,
      last_changed_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,setting_key' },
  );
  if (error) {
    throw new AchVaultError('PERSIST_FAILED', error.message);
  }
  return details;
}

export async function loadAchVault(
  supabase: SupabaseClient,
  organizationId: string,
  paymentProfileId: string,
): Promise<AchBankDetails | null> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('organization_id', organizationId)
    .eq('setting_key', achVaultSettingKey(paymentProfileId))
    .maybeSingle();
  if (error) {
    throw new AchVaultError('LOAD_FAILED', error.message);
  }
  if (!data?.setting_value) return null;
  return decryptAchBankDetails(data.setting_value);
}

export async function loadAchVaultPresence(
  supabase: SupabaseClient,
  organizationId: string,
  paymentProfileIds: string[],
): Promise<Set<string>> {
  const ids = paymentProfileIds.filter(Boolean);
  if (!ids.length) return new Set();
  const keys = ids.map(achVaultSettingKey);
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_key')
    .eq('organization_id', organizationId)
    .in('setting_key', keys);
  if (error) {
    throw new AchVaultError('LOAD_FAILED', error.message);
  }
  const present = new Set<string>();
  for (const row of data ?? []) {
    const key = (row as { setting_key: string }).setting_key;
    if (key.startsWith(ACH_VAULT_SETTING_PREFIX)) {
      present.add(key.slice(ACH_VAULT_SETTING_PREFIX.length));
    }
  }
  return present;
}
