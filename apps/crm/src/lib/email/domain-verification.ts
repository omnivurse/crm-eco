import dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);
const resolveMx = promisify(dns.resolveMx);

// ============================================================================
// Types
// ============================================================================

export interface DnsRecord {
  type: 'TXT' | 'CNAME' | 'MX';
  name: string;
  value: string;
  purpose: string;
  verified: boolean;
}

export interface VerificationResult {
  dkim: boolean;
  spf: boolean;
  dmarc: boolean;
  mx: boolean;
  allVerified: boolean;
  records: DnsRecord[];
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function generateDkimSelector(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `crm${timestamp}${random}`;
}

export function generateVerificationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// ============================================================================
// DNS Record Generation
// ============================================================================

export function getDnsRecords(
  domain: string,
  dkimSelector: string,
  verificationToken: string
): DnsRecord[] {
  // Email provider subdomain (would be configured based on your email provider)
  const emailProvider = process.env.EMAIL_PROVIDER_DOMAIN || 'sendgrid.net';

  return [
    {
      type: 'TXT',
      name: `_crm-verify.${domain}`,
      value: `crm-verify=${verificationToken}`,
      purpose: 'Domain ownership verification',
      verified: false,
    },
    {
      type: 'CNAME',
      name: `${dkimSelector}._domainkey.${domain}`,
      value: `${dkimSelector}.dkim.${emailProvider}`,
      purpose: 'DKIM email signing',
      verified: false,
    },
    {
      type: 'TXT',
      name: domain,
      value: `v=spf1 include:${emailProvider} ~all`,
      purpose: 'SPF record for email authorization',
      verified: false,
    },
    {
      type: 'TXT',
      name: `_dmarc.${domain}`,
      value: 'v=DMARC1; p=none; rua=mailto:dmarc@' + domain,
      purpose: 'DMARC policy for email authentication',
      verified: false,
    },
  ];
}

// ============================================================================
// DNS Verification
// ============================================================================

async function checkTxtRecord(hostname: string, expectedValue: string): Promise<boolean> {
  try {
    const records = await resolveTxt(hostname);
    const flatRecords = records.map(r => r.join(''));
    return flatRecords.some(r => r.includes(expectedValue) || expectedValue.includes(r));
  } catch (error) {
    // ENOTFOUND or ENODATA means record doesn't exist
    return false;
  }
}

async function checkCnameRecord(hostname: string, expectedValue: string): Promise<boolean> {
  try {
    const records = await resolveCname(hostname);
    return records.some(r => r.toLowerCase() === expectedValue.toLowerCase());
  } catch (error) {
    return false;
  }
}

async function checkMxRecord(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch (error) {
    return false;
  }
}

export async function verifyDomain(
  domain: string,
  dkimSelector: string,
  verificationToken: string
): Promise<VerificationResult> {
  const emailProvider = process.env.EMAIL_PROVIDER_DOMAIN || 'sendgrid.net';
  const records = getDnsRecords(domain, dkimSelector, verificationToken);

  try {
    // Check verification TXT record
    const verifyHostname = `_crm-verify.${domain}`;
    const verifyValue = `crm-verify=${verificationToken}`;
    const verificationVerified = await checkTxtRecord(verifyHostname, verifyValue);
    records[0].verified = verificationVerified;

    // Check DKIM CNAME
    const dkimHostname = `${dkimSelector}._domainkey.${domain}`;
    const dkimValue = `${dkimSelector}.dkim.${emailProvider}`;
    const dkimVerified = await checkCnameRecord(dkimHostname, dkimValue);
    records[1].verified = dkimVerified;

    // Check SPF TXT record
    const spfVerified = await checkTxtRecord(domain, `include:${emailProvider}`);
    records[2].verified = spfVerified;

    // Check DMARC TXT record
    const dmarcHostname = `_dmarc.${domain}`;
    const dmarcVerified = await checkTxtRecord(dmarcHostname, 'v=DMARC1');
    records[3].verified = dmarcVerified;

    // Check MX record exists
    const mxVerified = await checkMxRecord(domain);

    const allVerified = verificationVerified && dkimVerified && spfVerified && dmarcVerified;

    return {
      dkim: dkimVerified,
      spf: spfVerified,
      dmarc: dmarcVerified,
      mx: mxVerified,
      allVerified,
      records,
    };
  } catch (error) {
    console.error('DNS verification error:', error);
    return {
      dkim: false,
      spf: false,
      dmarc: false,
      mx: false,
      allVerified: false,
      records,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

// ============================================================================
// Status Helpers
// ============================================================================

export function getDomainStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'verified':
      return { label: 'Verified', color: 'green' };
    case 'verifying':
      return { label: 'Verifying...', color: 'blue' };
    case 'pending':
      return { label: 'Pending Setup', color: 'amber' };
    case 'failed':
      return { label: 'Verification Failed', color: 'red' };
    default:
      return { label: 'Unknown', color: 'slate' };
  }
}
