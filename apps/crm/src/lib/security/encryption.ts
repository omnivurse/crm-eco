/**
 * PHI Encryption Utilities
 * 
 * HIPAA-compliant encryption for Protected Health Information (PHI)
 * Uses AES-256-GCM for field-level encryption of sensitive data
 * 
 * Encrypted fields: SSN, DOB, medical IDs, etc.
 */

// For server-side encryption (API routes)
// Note: Browser crypto API used for client-side operations

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get the PHI encryption key from environment
 * In production, this should come from a KMS
 */
function getEncryptionKey(): string {
    const key = process.env.PHI_ENCRYPTION_KEY;
    if (!key) {
        throw new Error('PHI_ENCRYPTION_KEY environment variable is not set');
    }
    if (key.length !== 64) {
        throw new Error('PHI_ENCRYPTION_KEY must be 64 hex characters (256 bits)');
    }
    return key;
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Generate a random IV for encryption
 */
function generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Encrypt PHI data (server-side using Node.js crypto)
 * Returns: base64(iv + authTag + ciphertext)
 */
export async function encryptPHI(plaintext: string): Promise<string> {
    if (!plaintext) return '';

    // Use Node.js crypto for server-side
    if (typeof window === 'undefined') {
        const crypto = await import('crypto');
        const key = Buffer.from(getEncryptionKey(), 'hex');
        const iv = crypto.randomBytes(IV_LENGTH);

        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(plaintext, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Combine: iv (12) + authTag (16) + ciphertext
        const combined = Buffer.concat([iv, authTag, encrypted]);
        return combined.toString('base64');
    }

    // Browser WebCrypto (for client-side preview/display)
    throw new Error('PHI encryption must be performed server-side');
}

/**
 * Decrypt PHI data (server-side using Node.js crypto)
 */
export async function decryptPHI(ciphertext: string): Promise<string> {
    if (!ciphertext) return '';

    // Use Node.js crypto for server-side
    if (typeof window === 'undefined') {
        const crypto = await import('crypto');
        const key = Buffer.from(getEncryptionKey(), 'hex');
        const combined = Buffer.from(ciphertext, 'base64');

        // Extract: iv (12) + authTag (16) + ciphertext
        const iv = combined.subarray(0, IV_LENGTH);
        const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    }

    throw new Error('PHI decryption must be performed server-side');
}

/**
 * Hash a value for comparison (e.g., backup codes)
 * Uses SHA-256
 */
export async function hashValue(value: string): Promise<string> {
    if (typeof window === 'undefined') {
        const crypto = await import('crypto');
        return crypto.createHash('sha256').update(value).digest('hex');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Mask PHI for display (e.g., SSN: ***-**-1234)
 */
export function maskSSN(ssn: string): string {
    if (!ssn || ssn.length < 4) return '***-**-****';
    const last4 = ssn.replace(/\D/g, '').slice(-4);
    return `***-**-${last4}`;
}

/**
 * Mask DOB for display (e.g., MM/DD/YYYY -> XX/XX/1990)
 */
export function maskDOB(dob: string): string {
    if (!dob) return '**/**/****';
    const date = new Date(dob);
    if (isNaN(date.getTime())) return '**/**/****';
    return `**/**/${date.getFullYear()}`;
}

/**
 * Mask phone number (e.g., (***) ***-1234)
 */
export function maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return '(***) ***-****';
    const digits = phone.replace(/\D/g, '');
    const last4 = digits.slice(-4);
    return `(***) ***-${last4}`;
}

/**
 * Mask email (e.g., j***@example.com)
 */
export function maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***.***';
    const [local, domain] = email.split('@');
    const maskedLocal = local.charAt(0) + '***';
    return `${maskedLocal}@${domain}`;
}

/**
 * PHI field identifiers for audit logging
 */
export const PHI_FIELDS = {
    SSN: 'ssn',
    SSN_LAST4: 'ssn_last4',
    DOB: 'date_of_birth',
    MEMBER_ID: 'member_id',
    MEDICAL_RECORD: 'medical_record_number',
    PHONE: 'phone',
    EMAIL: 'email',
    ADDRESS: 'address',
    FULL_NAME: 'full_name',
    DEPENDENTS: 'dependents',
    PLAN_INFO: 'plan_information',
    PAYMENT_INFO: 'payment_information',
} as const;

export type PHIFieldType = (typeof PHI_FIELDS)[keyof typeof PHI_FIELDS];

/**
 * Check if a field is PHI
 */
export function isPHIField(fieldName: string): boolean {
    return Object.values(PHI_FIELDS).includes(fieldName as PHIFieldType);
}

/**
 * Get list of PHI fields being accessed from a data object
 */
export function identifyPHIFields(data: Record<string, unknown>): string[] {
    return Object.keys(data).filter(key => isPHIField(key));
}
