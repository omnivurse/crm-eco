/**
 * @fileoverview Generates Word (.docx) files for the actuarial submission package.
 * Run: node docs/actuarial/generate-docx.mjs
 * Output: docs/actuarial/output/
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  PageBreak, Header, Footer, TabStopPosition, TabStopType,
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

/** Shorthand for a styled text run */
function txt(text, opts = {}) {
  return new TextRun({
    text,
    font: 'Calibri',
    size: opts.size ?? 22,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? DARK,
    ...opts,
  });
}

/** Create a paragraph with common defaults */
function para(children, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: Array.isArray(children) ? children : [children],
  });
}

/** Horizontal rule as a bottom-bordered empty paragraph */
function hr() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' } },
    children: [txt('')],
  });
}

/** Section heading */
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 300, after: 120 },
    children: [txt(text, { bold: true, size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 26 : 22, color: BLUE })],
  });
}

/** Bullet point */
function bullet(text, opts = {}) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [txt(text, opts)],
  });
}

/** Build a table from header + rows. First row is header row. */
function buildTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => new TableCell({
      shading: { type: ShadingType.SOLID, color: BLUE },
      children: [para(txt(h, { bold: true, color: WHITE, size: 20 }), { spacing: { after: 0 } })],
      width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
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

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [headerRow, ...dataRows],
  });
}

// ---------------------------------------------------------------------------
// MAIN DOCUMENT
// ---------------------------------------------------------------------------
function buildSubmissionDoc() {
  const sections = [];

  // -- Title Page --
  sections.push(
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    para(txt('Pay It Forward HealthShare', { bold: true, size: 48, color: BLUE }), { alignment: AlignmentType.CENTER }),
    para(txt('Actuarial Data Submission Package', { bold: true, size: 36, color: DARK }), { alignment: AlignmentType.CENTER }),
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    para(txt('Prepared for: Actuarial Review', { size: 24, color: GRAY }), { alignment: AlignmentType.CENTER }),
    para(txt('Organization: Pay It Forward HealthShare', { size: 24, color: GRAY }), { alignment: AlignmentType.CENTER }),
    para(txt('Platform: Pay It Forward Technologies EMS', { size: 24, color: GRAY }), { alignment: AlignmentType.CENTER }),
    para(txt('Date: February 19, 2026', { size: 24, color: GRAY }), { alignment: AlignmentType.CENTER }),
    para(txt('Version 3.0', { size: 24, color: GRAY }), { alignment: AlignmentType.CENTER }),
    new Paragraph({ spacing: { before: 1200 }, children: [] }),
    para([
      txt('This submission is intended to provide an actuarial firm with sufficient aggregated experience data to evaluate contribution adequacy, financial sustainability, reserve requirements, and stop-loss structuring for the Pay It Forward HealthShare program administered on the Pay It Forward Technologies EMS platform. The organization is seeking an independent actuarial review and funding opinion. '),
      txt('The organization is requesting an actuarial funding adequacy opinion and recommended contribution ranges, including reserve guidance and stop-loss attachment recommendations based on the provided experience data.', { bold: true }),
    ], { alignment: AlignmentType.JUSTIFIED }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // -- Part 1: Privacy & Compliance --
  sections.push(
    heading('Part 1: Privacy & Compliance Framework'),
    heading('De-Identification Method', HeadingLevel.HEADING_2),
    para(txt('All data provided in this package is aggregated-only, de-identified data. De-identification is enforced at the database level via PostgreSQL stored procedures (SECURITY DEFINER functions). The application layer never has access to individual-level records.')),
    para(txt('De-identification is achieved through aggregation, suppression, and removal of all direct identifiers. The dataset contains no individually identifiable information and is intended to meet HIPAA de-identification standards as described in 45 CFR 164.514. The organization is not representing a formal Safe Harbor certification, but that all 18 identifiers are excluded and only aggregate statistics are provided.', { italics: true })),
    heading('What is NEVER Included', HeadingLevel.HEADING_3),
    bullet('No member names, dates of birth, SSNs, or member IDs'),
    bullet('No email addresses, phone numbers, or physical addresses'),
    bullet('No individual claim/need records'),
    bullet('No individual payment records'),
    bullet('Geographic data limited to state-level only'),
    bullet('Age data presented only as bucketed ranges (0-17, 18-25, 26-35, 36-45, 46-55, 56-64, 65+)'),
    heading('Small-Group Suppression', HeadingLevel.HEADING_3),
    para(txt('Any aggregated category with fewer than 5 individuals returns a suppressed value (displayed as "< 5") to prevent re-identification in small populations.')),
    heading('Access Control', HeadingLevel.HEADING_3),
    bullet('Database functions validate caller authentication and organization membership'),
    bullet('API restricted to owner and admin roles only'),
    bullet('Cross-tenant isolation: one organization cannot access another\'s data'),
    bullet('All functions use SET search_path = public to prevent SQL injection'),
    hr(),
  );

  // -- Part 2: Datasets --
  sections.push(
    heading('Part 2: Actuarial Experience Data Extract Specification'),
    para(txt('The platform generates five datasets on-demand, covering a configurable lookback period (default: 24 months). All data is exportable as CSV directly from the admin dashboard.')),
    hr(),
  );

  // Dataset 1
  sections.push(
    heading('Dataset 1: Monthly Experience Summary', HeadingLevel.HEADING_2),
    para(txt('The primary actuarial input. Each row represents one calendar month.')),
    buildTable(
      ['Field', 'Type', 'Description'],
      [
        ['Period', 'YYYY-MM', 'Calendar month'],
        ['Eligible Members', 'Integer', 'Unique members eligible for sharing at any point during the calendar month (headcount measure). Exposure for actuarial modeling is provided separately in Dataset 5 as Member Months.'],
        ['New Members', 'Integer', 'Members who joined that month'],
        ['Contributions Collected', 'Currency', 'Total $ collected from member sharing contributions'],
        ['Processing Fees', 'Currency', 'Payment processing fees deducted'],
        ['Net Revenue', 'Currency', 'Collected minus fees'],
        ['Failed Payments', 'Integer', 'Number of failed payment attempts'],
        ['Failed Amount', 'Currency', '$ value of failed payments'],
        ['Needs Submitted (Count)', 'Integer', 'Number of needs/claims filed'],
        ['Needs Submitted ($)', 'Currency', 'Total $ value of needs filed'],
        ['Needs Approved (Count)', 'Integer', 'Number approved for sharing'],
        ['Needs Approved ($)', 'Currency', 'Total $ value approved'],
        ['Needs Paid/Shared ($)', 'Currency', 'Total $ actually reimbursed/shared to members'],
        ['Avg Need Size', 'Currency', 'Average submitted need amount'],
        ['Median Need Size', 'Currency', 'Median submitted need amount'],
        ['Max Single Need', 'Currency', 'Largest single need (catastrophic indicator)'],
        ['Needs > $25,000', 'Integer', 'Catastrophic exposure count'],
        ['Needs > $50,000', 'Integer', 'Severe catastrophic exposure count'],
        ['Needs per 100 Members', '%', 'Utilization rate'],
        ['Loss Ratio', '%', 'Paid / Collected * 100'],
        ['Avg Member Contribution', 'Currency', 'Collected / Eligible Members'],
        ['IUA Applied', 'Currency', 'Total IUA applied (deductible equivalent)'],
        ['Member Responsibility', 'Currency', 'Total member cost-share'],
      ]
    ),
    para(txt('Actuarial Use: Loss ratio trending, contribution adequacy, reserve estimation, catastrophic exposure modeling, utilization trending.', { bold: true, size: 20 })),
    hr(),
  );

  // Dataset 2
  sections.push(
    heading('Dataset 2: Needs Distribution by Type (Utilization Mix)', HeadingLevel.HEADING_2),
    para(txt('Each row represents a need category over the full lookback period.')),
    buildTable(
      ['Field', 'Type', 'Description'],
      [
        ['Need Type', 'Text', 'Category (e.g., ER, preventive, surgical, etc.)'],
        ['Count', 'Integer', 'Number of needs in this category'],
        ['Total Submitted ($)', 'Currency', 'Total $ submitted'],
        ['Total Approved ($)', 'Currency', 'Total $ approved for sharing'],
        ['Total Paid ($)', 'Currency', 'Total $ shared/reimbursed'],
        ['Avg Amount', 'Currency', 'Average need size for this type'],
        ['% of Total', '%', 'This type as proportion of all needs'],
      ]
    ),
    para(txt('Actuarial Use: ER vs preventive ratio, prescription cost analysis, high-cost category identification, service mix modeling.', { bold: true, size: 20 })),
    hr(),
  );

  // Dataset 3
  sections.push(
    heading('Dataset 3: Contribution Adequacy (Revenue Side)', HeadingLevel.HEADING_2),
    para(txt('Monthly view of the revenue/contribution pipeline.')),
    buildTable(
      ['Field', 'Type', 'Description'],
      [
        ['Period', 'YYYY-MM', 'Calendar month'],
        ['Active Billing Schedules', 'Integer', 'Members with active recurring contributions'],
        ['Avg Monthly Contribution', 'Currency', 'Average $ per member'],
        ['Median Monthly Contribution', 'Currency', 'Median $ per member'],
        ['Total Expected ($)', 'Currency', 'Sum of all active schedule amounts'],
        ['Total Collected ($)', 'Currency', 'Successfully processed charges'],
        ['Total Failed ($)', 'Currency', 'Failed charge amounts'],
        ['Failed Count', 'Integer', 'Number of failed transactions'],
        ['Processing Fees', 'Currency', 'Payment processor fees'],
        ['Net Revenue', 'Currency', 'Collected minus fees'],
        ['Collection Rate', '%', 'Collected / Expected * 100'],
      ]
    ),
    para(txt('Actuarial Use: Contribution sufficiency analysis, collection risk, revenue projection, reserve funding adequacy.', { bold: true, size: 20 })),
    hr(),
  );

  // Dataset 4
  sections.push(
    heading('Dataset 4: Age-Band Loss Experience (Risk Segmentation)', HeadingLevel.HEADING_2),
    para(txt('Each row represents an age cohort over the full lookback period. Small groups (< 5 members) are suppressed.')),
    buildTable(
      ['Field', 'Type', 'Description'],
      [
        ['Age Band', 'Text', 'Bucketed range (0-17, 18-25, 26-35, etc.)'],
        ['Eligible Members', 'Integer', 'Members in this band'],
        ['Needs Count', 'Integer', 'Needs filed by this cohort'],
        ['Total Submitted ($)', 'Currency', '$ submitted by this cohort'],
        ['Total Paid ($)', 'Currency', '$ shared/reimbursed to this cohort'],
        ['Avg Need Size', 'Currency', 'Average need for this band'],
        ['Needs per 100', '%', 'Utilization rate for this band'],
        ['Pre-Existing Condition %', '%', '% of band with pre-existing conditions'],
      ]
    ),
    para(txt('Actuarial Use: Age-adjusted risk modeling, morbidity analysis, contribution tier recommendation, stop-loss pricing.', { bold: true, size: 20 })),
    hr(),
  );

  // Dataset 5
  sections.push(
    heading('Dataset 5: Member-Month Exposure and Claims Development', HeadingLevel.HEADING_2),
    para(txt('Each row represents a service-month cohort and is the critical dataset for credibility analysis, reserve development, and PMPM calculation.')),
    buildTable(
      ['Field', 'Type', 'Description'],
      [
        ['Period', 'YYYY-MM', 'Calendar month'],
        ['Service Month', 'YYYY-MM', 'Month of underlying medical service (incident date cohort)'],
        ['Member Months', 'Integer', 'Daily exposure: eligible members per day, summed / days in month'],
        ['Beginning Members', 'Integer', 'Members active on first day of month'],
        ['Ending Members', 'Integer', 'Members active on last day of month'],
        ['New Enrollments', 'Integer', 'Members joining during month'],
        ['Terminations', 'Integer', 'Members leaving during month'],
        ['Incurred Amount ($)', 'Currency', 'Approved amounts attributed to service date (not submission)'],
        ['Paid Amount ($)', 'Currency', 'Amount actually reimbursed during month'],
        ['Pending Amount ($)', 'Currency', 'Approved but unpaid (open liabilities / IBNR proxy)'],
        ['PMPM', 'Currency', 'Per Member Per Month cost (incurred / member-months)'],
        ['Report Lag (Days)', 'Integer', 'Avg days from service date to submission'],
        ['Payment Lag (Days)', 'Integer', 'Avg days from submission to reimbursement'],
      ]
    ),
    para(txt('Actuarial Use: PMPM cost calculation, IBNR reserve development, claim completion factor triangles, solvency and reserve adequacy analysis.', { bold: true, size: 20 })),
    hr(),
  );

  // Portfolio Summary
  sections.push(
    heading('Portfolio Summary (Included with All Exports)', HeadingLevel.HEADING_2),
    buildTable(
      ['Metric', 'Description'],
      [
        ['Total Members', 'All-time member count'],
        ['Active Members', 'Currently active'],
        ['Total Needs Submitted', 'Count over lookback period'],
        ['Total Amount Submitted', '$ over lookback period'],
        ['Total Amount Approved', '$ approved for sharing'],
        ['Total Amount Paid/Shared', '$ actually reimbursed'],
        ['Total Contributions Collected', '$ collected from members'],
        ['Current MRR', 'Monthly recurring revenue (current)'],
        ['Avg Monthly Share', 'Average member contribution'],
        ['Overall Loss Ratio', 'Paid / Collected'],
        ['Collection Rate', 'Collected / Expected'],
        ['Utilization per 100', 'Needs per 100 active members'],
        ['Catastrophic Needs (>$25k)', 'Count of high-severity needs'],
      ]
    ),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // -- Part 3: What Actuary Can Model --
  sections.push(
    heading('Part 3: What the Actuary Can Model From This Data'),
    buildTable(
      ['Actuarial Output', 'Enabled By'],
      [
        ['PMPM cost', 'Dataset 5: incurred amount / member-months (true daily exposure)'],
        ['Expected loss ratio', 'Dataset 1: paid / contributions collected'],
        ['Contribution adequacy', 'Datasets 1 + 3: 24-month trend of loss ratio + collection rate'],
        ['Reserve requirements (IBNR)', 'Dataset 5: pending amount + report/payment lag for completion triangles'],
        ['Catastrophic exposure', 'Dataset 1: max single need, needs >$25k/>$50k'],
        ['Sustainability probability', 'Datasets 1 + 5: 24-month trend of members, PMPM, revenue, loss ratio'],
        ['Stop-loss recommendation', 'Datasets 1 + 4: distribution of max needs by month + age-band severity'],
        ['Contribution model / rate-setting', 'Datasets 4 + 5: age-band cost per member-month + utilization rates'],
        ['Funding sufficiency opinion', 'Dataset 3: net revenue vs Dataset 5: incurred obligations'],
        ['Solvency projection', 'Datasets 1 + 3 + 5: revenue trajectory vs loss trajectory over 3-5 years'],
        ['Incurred claims development', 'Dataset 5: service month cohort + lag data for completion triangles'],
      ]
    ),
    hr(),
  );

  // -- Part 4: Data Access --
  sections.push(
    heading('Part 4: Data Access'),
    para(txt('The actuarial data is available via two methods:')),
    para([
      txt('1. Admin Dashboard', { bold: true }),
      txt(' — Navigate to Analytics > Actuarial Data. View all five datasets in interactive tables with charts, or click "Export All CSVs" to download all datasets as CSV files in one click.'),
    ]),
    para([
      txt('2. API', { bold: true }),
      txt(' — GET /api/analytics/actuarial-experience?months=24 (authenticated, admin-only). Returns the complete dataset as JSON. Lookback period is configurable from 1 to 60 months.'),
    ]),
    para(txt('The data is generated in real-time from the production database. No manual extraction required.')),
    hr(),
  );

  // -- Part 5: Compliance Attestation --
  sections.push(
    heading('Part 5: Compliance Attestation'),
    bullet('This data extract contains zero Protected Health Information (PHI)'),
    bullet('All data uses aggregated COUNT(*), SUM(), AVG(), and PERCENTILE_CONT() functions — no individual rows are ever returned'),
    bullet('The system enforces de-identification at the database layer; the application cannot bypass it'),
    bullet('Small-group suppression (< 5) prevents re-identification in small populations'),
    bullet('This architecture is consistent with HHS guidance under 45 CFR 164.514'),
    para(txt('The dataset is intended for actuarial analysis of pooled financial experience only. The actuary will not receive, access, or require individually identifiable health information. All actuarial modeling can be performed using aggregated exposure, utilization, and payment statistics.', { italics: true })),
    para(txt('The dataset is designed to be de-identified and contain no individually identifiable health information. The determination of whether a Business Associate Agreement is required will be made by the receiving actuarial firm and applicable counsel.', { italics: true })),
    hr(),
  );

  // -- Part 6: Program Structure --
  sections.push(
    heading('Part 6: Program Structure Description'),
    para(txt('The following describes the health share program mechanics that influence utilization patterns and should be considered in actuarial modeling:')),
    heading('Initial Unshareable Amount (IUA)', HeadingLevel.HEADING_3),
    para(txt('The IUA functions as the member\'s responsibility threshold before sharing begins (analogous to a deductible). The IUA amount varies by plan tier and is configured per product. Members must meet their IUA before needs are eligible for sharing. The system tracks IUA amount, remaining IUA, and IUA-met status per need.')),
    heading('Waiting Periods', HeadingLevel.HEADING_3),
    para(txt('[To be completed by the program administrator — specify waiting periods for new members before needs are shareable, typically 30-90 days for general needs, longer for pre-existing conditions.]', { italics: true, color: 'b91c1c' })),
    heading('Pre-Existing Condition Sharing Rules', HeadingLevel.HEADING_3),
    para(txt('[To be completed by the program administrator — specify whether pre-existing conditions are shareable after a waiting period (e.g., 12-24 months), and any limitations on sharing amounts for pre-existing conditions.]', { italics: true, color: 'b91c1c' })),
    heading('Maternity Sharing Rules', HeadingLevel.HEADING_3),
    para(txt('[To be completed by the program administrator — specify maternity sharing eligibility, waiting periods, and maximum sharing amounts.]', { italics: true, color: 'b91c1c' })),
    heading('Maximum Sharing Limits', HeadingLevel.HEADING_3),
    para(txt('The system supports maximum annual share limits per product configuration. Individual needs are capped at the approved amount after IUA application.')),
    para(txt('[To be completed by the program administrator — specify per-need maximums, annual maximums, and lifetime maximums if applicable.]', { italics: true, color: 'b91c1c' })),
    heading('Network / Reference Pricing', HeadingLevel.HEADING_3),
    para(txt('[To be completed by the program administrator — specify whether a PPO network is used, reference-based pricing methodology, or cash-pay discount arrangements.]', { italics: true, color: 'b91c1c' })),
    heading('Prescription Sharing Structure', HeadingLevel.HEADING_3),
    para(txt('[To be completed by the program administrator — specify whether prescriptions are shareable, any formulary restrictions, and maximum amounts.]', { italics: true, color: 'b91c1c' })),
    heading('Membership Eligibility Requirements', HeadingLevel.HEADING_3),
    para(txt('[To be completed by the program administrator — specify age limits, geographic restrictions, health attestation requirements, and any exclusion criteria.]', { italics: true, color: 'b91c1c' })),
    para([
      txt('Note to Program Administrator: ', { bold: true }),
      txt('The items highlighted in red above must be completed with your specific program rules before submission to the actuary. The actuary requires this information because utilization behavior is directly influenced by benefit design — they price the behavior a plan encourages.'),
    ]),
    hr(),
  );

  // -- Part 7: What Happens Next --
  sections.push(
    heading('Part 7: What Happens Next'),
    para(txt('Upon receiving this package with the accompanying CSV exports, the actuarial firm will typically:')),
    ...[
      'Validate dataset structure and credibility of exposure data',
      'Request CSV exports (available via one-click download from the admin panel)',
      'Run credibility analysis on the member-month exposure data',
      'Build a PMPM cost curve by age band and service month',
      'Compute completion factors from report and payment lag data',
      'Estimate expected loss ratio and trend',
      'Recommend contribution ranges by tier',
      'Recommend reserve levels (including IBNR)',
      'Recommend stop-loss attachment point',
      'Issue an Actuarial Memorandum',
    ].map((s, i) => para(txt(`${i + 1}. ${s}`))),
    para(txt('')),
    para(txt('The Actuarial Memorandum enables:', { bold: true })),
    bullet('Onboarding new organizations to the platform'),
    bullet('Proving program sustainability to partners and regulators'),
    bullet('Negotiating reinsurance or stop-loss coverage'),
    bullet('Defending against regulatory scrutiny'),
    bullet('Attracting larger advisor groups and institutional partnerships'),
    hr(),
    para(txt('End of Actuarial Data Submission Package v3.0', { italics: true, color: GRAY }), { alignment: AlignmentType.CENTER }),
  );

  return new Document({
    creator: 'Pay It Forward Technologies EMS',
    title: 'Actuarial Data Submission Package v3.0',
    description: 'De-identified actuarial experience data for funding review',
    sections: [{
      headers: {
        default: new Header({
          children: [para([
            txt('Pay It Forward HealthShare', { size: 16, color: GRAY }),
            txt('  |  Actuarial Submission Package v3.0', { size: 16, color: GRAY }),
          ])],
        }),
      },
      footers: {
        default: new Footer({
          children: [para(txt('CONFIDENTIAL — For Actuarial Review Only', { size: 16, color: GRAY }), { alignment: AlignmentType.CENTER })],
        }),
      },
      children: sections,
    }],
  });
}

// ---------------------------------------------------------------------------
// COVER EMAIL DOCUMENT
// ---------------------------------------------------------------------------
function buildCoverEmailDoc() {
  const children = [
    para(txt('COVER EMAIL — ACTUARIAL ENGAGEMENT', { bold: true, size: 28, color: BLUE }), { alignment: AlignmentType.CENTER }),
    para(txt(''), { spacing: { after: 200 } }),
    para([txt('Subject: ', { bold: true }), txt('Actuarial Funding Engagement — Pay It Forward HealthShare (Experience Data Enclosed)')]),
    hr(),
    para(txt('Dear [Actuarial Firm Name] Engagement Team,')),
    para(txt('We are writing to formally engage your firm to perform an actuarial funding adequacy review for the Pay It Forward HealthShare program, a health care sharing ministry program administered on the Pay It Forward Technologies EMS platform.')),
    para(txt('What We Are Requesting:', { bold: true })),
    bullet('Actuarial funding adequacy opinion'),
    bullet('Recommended member contribution ranges by age band'),
    bullet('Reserve guidance including IBNR estimation'),
    bullet('Stop-loss attachment point recommendation'),
    para(txt('What Is Enclosed:', { bold: true })),
    para([txt('1. Technical & Compliance Document (PDF/DOCX): ', { bold: true }), txt('Describes the de-identification methodology, dataset specifications, field definitions, and program structure.')]),
    para([txt('2. CSV Data Exports (zipped): ', { bold: true }), txt('Five datasets covering a 24-month experience period:')]),
    bullet('Dataset 1: Monthly Experience Summary'),
    bullet('Dataset 2: Needs Distribution by Type (Utilization Mix)'),
    bullet('Dataset 3: Contribution Adequacy (Revenue Side)'),
    bullet('Dataset 4: Age-Band Loss Experience (Risk Segmentation)'),
    bullet('Dataset 5: Member-Month Exposure and Claims Development'),
    para([txt('3. Program Structure Description: ', { bold: true }), txt('Initial Unshareable Amount (IUA) rules, waiting periods, sharing limits, and member eligibility requirements.')]),
    para(txt('About the Data:', { bold: true })),
    para(txt('All data is aggregated and de-identified at the database level. No individually identifiable health information is included. Small-group suppression (n < 5) is enforced. The dataset includes true daily member-month exposure calculations, incurred claims attributed to service month, and report/payment lag data suitable for completion factor analysis.')),
    para(txt('About the Platform:', { bold: true })),
    para(txt('Pay It Forward Technologies EMS is a proprietary administration platform built on Supabase (PostgreSQL) with real-time actuarial data extraction capabilities. The data provided is generated programmatically via secured database functions and can be refreshed on demand for any lookback period up to 60 months.')),
    para(txt('We look forward to your engagement letter and are available to discuss data specifications or provide additional breakdowns at your convenience.')),
    para(txt('')),
    para(txt('Respectfully,')),
    para(txt('')),
    para(txt('[Your Name]', { bold: true })),
    para(txt('[Your Title]')),
    para(txt('Pay It Forward HealthShare')),
    para(txt('[Phone] | [Email]')),
    hr(),
    para(txt('Note: Replace bracketed items with your actual contact details before sending.', { italics: true, color: GRAY, size: 18 })),
  ];

  return new Document({
    creator: 'Pay It Forward Technologies EMS',
    title: 'Cover Email — Actuarial Engagement',
    sections: [{ children }],
  });
}

// ---------------------------------------------------------------------------
// GENERATE
// ---------------------------------------------------------------------------
async function main() {
  console.log('Generating Word documents...\n');

  const submissionDoc = buildSubmissionDoc();
  const submissionBuf = await Packer.toBuffer(submissionDoc);
  const submissionPath = join(OUTPUT_DIR, 'PIF_Actuarial_Submission_Package_v3.docx');
  writeFileSync(submissionPath, submissionBuf);
  console.log(`  ✓ ${submissionPath}`);

  const coverDoc = buildCoverEmailDoc();
  const coverBuf = await Packer.toBuffer(coverDoc);
  const coverPath = join(OUTPUT_DIR, 'PIF_Cover_Email_Actuarial_Engagement.docx');
  writeFileSync(coverPath, coverBuf);
  console.log(`  ✓ ${coverPath}`);

  console.log('\nDone. Files saved to docs/actuarial/output/');
}

main().catch(err => {
  console.error('Failed to generate documents:', err);
  process.exit(1);
});
