/**
 * Deno copy of packages/lib ACH vault encrypt. Keep the v1: blob format identical.
 * Never log plaintext routing/account.
 */

const IV_LENGTH = 12;
const PREFIX = 'v1:';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function isAbaRoutingNumber(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + 1 * (d[2] + d[5] + d[8]);
  return sum % 10 === 0;
}

async function vaultKey(): Promise<CryptoKey> {
  const raw = (Deno.env.get('ACH_VAULT_KEY') || Deno.env.get('ENCRYPTION_KEY') || '').trim();
  if (!raw) throw new Error('ACH_VAULT_KEY or ENCRYPTION_KEY is required to store ACH details');
  let bytes: Uint8Array;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    bytes = Uint8Array.from(raw.match(/.{2}/g)!.map((hex) => parseInt(hex, 16)));
  } else {
    bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
  }
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt']);
}

export async function encryptAchBankDetails(input: {
  routingNumber: string;
  accountNumber: string;
  accountType?: string | null;
}): Promise<{ ciphertext: string; last4: string; accountType: 'checking' | 'savings' }> {
  const routingNumber = digitsOnly(input.routingNumber || '');
  const accountNumber = digitsOnly(input.accountNumber || '');
  if (!isAbaRoutingNumber(routingNumber)) throw new Error('Routing number must be a valid 9-digit ABA.');
  if (accountNumber.length < 5 || accountNumber.length > 17) {
    throw new Error('Account number must be 5–17 digits.');
  }
  if (accountNumber.length <= 4 || /^0+\d{1,4}$/.test(accountNumber)) {
    throw new Error('Full account number is required. Last4 is not enough.');
  }
  const rawType = (input.accountType || 'checking').toLowerCase();
  if (rawType === 'businesschecking' || rawType === 'business_checking') {
    throw new Error('PPD NACHA files only support consumer checking or savings.');
  }
  const accountType = rawType === 'savings' ? 'savings' : 'checking';
  const key = await vaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const payload = new TextEncoder().encode(JSON.stringify({
    v: 1,
    r: routingNumber,
    a: accountNumber,
    t: accountType,
  }));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, payload),
  );
  const tag = encrypted.slice(-16);
  const body = encrypted.slice(0, -16);
  const combined = new Uint8Array(IV_LENGTH + tag.length + body.length);
  combined.set(iv, 0);
  combined.set(tag, IV_LENGTH);
  combined.set(body, IV_LENGTH + tag.length);
  let binary = '';
  combined.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return {
    ciphertext: PREFIX + btoa(binary),
    last4: accountNumber.slice(-4),
    accountType,
  };
}

export async function persistAchVault(
  supabase: { from: (table: string) => any },
  organizationId: string,
  paymentProfileId: string,
  input: { routingNumber: string; accountNumber: string; accountType?: string | null },
): Promise<void> {
  const { ciphertext } = await encryptAchBankDetails(input);
  const { error } = await supabase.from('system_settings').upsert(
    {
      organization_id: organizationId,
      setting_key: `ach_vault.${paymentProfileId}`,
      setting_value: ciphertext,
      setting_type: 'encrypted',
      category: 'billing',
      subcategory: 'ach_vault',
      label: 'ACH member vault (encrypted)',
      description: 'AES-256-GCM member routing/account. Decrypt only at NACHA export.',
      is_active: true,
      is_sensitive: true,
      is_required: false,
      last_changed_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,setting_key' },
  );
  if (error) throw new Error(error.message);
}
