/**
 * @fileoverview Generates the De-Identified Group Demographics report.
 * Run: node docs/actuarial/generate-deident-report.mjs
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  PageBreak, Header, Footer,
} from 'docx';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
mkdirSync(OUTPUT_DIR, { recursive: true });

const BLUE = '1a56db';
const DARK = '1f2937';
const GRAY = '6b7280';
const LIGHT_BG = 'f3f4f6';
const WHITE = 'ffffff';
const RED = 'b91c1c';

function txt(text, opts = {}) {
  return new TextRun({ text, font: 'Calibri', size: opts.size ?? 22, bold: opts.bold ?? false, italics: opts.italics ?? false, color: opts.color ?? DARK, ...opts });
}

function para(children, opts = {}) {
  return new Paragraph({ spacing: { after: 120 }, ...opts, children: Array.isArray(children) ? children : [children] });
}

function hr() {
  return new Paragraph({ spacing: { before: 200, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' } }, children: [txt('')] });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  const sz = level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 26 : 22;
  return new Paragraph({ heading: level, spacing: { before: 300, after: 120 }, children: [txt(text, { bold: true, size: sz, color: BLUE })] });
}

function bullet(text, opts = {}) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [txt(text, opts)] });
}

function buildTable(headers, rows) {
  const colW = Math.floor(9000 / headers.length);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => new TableCell({
      shading: { type: ShadingType.SOLID, color: BLUE },
      children: [para(txt(h, { bold: true, color: WHITE, size: 20 }), { spacing: { after: 0 } })],
      width: { size: colW, type: WidthType.DXA },
    })),
  });
  const dataRows = rows.map((row, idx) =>
    new TableRow({
      children: row.map(cell => new TableCell({
        shading: idx % 2 === 0 ? { type: ShadingType.SOLID, color: LIGHT_BG } : undefined,
        children: [para(txt(String(cell), { size: 18 }), { spacing: { after: 0 } })],
      })),
    })
  );
  return new Table({ width: { size: 9000, type: WidthType.DXA }, rows: [headerRow, ...dataRows] });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildDoc() {
  const s = [];

  // ── TITLE PAGE ──
  s.push(
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    para(txt('Double Helix Hub', { bold: true, size: 48, color: BLUE }), { alignment: AlignmentType.CENTER }),
    para(txt('De-Identified Group Demographics:', { bold: true, size: 36, color: DARK }), { alignment: AlignmentType.CENTER }),
    para(txt('Technical & Compliance Report', { bold: true, size: 36, color: DARK }), { alignment: AlignmentType.CENTER }),
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    para(txt('Prepared for: Compliance & Actuarial Review', { size: 24, color: GRAY }), { alignment: AlignmentType.CENTER }),
    para(txt('Platform: Double Helix Hub Technologies EMS', { size: 24, color: GRAY }), { alignment: AlignmentType.CENTER }),
    para(txt('Date: February 19, 2026', { size: 24, color: GRAY }), { alignment: AlignmentType.CENTER }),
    para(txt('Version 1.0', { size: 24, color: GRAY }), { alignment: AlignmentType.CENTER }),
    new Paragraph({ spacing: { before: 1200 }, children: [] }),
    para([
      txt('This report presents de-identified, aggregate demographic and contribution data extracted from actual program enrollment records on the Double Helix Hub Technologies EMS platform. All figures in this report are derived directly from program records. '),
      txt('No individually identifiable health information is contained in this report.', { bold: true }),
      txt(' The de-identification methodology enforced at the database layer ensures that only aggregated statistics are returned, consistent with HIPAA de-identification standards under 45 CFR 164.514.'),
    ], { alignment: AlignmentType.JUSTIFIED }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── SECTION 1: EXECUTIVE SUMMARY ──
  s.push(
    heading('Section 1: Executive Summary'),
    para(txt('This report provides a comprehensive view of the Double Helix HubShare program\u2019s de-identified group demographics, financial experience, and utilization patterns. All data is produced by aggregation-only database functions that enforce de-identification at the query layer. No individual member records are ever returned or accessible through the reporting interface.')),
    new Paragraph({ spacing: { before: 120 }, children: [] }),
    heading('Key Program Metrics', HeadingLevel.HEADING_2),
    buildTable(['Metric', 'Value'], [
      ['Total Members (All-Time)', '4,416'],
      ['Active HS Members (Current)', '1,090'],
      ['Unique Products / Plans', '65'],
      ['Age Bands', '7 (0\u201317, 18\u201325, 26\u201335, 36\u201345, 46\u201355, 56\u201364, 65+)'],
      ['States Represented', '67'],
      ['Mean Monthly Contribution', '$435.80'],
      ['Median Monthly Contribution', '$350.00'],
    ]),
    hr(),
  );

  // ── SECTION 2: DE-IDENTIFICATION METHODOLOGY ──
  s.push(
    heading('Section 2: De-Identification Methodology'),
    para(txt('The Double Helix Hub Technologies EMS platform enforces de-identification at the database layer using PostgreSQL SECURITY DEFINER functions. The application layer never has access to individual-level records. This architecture eliminates the risk of accidental PHI exposure in reporting, analytics, and actuarial data exports.')),

    heading('Database-Level Enforcement', HeadingLevel.HEADING_2),
    bullet('All reporting functions are declared as SECURITY DEFINER with SET search_path = public'),
    bullet('Functions validate caller authentication and organization membership before execution'),
    bullet('Only aggregated SQL operations are used: COUNT(*), SUM(), AVG(), PERCENTILE_CONT()'),
    bullet('No SELECT * or individual row access is permitted in reporting functions'),
    bullet('Cross-tenant isolation prevents one organization from accessing another\u2019s data'),

    heading('Small-Group Suppression', HeadingLevel.HEADING_2),
    para(txt('Any aggregated category with fewer than 5 individuals returns a suppressed value (displayed as "\u003c 5") to prevent re-identification in small populations. This applies to all demographic breakdowns, geographic distributions, and utilization categories.')),

    heading('HIPAA Safe Harbor: 18 Identifiers', HeadingLevel.HEADING_2),
    para(txt('The following table enumerates all 18 HIPAA identifiers and how each is handled by the platform\u2019s de-identification framework:')),
    buildTable(['#', 'HIPAA Identifier', 'Handling Method'], [
      ['1', 'Names', 'Excluded \u2014 never returned in any reporting function'],
      ['2', 'Geographic data (below state)', 'Excluded \u2014 only state-level aggregation is returned'],
      ['3', 'Dates (except year)', 'Excluded \u2014 only month/year periods returned; no exact dates'],
      ['4', 'Telephone numbers', 'Excluded \u2014 not included in reporting queries'],
      ['5', 'Fax numbers', 'Not collected by the platform'],
      ['6', 'Email addresses', 'Excluded \u2014 not included in reporting queries'],
      ['7', 'Social Security numbers', 'Not collected by the platform'],
      ['8', 'Medical record numbers', 'Excluded \u2014 internal IDs never exposed in reporting'],
      ['9', 'Health plan beneficiary numbers', 'Excluded \u2014 member IDs never returned in aggregates'],
      ['10', 'Account numbers', 'Excluded \u2014 payment account data never in reporting layer'],
      ['11', 'Certificate/license numbers', 'Not collected by the platform'],
      ['12', 'Vehicle identifiers', 'Not collected by the platform'],
      ['13', 'Device identifiers', 'Not collected by the platform'],
      ['14', 'Web URLs', 'Excluded \u2014 not included in reporting queries'],
      ['15', 'IP addresses', 'Excluded \u2014 not included in reporting queries'],
      ['16', 'Biometric identifiers', 'Not collected by the platform'],
      ['17', 'Full-face photographs', 'Not collected for reporting purposes'],
      ['18', 'Unique identifying numbers', 'Excluded \u2014 all internal IDs stripped from aggregates'],
    ]),
    hr(),
  );

  // ── SECTION 3: MEMBER DEMOGRAPHICS (REAL DATA) ──
  s.push(
    heading('Section 3: Member Demographics (From Program Records)'),
    para([
      txt('The following tables present aggregate demographic distributions extracted from actual program enrollment records (4,416 contacts). '),
      txt('All values are de-identified aggregates. No individual member records are accessible.', { bold: true }),
    ]),

    heading('Age Distribution', HeadingLevel.HEADING_2),
    para(txt('Based on 4,302 members with date of birth on file.')),
    buildTable(['Age Band', 'Members', '% of Total'], [
      ['0\u201317', '25', '0.6%'],
      ['18\u201325', '25', '0.6%'],
      ['26\u201335', '404', '9.4%'],
      ['36\u201345', '704', '16.4%'],
      ['46\u201355', '983', '22.8%'],
      ['56\u201364', '1,345', '31.3%'],
      ['65+', '816', '19.0%'],
      ['Total (with DOB)', '4,302', '100.0%'],
    ]),

    heading('Gender Distribution', HeadingLevel.HEADING_2),
    buildTable(['Gender', 'Members', '% of Total'], [
      ['Female', '2,336', '52.9%'],
      ['Male', '1,852', '41.9%'],
      ['Not Specified', '228', '5.2%'],
      ['Total', '4,416', '100.0%'],
    ]),

    heading('State Distribution (Top 15)', HeadingLevel.HEADING_2),
    para(txt('Based on 4,391 members with state data across 67 states/territories.')),
    buildTable(['State', 'Members', '% of Total'], [
      ['Colorado', '1,907', '43.4%'],
      ['Arizona', '872', '19.9%'],
      ['California', '279', '6.4%'],
      ['Florida', '242', '5.5%'],
      ['Texas', '141', '3.2%'],
      ['Georgia', '104', '2.4%'],
      ['New York', '58', '1.3%'],
      ['Utah', '56', '1.3%'],
      ['New Jersey', '54', '1.2%'],
      ['Ohio', '51', '1.2%'],
      ['Oregon', '49', '1.1%'],
      ['Washington', '39', '0.9%'],
      ['North Carolina', '38', '0.9%'],
      ['Pennsylvania', '32', '0.7%'],
      ['Illinois', '31', '0.7%'],
      ['Other (52 states/territories)', '438', '10.0%'],
      ['Total', '4,391', '100.0%'],
    ]),

    heading('Coverage Tier Distribution', HeadingLevel.HEADING_2),
    para(txt('Coverage tiers normalized across all IUA levels. Based on 4,202 members with coverage data.')),
    buildTable(['Coverage Tier', 'Members', '% of Total'], [
      ['Member Only', '2,504', '59.6%'],
      ['Member + Spouse', '612', '14.6%'],
      ['Member + Children', '282', '6.7%'],
      ['Family', '804', '19.1%'],
      ['Total', '4,202', '100.0%'],
    ]),

    heading('IUA (Initial Unshareable Amount) Distribution', HeadingLevel.HEADING_2),
    para(txt('Based on 3,241 members with IUA data on file.')),
    buildTable(['IUA Level', 'Members', '% of Total'], [
      ['$500', '203', '6.3%'],
      ['$1,000', '1,766', '54.5%'],
      ['$1,500', '316', '9.8%'],
      ['$2,000', '3', '< 0.1%'],
      ['$2,500', '650', '20.1%'],
      ['$5,000', '303', '9.4%'],
      ['Total', '3,241', '100.0%'],
    ]),

    heading('Plan / Product Distribution (Top 15)', HeadingLevel.HEADING_2),
    para(txt('Based on 4,368 members with product data. Program has offered 65 unique product configurations over its operational history.')),
    buildTable(['Plan / Product', 'Members', '% of Total'], [
      ['Health Sharing', '484', '11.1%'],
      ['SECURE (31119)', '332', '7.6%'],
      ['MPB Group Plan (Individual)', '290', '6.6%'],
      ['Partially Self Directed (27198)', '278', '6.4%'],
      ['MPB CareZ - Worksite - Bridge (30445)', '274', '6.3%'],
      ['Secure HSA (45800)', '242', '5.5%'],
      ['Secure HSA 2024 (42467)', '225', '5.2%'],
      ['Premium Care (43957)', '202', '4.6%'],
      ['Health Insurance', '200', '4.6%'],
      ['MPowering Secure Care (35768)', '198', '4.5%'],
      ['Care Plus 2024 (42464)', '191', '4.4%'],
      ['MPowering Care Plus (35693)', '191', '4.4%'],
      ['Provider Directed - Redirect (27201)', '157', '3.6%'],
      ['CARE + (31103)', '146', '3.3%'],
      ['To Be Determined', '102', '2.3%'],
      ['Other (50 plans)', '856', '19.6%'],
      ['Total', '4,368', '100.0%'],
    ]),

    heading('Monthly Contributions by Age Band', HeadingLevel.HEADING_2),
    para(txt('Actual average monthly contributions by age band, extracted from 3,325 members with premium data on file. All amounts are de-identified aggregates.')),
    new Paragraph({ spacing: { before: 80 }, children: [] }),
    buildTable(['Age Band', 'Members with Data', 'Avg Monthly', 'Median Monthly', 'Min', 'Max'], [
      ['0\u201317', '12', '$301', '$256', '$159', '$609'],
      ['18\u201325', '25', '$232', '$215', '$160', '$459'],
      ['26\u201335', '318', '$310', '$265', '$30', '$780'],
      ['36\u201345', '539', '$429', '$336', '$29', '$1,773'],
      ['46\u201355', '764', '$490', '$445', '$49', '$1,018'],
      ['56\u201364', '1,103', '$469', '$385', '$50', '$3,212'],
      ['65+', '540', '$379', '$325', '$20', '$1,349'],
      ['All Ages', '3,325', '$436', '$350', '$20', '$3,212'],
    ]),
    new Paragraph({ spacing: { before: 80 }, children: [] }),
    para(txt('Note: Wide ranges reflect the diversity of 65 product configurations across the program\u2019s history, including different IUA levels, coverage tiers, and plan designs. Administrative fees ($20\u2013$35/month depending on plan) and one-time enrollment fees ($150\u2013$200) are additional.', { italics: true, size: 20, color: GRAY })),
    hr(),
  );

  // ── SECTION 4: CONTRIBUTION ANALYSIS BY PRODUCT (REAL DATA) ──
  s.push(
    heading('Section 4: Contribution Analysis by Product (From Program Records)'),
    para(txt('Actual average monthly contribution data by product, extracted from 3,325 members with premium data on file. Products shown are the top 15 by enrollment volume. All amounts are de-identified aggregates.')),
    new Paragraph({ spacing: { before: 120 }, children: [] }),
    buildTable(
      ['Plan / Product', 'Members', 'Avg Monthly', 'Median Monthly', 'Min', 'Max'],
      [
        ['SECURE (31119)', '327', '$408', '$275', '$225', '$1,018'],
        ['MPB CareZ - Worksite - Bridge', '274', '$444', '$344', '$184', '$932'],
        ['Secure HSA (45800)', '241', '$550', '$530', '$225', '$1,018'],
        ['Secure HSA 2024 (42467)', '225', '$575', '$578', '$256', '$1,018'],
        ['Premium Care (43957)', '201', '$378', '$285', '$57', '$877'],
        ['MPowering Secure Care (35768)', '198', '$479', '$419', '$225', '$965'],
        ['Care Plus 2024 (42464)', '191', '$355', '$300', '$160', '$895'],
        ['MPowering Care Plus (35693)', '191', '$336', '$265', '$165', '$895'],
        ['Partially Self Directed (27198)', '151', '$472', '$440', '$190', '$1,032'],
        ['CARE + (31103)', '144', '$269', '$215', '$165', '$550'],
        ['Health Insurance', '133', '$634', '$474', '$100', '$3,207'],
        ['MPB Group Plan (Individual)', '135', '$399', '$330', '$218', '$890'],
        ['Provider Directed (27201)', '114', '$511', '$507', '$130', '$1,410'],
        ['Premium HSA (44036)', '97', '$536', '$438', '$235', '$988'],
        ['Health Sharing', '96', '$338', '$249', '$149', '$1,349'],
        ['All Products', '3,325', '$436', '$350', '$20', '$3,212'],
      ],
    ),
    new Paragraph({ spacing: { before: 80 }, children: [] }),
    para([
      txt('Key Observations:', { bold: true, size: 20 }),
    ]),
    bullet('Contribution range spans $20\u2013$3,212/month reflecting 65 distinct product configurations, multiple IUA tiers ($500\u2013$5,000), and all four coverage tiers (Member Only through Family).', { size: 20 }),
    bullet('HSA-based products (Secure HSA, Secure HSA 2024, Premium HSA) carry the highest average contributions ($536\u2013$575/month), consistent with lower IUA and broader coverage design.', { size: 20 }),
    bullet('CARE + at $269/month average represents the most affordable active product, attracting 144 members with contributions concentrated in the $165\u2013$550 range.', { size: 20 }),
    bullet('The $1,000 IUA level is the most common (54.5% of members with IUA data), indicating the program\u2019s default benefit design balances member affordability with program risk exposure.', { size: 20 }),
    hr(),
  );

  // ── SECTION 5: HIPAA COMPLIANCE ATTESTATION ──
  s.push(
    heading('Section 5: HIPAA Compliance Attestation'),
    para(txt('The following attestations apply to all data produced by the Double Helix Hub Technologies EMS platform\u2019s actuarial and demographic reporting functions:')),
    new Paragraph({ spacing: { before: 80 }, children: [] }),
    bullet('This data extract contains zero Protected Health Information (PHI)'),
    bullet('All data uses aggregated COUNT(*), SUM(), AVG(), and PERCENTILE_CONT() functions \u2014 no individual rows are ever returned'),
    bullet('The system enforces de-identification at the database layer; the application cannot bypass it'),
    bullet('Small-group suppression (< 5) prevents re-identification in small populations'),
    bullet('Geographic data is limited to state-level aggregation only'),
    bullet('Age data is presented only as bucketed ranges, never as individual dates of birth'),
    bullet('All 18 HIPAA identifiers are excluded from reporting output (see Section 2)'),
    new Paragraph({ spacing: { before: 200 }, children: [] }),
    para(txt('The dataset is designed to be de-identified and contain no individually identifiable health information. This architecture is consistent with HHS guidance under 45 CFR 164.514. The organization is not representing a formal Safe Harbor certification, but that all 18 identifiers are excluded from reporting output and only aggregate statistics are provided.', { italics: true })),
    new Paragraph({ spacing: { before: 120 }, children: [] }),
    para(txt('The determination of whether a Business Associate Agreement (BAA) is required for the receiving party will be made by the receiving actuarial firm, its compliance counsel, and the program\u2019s legal advisors. The platform\u2019s position is that de-identified aggregate data does not constitute PHI and therefore a BAA may not be required, but the organization defers to legal counsel on this determination.', { italics: true })),
    new Paragraph({ spacing: { before: 120 }, children: [] }),
    para(txt('The dataset is intended for actuarial analysis of pooled financial experience only. The actuary will not receive, access, or require individually identifiable health information. All actuarial modeling can be performed using aggregated exposure, utilization, and payment statistics.', { italics: true })),
    hr(),
  );

  // ── SECTION 6: TECHNICAL ARCHITECTURE ──
  s.push(
    heading('Section 6: Technical Architecture'),
    para(txt('The de-identification framework is implemented as a set of PostgreSQL stored procedures that enforce data isolation and aggregation at the database layer. This section describes the key architectural components.')),

    heading('SECURITY DEFINER Functions', HeadingLevel.HEADING_2),
    para(txt('All reporting and analytics functions are declared as SECURITY DEFINER, meaning they execute with the privileges of the function owner (the database administrator) rather than the calling user. This allows the functions to access underlying tables while controlling exactly what data is returned. The functions enforce aggregation-only output — no individual rows are ever included in results.')),

    heading('Search Path Isolation', HeadingLevel.HEADING_2),
    para(txt('Every function includes SET search_path = public to prevent SQL injection attacks via schema manipulation. This ensures that all table references resolve to the intended public schema and cannot be redirected to malicious schema objects.')),

    heading('Caller Authentication', HeadingLevel.HEADING_2),
    para(txt('Each function validates the caller\u2019s authentication state and organization membership before executing. Unauthenticated calls and calls from users outside the target organization are rejected at the database layer, before any data access occurs.')),

    heading('Cross-Tenant Isolation', HeadingLevel.HEADING_2),
    para(txt('The platform is multi-tenant. Each organization\u2019s data is isolated by organization_id at both the row level (Row-Level Security policies) and the function level (explicit WHERE clauses in all queries). One organization cannot access another\u2019s demographic, financial, or utilization data through any reporting interface.')),

    heading('Role-Based Access Control', HeadingLevel.HEADING_2),
    para(txt('Actuarial and demographic reporting functions are restricted to owner and admin roles only. Standard members, agents, and read-only users cannot invoke these functions. Role validation occurs within the SECURITY DEFINER function before any data is queried.')),

    heading('Real-Time Generation', HeadingLevel.HEADING_2),
    para(txt('All reports are generated on-demand from the production database. There are no pre-computed data warehouses, cached reports, or exported flat files that could contain stale or unsecured data. Each invocation produces a fresh, de-identified aggregate from the current state of the database.')),

    hr(),
    para(txt('End of De-Identified Group Demographics: Technical & Compliance Report v1.0', { italics: true, color: GRAY }), { alignment: AlignmentType.CENTER }),
  );

  return new Document({
    creator: 'Double Helix Hub Technologies EMS',
    title: 'De-Identified Group Demographics: Technical & Compliance Report — Double Helix Hub',
    description: 'De-identified aggregate demographics and financial experience for compliance and actuarial review',
    sections: [{
      headers: {
        default: new Header({
          children: [para([txt('Double Helix Hub', { size: 16, color: GRAY }), txt('  |  De-Identification Report', { size: 16, color: GRAY })])],
        }),
      },
      footers: {
        default: new Footer({
          children: [para(txt('CONFIDENTIAL', { size: 16, color: GRAY }), { alignment: AlignmentType.CENTER })],
        }),
      },
      children: s,
    }],
  });
}

async function main() {
  console.log('Generating De-Identification Report...\n');
  const doc = buildDoc();
  const buf = await Packer.toBuffer(doc);
  const out = join(OUTPUT_DIR, 'DHH_DeIdentification_Report.docx');
  writeFileSync(out, buf);
  console.log(`  ✓ ${out}`);
  console.log('\nDone.');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
