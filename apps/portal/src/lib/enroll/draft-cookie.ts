import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'enroll_draft';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface EnrollmentDraft {
  draftId: string;
  organizationId: string;
  slug: string;
  createdAt: number;
  data: Record<string, unknown>;
}

/**
 * Sign a JSON payload using ENROLL_DRAFT_SECRET. Format: base64url(payload).hmac
 */
export function signDraft(draft: EnrollmentDraft): string {
  const secret = process.env.ENROLL_DRAFT_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('ENROLL_DRAFT_SECRET not configured');

  const payload = Buffer.from(JSON.stringify(draft)).toString('base64url');
  const hmac = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${hmac}`;
}

/**
 * Verify and parse a signed draft cookie value.
 */
export function verifyDraft(cookieValue: string): EnrollmentDraft | null {
  const secret = process.env.ENROLL_DRAFT_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) return null;

  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  const [payload, providedHmac] = parts;

  const expectedHmac = createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    const a = Buffer.from(providedHmac, 'base64url');
    const b = Buffer.from(expectedHmac, 'base64url');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    const draft = JSON.parse(json) as EnrollmentDraft;
    const ageMs = Date.now() - draft.createdAt;
    if (ageMs > MAX_AGE_SECONDS * 1000) return null;
    return draft;
  } catch {
    return null;
  }
}

/**
 * Read the draft cookie from a NextRequest.
 */
export function readDraftFromRequest(request: NextRequest): EnrollmentDraft | null {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return verifyDraft(cookie.value);
}

/**
 * Set a signed draft cookie on a NextResponse.
 */
export function setDraftCookie(response: NextResponse, draft: EnrollmentDraft) {
  const value = signDraft(draft);
  response.cookies.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });
}

/**
 * Clear the draft cookie.
 */
export function clearDraftCookie(response: NextResponse) {
  response.cookies.delete(COOKIE_NAME);
}

export const DRAFT_COOKIE_NAME = COOKIE_NAME;
