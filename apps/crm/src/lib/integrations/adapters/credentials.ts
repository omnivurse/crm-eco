/**
 * Credential Encryption Service
 * Securely encrypt and decrypt API keys and tokens at rest
 */

import crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment
 * Should be a 32-byte (256-bit) hex string
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    // In development, use a fallback key (NOT for production!)
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ ENCRYPTION_KEY not set, using development fallback. DO NOT use in production!');
      return crypto.scryptSync('dev-fallback-key', 'salt', KEY_LENGTH);
    }
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // If key is hex-encoded
  if (keyHex.length === 64) {
    return Buffer.from(keyHex, 'hex');
  }

  // If key is a passphrase, derive a key from it
  return crypto.scryptSync(keyHex, 'integration-credentials', KEY_LENGTH);
}

// ============================================================================
// Encryption Functions
// ============================================================================

/**
 * Encrypt a string value
 * Returns base64-encoded encrypted data including IV and auth tag
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return '';
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + encrypted data
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64'),
  ]);

  return combined.toString('base64');
}

/**
 * Decrypt a string value
 * Takes base64-encoded encrypted data including IV and auth tag
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract IV, auth tag, and encrypted data
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt credential');
  }
}

// ============================================================================
// Credential Types
// ============================================================================

export interface EncryptedCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface DecryptedCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  apiSecret?: string;
}

// ============================================================================
// High-Level Credential Functions
// ============================================================================

/**
 * Encrypt all credentials for storage
 */
export function encryptCredentials(credentials: DecryptedCredentials): EncryptedCredentials {
  return {
    accessToken: credentials.accessToken ? encrypt(credentials.accessToken) : undefined,
    refreshToken: credentials.refreshToken ? encrypt(credentials.refreshToken) : undefined,
    apiKey: credentials.apiKey ? encrypt(credentials.apiKey) : undefined,
    apiSecret: credentials.apiSecret ? encrypt(credentials.apiSecret) : undefined,
  };
}

/**
 * Decrypt all credentials for use
 */
export function decryptCredentials(encrypted: EncryptedCredentials): DecryptedCredentials {
  return {
    accessToken: encrypted.accessToken ? decrypt(encrypted.accessToken) : undefined,
    refreshToken: encrypted.refreshToken ? decrypt(encrypted.refreshToken) : undefined,
    apiKey: encrypted.apiKey ? decrypt(encrypted.apiKey) : undefined,
    apiSecret: encrypted.apiSecret ? decrypt(encrypted.apiSecret) : undefined,
  };
}

/**
 * Encrypt a single credential value
 */
export function encryptCredential(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return encrypt(value);
}

/**
 * Decrypt a single credential value
 */
export function decryptCredential(encryptedValue: string | null | undefined): string | null {
  if (!encryptedValue) {
    return null;
  }
  return decrypt(encryptedValue);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a secure random secret (for webhook secrets, etc.)
 */
export function generateSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a value (for comparing webhook signatures, etc.)
 */
export function hashValue(value: string, secret: string, algorithm: 'sha256' | 'sha1' = 'sha256'): string {
  return crypto.createHmac(algorithm, secret).update(value).digest('hex');
}

/**
 * Verify a webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): boolean {
  const expectedSignature = hashValue(payload, secret, algorithm);

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // Buffers have different lengths
    return false;
  }
}

/**
 * Mask a credential for display (show only last 4 characters)
 */
export function maskCredential(credential: string | null | undefined): string {
  if (!credential) {
    return '••••••••';
  }

  if (credential.length <= 8) {
    return '••••••••';
  }

  const visibleLength = 4;
  const maskedLength = credential.length - visibleLength;
  return '•'.repeat(Math.min(maskedLength, 20)) + credential.slice(-visibleLength);
}

/**
 * Check if a credential looks valid (not empty, not placeholder)
 */
export function isValidCredential(credential: string | null | undefined): boolean {
  if (!credential) {
    return false;
  }

  const trimmed = credential.trim();

  // Check for common placeholder values
  const placeholders = [
    'your_api_key',
    'YOUR_API_KEY',
    'xxx',
    'XXX',
    'test',
    'TEST',
    'placeholder',
    'PLACEHOLDER',
  ];

  return trimmed.length > 0 && !placeholders.includes(trimmed);
}
