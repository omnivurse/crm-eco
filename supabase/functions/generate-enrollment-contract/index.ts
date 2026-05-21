/**
 * Generate Enrollment Contract Edge Function
 *
 * Generates a professional PDF enrollment contract for a given enrollment.
 * - Fetches enrollment, member, dependents, product, organization, and advisor data
 * - Builds a multi-page PDF using pdf-lib
 * - Uploads to Supabase Storage (bucket: enrollment-contracts)
 * - Upserts into enrollment_contracts table
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFPage,
  PDFFont,
  RGB,
} from 'https://esm.sh/pdf-lib@1.17.1';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map(s => s.trim());

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes('*') ? '*' :
    (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// ─── Layout Constants ────────────────────────────────────────────────────────

const PAGE_WIDTH = 612;   // US Letter
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const FONT_SIZE_TITLE = 20;
const FONT_SIZE_SECTION = 13;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_SMALL = 8;
const LINE_HEIGHT = 14;
const SECTION_GAP = 24;

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrgBranding {
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
}

interface DrawContext {
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontBold: PDFFont;
  primaryColor: RGB;
  accentColor: RGB;
}

// ─── Color Helpers ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return 'N/A';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return d;
  }
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0.00';
  return `$${Number(amount).toFixed(2)}`;
}

// ─── PDF Drawing Helpers ─────────────────────────────────────────────────────

function ensureSpace(ctx: DrawContext, doc: PDFDocument, needed: number): DrawContext {
  if (ctx.y - needed < MARGIN_BOTTOM) {
    // Add page number footer to current page
    addPageFooter(ctx);
    // Create new page
    const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { ...ctx, page: newPage, y: PAGE_HEIGHT - MARGIN_TOP };
  }
  return ctx;
}

function addPageFooter(ctx: DrawContext) {
  const pages = ctx.page.doc.getPages();
  const pageNum = pages.indexOf(ctx.page) + 1;
  const totalPages = pages.length;
  const footerText = `Page ${pageNum}`;
  ctx.page.drawText(footerText, {
    x: PAGE_WIDTH / 2 - 20,
    y: 30,
    size: FONT_SIZE_SMALL,
    font: ctx.font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

function drawHorizontalLine(ctx: DrawContext, thickness = 0.5, color?: RGB): DrawContext {
  ctx.page.drawLine({
    start: { x: MARGIN_LEFT, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: ctx.y },
    thickness,
    color: color || rgb(0.8, 0.8, 0.8),
  });
  return { ...ctx, y: ctx.y - 8 };
}

function drawSectionHeader(ctx: DrawContext, doc: PDFDocument, text: string): DrawContext {
  ctx = ensureSpace(ctx, doc, SECTION_GAP + LINE_HEIGHT * 2);
  ctx.y -= SECTION_GAP;

  // Section header with accent bar
  ctx.page.drawRectangle({
    x: MARGIN_LEFT,
    y: ctx.y - 2,
    width: 3,
    height: FONT_SIZE_SECTION + 4,
    color: ctx.primaryColor,
  });

  ctx.page.drawText(text.toUpperCase(), {
    x: MARGIN_LEFT + 10,
    y: ctx.y,
    size: FONT_SIZE_SECTION,
    font: ctx.fontBold,
    color: ctx.primaryColor,
  });

  ctx.y -= FONT_SIZE_SECTION + 8;
  ctx = drawHorizontalLine(ctx, 1, ctx.primaryColor);
  ctx.y -= 4;
  return ctx;
}

function drawLabelValue(
  ctx: DrawContext, doc: PDFDocument,
  label: string, value: string,
  xOffset = 0
): DrawContext {
  ctx = ensureSpace(ctx, doc, LINE_HEIGHT);
  const x = MARGIN_LEFT + xOffset;
  ctx.page.drawText(label, {
    x,
    y: ctx.y,
    size: FONT_SIZE_BODY,
    font: ctx.fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  ctx.page.drawText(value || 'N/A', {
    x: x + 140,
    y: ctx.y,
    size: FONT_SIZE_BODY,
    font: ctx.font,
    color: rgb(0.15, 0.15, 0.15),
  });
  ctx.y -= LINE_HEIGHT;
  return ctx;
}

function drawTwoColumn(
  ctx: DrawContext, doc: PDFDocument,
  label1: string, value1: string,
  label2: string, value2: string
): DrawContext {
  ctx = ensureSpace(ctx, doc, LINE_HEIGHT);
  const col2X = MARGIN_LEFT + CONTENT_WIDTH / 2;

  // Column 1
  ctx.page.drawText(label1, {
    x: MARGIN_LEFT,
    y: ctx.y,
    size: FONT_SIZE_BODY,
    font: ctx.fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  ctx.page.drawText(value1 || 'N/A', {
    x: MARGIN_LEFT + 120,
    y: ctx.y,
    size: FONT_SIZE_BODY,
    font: ctx.font,
    color: rgb(0.15, 0.15, 0.15),
  });

  // Column 2
  ctx.page.drawText(label2, {
    x: col2X,
    y: ctx.y,
    size: FONT_SIZE_BODY,
    font: ctx.fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  ctx.page.drawText(value2 || 'N/A', {
    x: col2X + 120,
    y: ctx.y,
    size: FONT_SIZE_BODY,
    font: ctx.font,
    color: rgb(0.15, 0.15, 0.15),
  });

  ctx.y -= LINE_HEIGHT;
  return ctx;
}

function drawParagraph(
  ctx: DrawContext, doc: PDFDocument, text: string, indent = 0
): DrawContext {
  const maxWidth = CONTENT_WIDTH - indent;
  const words = text.split(' ');
  let line = '';
  const charWidth = ctx.font.widthOfTextAtSize('a', FONT_SIZE_BODY);
  const approxCharsPerLine = Math.floor(maxWidth / charWidth);

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (testLine.length > approxCharsPerLine && line) {
      ctx = ensureSpace(ctx, doc, LINE_HEIGHT);
      ctx.page.drawText(line, {
        x: MARGIN_LEFT + indent,
        y: ctx.y,
        size: FONT_SIZE_BODY,
        font: ctx.font,
        color: rgb(0.2, 0.2, 0.2),
      });
      ctx.y -= LINE_HEIGHT;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx = ensureSpace(ctx, doc, LINE_HEIGHT);
    ctx.page.drawText(line, {
      x: MARGIN_LEFT + indent,
      y: ctx.y,
      size: FONT_SIZE_BODY,
      font: ctx.font,
      color: rgb(0.2, 0.2, 0.2),
    });
    ctx.y -= LINE_HEIGHT;
  }
  return ctx;
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    if (req.method !== 'POST') {
      return respond({ error: 'Method not allowed' }, 405);
    }

    const { enrollment_id, signature_data } = await req.json();

    if (!enrollment_id) {
      return respond({ error: 'enrollment_id is required' }, 400);
    }

    console.log(`[CONTRACT] Generating contract for enrollment: ${enrollment_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── Fetch enrollment with related data ───────────────────────────────

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        *,
        members (
          id, first_name, last_name, email, phone,
          date_of_birth, address_line1, address_line2,
          city, state, zip_code
        ),
        products (
          id, name, description
        ),
        organizations (
          id, name, slug, branding
        )
      `)
      .eq('id', enrollment_id)
      .single();

    if (enrollmentError || !enrollment) {
      console.error(`[CONTRACT] Enrollment not found: ${enrollmentError?.message}`);
      return respond({ error: 'Enrollment not found' }, 404);
    }

    const member = enrollment.members;
    const product = enrollment.products;
    const org = enrollment.organizations;

    if (!member || !org) {
      return respond({ error: 'Missing member or organization data' }, 400);
    }

    // Fetch dependents
    const { data: dependents } = await supabase
      .from('enrollment_dependents')
      .select('id, first_name, last_name, relationship, date_of_birth')
      .eq('enrollment_id', enrollment_id)
      .order('created_at', { ascending: true });

    // Fetch advisor info
    let advisorName = 'N/A';
    if (enrollment.advisor_id) {
      const { data: advisor } = await supabase
        .from('advisors')
        .select('id, first_name, last_name')
        .eq('id', enrollment.advisor_id)
        .single();

      if (advisor) {
        advisorName = `${advisor.first_name || ''} ${advisor.last_name || ''}`.trim();
      }
    }

    // Determine contract version
    const { count: existingCount } = await supabase
      .from('enrollment_contracts')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollment_id);

    const contractVersion = (existingCount || 0) + 1;

    // ── Build PDF ────────────────────────────────────────────────────────

    console.log(`[CONTRACT] Building PDF v${contractVersion} for ${member.first_name} ${member.last_name}`);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Org branding colors
    const branding: OrgBranding = org.branding || {};
    const primaryColor = branding.primary_color
      ? hexToRgb(branding.primary_color)
      : rgb(0.13, 0.27, 0.53); // Default navy
    const accentColor = branding.secondary_color
      ? hexToRgb(branding.secondary_color)
      : rgb(0.2, 0.4, 0.7);

    const generatedAt = new Date().toISOString();
    const generatedDateFormatted = formatDate(generatedAt);

    // ── Page 1: Enrollment Agreement ─────────────────────────────────────

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let ctx: DrawContext = {
      page,
      y: PAGE_HEIGHT - MARGIN_TOP,
      font,
      fontBold,
      primaryColor,
      accentColor,
    };

    // Header bar
    ctx.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 5,
      width: PAGE_WIDTH,
      height: 5,
      color: primaryColor,
    });

    // Organization name
    ctx.page.drawText(org.name || 'Organization', {
      x: MARGIN_LEFT,
      y: ctx.y,
      size: FONT_SIZE_TITLE,
      font: fontBold,
      color: primaryColor,
    });
    ctx.y -= FONT_SIZE_TITLE + 6;

    // Title
    ctx.page.drawText('ENROLLMENT AGREEMENT', {
      x: MARGIN_LEFT,
      y: ctx.y,
      size: 14,
      font: fontBold,
      color: rgb(0.4, 0.4, 0.4),
    });
    ctx.y -= 20;

    // Contract reference line
    ctx.page.drawText(`Contract #${enrollment_id.substring(0, 8).toUpperCase()}-V${contractVersion}`, {
      x: MARGIN_LEFT,
      y: ctx.y,
      size: FONT_SIZE_SMALL,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    const dateStr = `Generated: ${generatedDateFormatted}`;
    const dateWidth = font.widthOfTextAtSize(dateStr, FONT_SIZE_SMALL);
    ctx.page.drawText(dateStr, {
      x: PAGE_WIDTH - MARGIN_RIGHT - dateWidth,
      y: ctx.y,
      size: FONT_SIZE_SMALL,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    ctx.y -= 12;
    ctx = drawHorizontalLine(ctx, 2, primaryColor);

    // ── Member Information ───────────────────────────────────────────────

    ctx = drawSectionHeader(ctx, pdfDoc, 'Member Information');

    const memberName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
    ctx = drawTwoColumn(ctx, pdfDoc,
      'Full Name:', memberName,
      'Date of Birth:', formatDate(member.date_of_birth)
    );
    ctx = drawTwoColumn(ctx, pdfDoc,
      'Email:', member.email || 'N/A',
      'Phone:', member.phone || 'N/A'
    );

    const address = [
      member.address_line1,
      member.address_line2,
    ].filter(Boolean).join(', ');
    const cityStateZip = [
      member.city,
      member.state,
      member.zip_code,
    ].filter(Boolean).join(', ');

    if (address || cityStateZip) {
      ctx = drawLabelValue(ctx, pdfDoc, 'Address:', address || 'N/A');
      if (cityStateZip) {
        ctx = drawLabelValue(ctx, pdfDoc, '', cityStateZip, 0);
      }
    }

    // ── Plan & Product Details ───────────────────────────────────────────

    ctx = drawSectionHeader(ctx, pdfDoc, 'Plan & Product Details');

    ctx = drawTwoColumn(ctx, pdfDoc,
      'Product:', product?.name || 'N/A',
      'Plan Type:', enrollment.plan_type || 'N/A'
    );
    ctx = drawTwoColumn(ctx, pdfDoc,
      'Monthly Cost:', formatCurrency(enrollment.base_monthly_cost),
      'Setup Fee:', formatCurrency(enrollment.setup_fee)
    );
    ctx = drawTwoColumn(ctx, pdfDoc,
      'Start Date:', formatDate(enrollment.start_date),
      'End Date:', formatDate(enrollment.end_date)
    );
    ctx = drawTwoColumn(ctx, pdfDoc,
      'Status:', (enrollment.status || 'N/A').toUpperCase(),
      'Advisor:', advisorName
    );

    if (product?.description) {
      ctx.y -= 6;
      ctx = drawLabelValue(ctx, pdfDoc, 'Description:', '');
      ctx = drawParagraph(ctx, pdfDoc, product.description, 10);
    }

    // ── Dependents ───────────────────────────────────────────────────────

    if (dependents && dependents.length > 0) {
      ctx = drawSectionHeader(ctx, pdfDoc, 'Enrolled Dependents');

      // Table header
      ctx = ensureSpace(ctx, pdfDoc, LINE_HEIGHT * (dependents.length + 2));

      // Header background
      ctx.page.drawRectangle({
        x: MARGIN_LEFT,
        y: ctx.y - 3,
        width: CONTENT_WIDTH,
        height: LINE_HEIGHT + 4,
        color: rgb(0.94, 0.94, 0.96),
      });

      const colName = MARGIN_LEFT + 5;
      const colRelationship = MARGIN_LEFT + 180;
      const colDob = MARGIN_LEFT + 340;

      ctx.page.drawText('Name', { x: colName, y: ctx.y, size: FONT_SIZE_BODY, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
      ctx.page.drawText('Relationship', { x: colRelationship, y: ctx.y, size: FONT_SIZE_BODY, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
      ctx.page.drawText('Date of Birth', { x: colDob, y: ctx.y, size: FONT_SIZE_BODY, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
      ctx.y -= LINE_HEIGHT + 4;

      for (const dep of dependents) {
        ctx = ensureSpace(ctx, pdfDoc, LINE_HEIGHT);
        const depName = `${dep.first_name || ''} ${dep.last_name || ''}`.trim();
        ctx.page.drawText(depName, { x: colName, y: ctx.y, size: FONT_SIZE_BODY, font, color: rgb(0.15, 0.15, 0.15) });
        ctx.page.drawText(dep.relationship || 'N/A', { x: colRelationship, y: ctx.y, size: FONT_SIZE_BODY, font, color: rgb(0.15, 0.15, 0.15) });
        ctx.page.drawText(formatDate(dep.date_of_birth), { x: colDob, y: ctx.y, size: FONT_SIZE_BODY, font, color: rgb(0.15, 0.15, 0.15) });
        ctx.y -= LINE_HEIGHT;
      }
    }

    // ── Payment Terms ────────────────────────────────────────────────────

    ctx = drawSectionHeader(ctx, pdfDoc, 'Payment Terms');

    const paymentTerms = [
      `The monthly premium for this enrollment is ${formatCurrency(enrollment.base_monthly_cost)}, due on the first day of each billing cycle.`,
      enrollment.setup_fee && Number(enrollment.setup_fee) > 0
        ? `A one-time setup fee of ${formatCurrency(enrollment.setup_fee)} is due at the time of enrollment.`
        : null,
      'Payments are processed automatically using the payment method on file. You may update your payment method at any time through the member portal.',
      'Failure to maintain current payments may result in suspension or cancellation of coverage. A grace period of 30 days will be provided for overdue payments.',
      'Cancellation requests must be submitted in writing at least 30 days prior to the desired cancellation date. Refunds for unused portions of the billing cycle are subject to the cancellation policy outlined in the Terms of Service.',
    ].filter(Boolean) as string[];

    for (let i = 0; i < paymentTerms.length; i++) {
      ctx = ensureSpace(ctx, pdfDoc, LINE_HEIGHT * 2);
      ctx.page.drawText(`${i + 1}.`, {
        x: MARGIN_LEFT + 5,
        y: ctx.y,
        size: FONT_SIZE_BODY,
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3),
      });
      ctx = drawParagraph(ctx, pdfDoc, paymentTerms[i], 20);
      ctx.y -= 4;
    }

    // ── Page 2+: Legal Terms ─────────────────────────────────────────────

    // Force a new page for legal sections
    addPageFooter(ctx);
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx = { ...ctx, page, y: PAGE_HEIGHT - MARGIN_TOP };

    // Top accent bar on legal pages
    ctx.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 5,
      width: PAGE_WIDTH,
      height: 5,
      color: primaryColor,
    });

    // ── Terms of Service ─────────────────────────────────────────────────

    ctx = drawSectionHeader(ctx, pdfDoc, 'Terms of Service');

    const tosTerms = [
      'ACCEPTANCE OF TERMS: By signing this enrollment agreement, the member acknowledges and agrees to be bound by the terms and conditions set forth herein, as well as any additional policies and guidelines that may be published by the organization from time to time.',
      'ELIGIBILITY: The member represents and warrants that all information provided in this enrollment is true, accurate, and complete. The organization reserves the right to verify any information provided and to deny or revoke coverage based on material misrepresentation.',
      'COVERAGE PERIOD: Coverage under this agreement begins on the start date indicated above and continues on a month-to-month basis unless otherwise specified. The organization reserves the right to modify coverage terms with 60 days written notice.',
      'MODIFICATIONS: The organization reserves the right to modify premiums, benefits, or terms of this agreement upon 60 days written notice to the member. Continued enrollment after the effective date of such modifications constitutes acceptance of the changes.',
      'DISPUTE RESOLUTION: Any disputes arising from this agreement shall first be submitted to mediation. If mediation is unsuccessful, disputes shall be resolved through binding arbitration in accordance with applicable rules and regulations.',
      'GOVERNING LAW: This agreement shall be governed by and construed in accordance with the laws of the state in which the organization is registered, without regard to conflict of law provisions.',
    ];

    for (const term of tosTerms) {
      ctx = drawParagraph(ctx, pdfDoc, term);
      ctx.y -= 6;
    }

    // ── Privacy Policy ───────────────────────────────────────────────────

    ctx = drawSectionHeader(ctx, pdfDoc, 'Privacy Policy');

    const privacyTerms = [
      'INFORMATION COLLECTION: We collect personal information necessary to administer your enrollment, process payments, and communicate with you about your account. This includes your name, contact information, date of birth, and payment details.',
      'USE OF INFORMATION: Your personal information is used solely for the purpose of administering your enrollment, processing claims, and communicating important account updates. We do not sell, rent, or share your personal information with third parties for marketing purposes.',
      'DATA SECURITY: We employ industry-standard security measures to protect your personal information, including encryption of data in transit and at rest, access controls, and regular security audits.',
      'DATA RETENTION: Your personal information will be retained for the duration of your enrollment and for a period of seven (7) years following the termination of your enrollment, as required by applicable regulations.',
      'YOUR RIGHTS: You have the right to access, correct, or request deletion of your personal information. To exercise these rights, please contact us through the member portal or by contacting your advisor.',
    ];

    for (const term of privacyTerms) {
      ctx = drawParagraph(ctx, pdfDoc, term);
      ctx.y -= 6;
    }

    // ── Signature Page ───────────────────────────────────────────────────

    addPageFooter(ctx);
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx = { ...ctx, page, y: PAGE_HEIGHT - MARGIN_TOP };

    ctx.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 5,
      width: PAGE_WIDTH,
      height: 5,
      color: primaryColor,
    });

    ctx = drawSectionHeader(ctx, pdfDoc, 'Acknowledgment & Digital Signature');

    const ackText = [
      'By signing below, I acknowledge that I have read and understood the terms and conditions of this enrollment agreement, including the Terms of Service and Privacy Policy. I confirm that all information provided is accurate and complete.',
      'I authorize the organization to process recurring payments as described in the Payment Terms section. I understand that I may cancel my enrollment at any time in accordance with the cancellation policy.',
      `This agreement is entered into between ${memberName} ("Member") and ${org.name || 'the Organization'} ("Organization") as of the date signed below.`,
    ];

    for (const text of ackText) {
      ctx = drawParagraph(ctx, pdfDoc, text);
      ctx.y -= 8;
    }

    ctx.y -= 20;

    // Signature box
    ctx.page.drawRectangle({
      x: MARGIN_LEFT,
      y: ctx.y - 120,
      width: CONTENT_WIDTH,
      height: 130,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
      color: rgb(0.98, 0.98, 0.99),
    });

    const sigBoxTop = ctx.y - 8;

    ctx.page.drawText('DIGITAL SIGNATURE', {
      x: MARGIN_LEFT + 15,
      y: sigBoxTop,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: primaryColor,
    });

    const signerName = signature_data?.signer_name || memberName;
    const signerIp = signature_data?.ip_address || 'N/A';
    const signedDate = signature_data?.signed_at
      ? formatDate(signature_data.signed_at)
      : generatedDateFormatted;

    ctx.page.drawText(`Signer: ${signerName}`, {
      x: MARGIN_LEFT + 15,
      y: sigBoxTop - 22,
      size: FONT_SIZE_BODY,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });

    ctx.page.drawText(`Date: ${signedDate}`, {
      x: MARGIN_LEFT + 15,
      y: sigBoxTop - 38,
      size: FONT_SIZE_BODY,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });

    ctx.page.drawText(`IP Address: ${signerIp}`, {
      x: MARGIN_LEFT + 15,
      y: sigBoxTop - 54,
      size: FONT_SIZE_BODY,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });

    // Signature line
    ctx.page.drawLine({
      start: { x: MARGIN_LEFT + 15, y: sigBoxTop - 80 },
      end: { x: MARGIN_LEFT + 280, y: sigBoxTop - 80 },
      thickness: 1,
      color: rgb(0.3, 0.3, 0.3),
    });

    ctx.page.drawText('Authorized Signature', {
      x: MARGIN_LEFT + 15,
      y: sigBoxTop - 95,
      size: FONT_SIZE_SMALL,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Date line on the right
    ctx.page.drawLine({
      start: { x: MARGIN_LEFT + 330, y: sigBoxTop - 80 },
      end: { x: MARGIN_LEFT + CONTENT_WIDTH - 15, y: sigBoxTop - 80 },
      thickness: 1,
      color: rgb(0.3, 0.3, 0.3),
    });

    ctx.page.drawText('Date', {
      x: MARGIN_LEFT + 330,
      y: sigBoxTop - 95,
      size: FONT_SIZE_SMALL,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    ctx.y = sigBoxTop - 140;

    // Confidentiality notice
    ctx.y -= 20;
    ctx.page.drawRectangle({
      x: MARGIN_LEFT,
      y: ctx.y - 40,
      width: CONTENT_WIDTH,
      height: 45,
      color: rgb(0.96, 0.96, 0.98),
    });

    ctx = drawParagraph(ctx, pdfDoc,
      'CONFIDENTIALITY NOTICE: This document contains confidential information intended solely for the named member. Unauthorized distribution, copying, or disclosure of this document is strictly prohibited.'
    );

    // Add footer to all pages
    const allPages = pdfDoc.getPages();
    const totalPages = allPages.length;
    for (let i = 0; i < totalPages; i++) {
      const p = allPages[i];
      const footerText = `Page ${i + 1} of ${totalPages}`;
      const footerWidth = font.widthOfTextAtSize(footerText, FONT_SIZE_SMALL);
      p.drawText(footerText, {
        x: (PAGE_WIDTH - footerWidth) / 2,
        y: 25,
        size: FONT_SIZE_SMALL,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Org name in footer
      p.drawText(org.name || '', {
        x: MARGIN_LEFT,
        y: 25,
        size: FONT_SIZE_SMALL,
        font,
        color: rgb(0.65, 0.65, 0.65),
      });

      // Contract ref in footer right
      const refText = `Ref: ${enrollment_id.substring(0, 8).toUpperCase()}`;
      const refWidth = font.widthOfTextAtSize(refText, FONT_SIZE_SMALL);
      p.drawText(refText, {
        x: PAGE_WIDTH - MARGIN_RIGHT - refWidth,
        y: 25,
        size: FONT_SIZE_SMALL,
        font,
        color: rgb(0.65, 0.65, 0.65),
      });
    }

    // ── Save & Upload PDF ────────────────────────────────────────────────

    const pdfBytes = await pdfDoc.save();
    const storagePath = `${org.id}/${enrollment_id}/contract-v${contractVersion}.pdf`;

    console.log(`[CONTRACT] Uploading PDF to storage: ${storagePath} (${pdfBytes.length} bytes)`);

    const { error: uploadError } = await supabase.storage
      .from('enrollment-contracts')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error(`[CONTRACT] Storage upload error: ${uploadError.message}`);
      return respond({ error: `Failed to upload PDF: ${uploadError.message}` }, 500);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('enrollment-contracts')
      .getPublicUrl(storagePath);

    const pdfUrl = urlData?.publicUrl || storagePath;

    // ── Upsert enrollment_contracts record ───────────────────────────────

    const { data: contract, error: contractError } = await supabase
      .from('enrollment_contracts')
      .upsert(
        {
          enrollment_id,
          member_id: member.id,
          organization_id: org.id,
          pdf_url: pdfUrl,
          generated_at: generatedAt,
          contract_version: contractVersion,
          signature_data: signature_data || null,
        },
        { onConflict: 'enrollment_id,contract_version' }
      )
      .select('id')
      .single();

    if (contractError) {
      console.error(`[CONTRACT] DB upsert error: ${contractError.message}`);
      // PDF was uploaded successfully, log the error but still return success
      console.warn(`[CONTRACT] PDF uploaded but DB record failed — manual reconciliation may be needed`);
      return respond({
        success: true,
        pdf_url: pdfUrl,
        contract_id: null,
        contract_version: contractVersion,
        warning: 'PDF generated and uploaded, but contract record save failed. Please retry.',
      });
    }

    console.log(`[CONTRACT] Contract generated successfully: ${contract.id} (v${contractVersion})`);

    return respond({
      success: true,
      pdf_url: pdfUrl,
      contract_id: contract.id,
      contract_version: contractVersion,
    });
  } catch (error) {
    console.error('[CONTRACT] Unhandled error:', error);
    return respond(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
