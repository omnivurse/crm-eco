/**
 * @fileoverview Generates a Part 6 Program Structure worksheet for the program administrator.
 * Run: node docs/actuarial/generate-part6-worksheet.mjs
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  Header, Footer,
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

function answerBox(lines = 5) {
  const rows = [];
  for (let i = 0; i < lines; i++) {
    rows.push(new TableRow({
      children: [new TableCell({
        shading: i === 0 ? { type: ShadingType.SOLID, color: LIGHT_BG } : undefined,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
        },
        children: [para(txt(' ', { size: 22 }), { spacing: { before: 80, after: 80 } })],
      })],
    }));
  }
  return new Table({ width: { size: 9000, type: WidthType.DXA }, rows });
}

function buildDoc() {
  const s = [];

  // Title
  s.push(
    para(txt('Double Helix Hub', { bold: true, size: 36, color: BLUE }), { alignment: AlignmentType.CENTER }),
    para(txt('Part 6: Program Structure Description \u2014 Worksheet', { bold: true, size: 28, color: DARK }), { alignment: AlignmentType.CENTER }),
    new Paragraph({ spacing: { before: 200 }, children: [] }),
    para([
      txt('Instructions: ', { bold: true }),
      txt('Please complete each section below with your specific program rules. The actuarial firm requires this information because utilization behavior is directly influenced by benefit design \u2014 they price the behavior a plan encourages. Write 1\u20133 sentences for each item. If a section does not apply to your program, write "Not applicable" with a brief explanation.'),
    ], { alignment: AlignmentType.JUSTIFIED }),
    para([
      txt('This completed worksheet will be inserted into Part 6 of the Actuarial Data Submission Package before sending to the actuary.', { italics: true, color: GRAY }),
    ]),
    hr(),
  );

  // Section 1
  s.push(
    heading('1. Waiting Periods', HeadingLevel.HEADING_2),
    para(txt('How long must a new member wait before their needs are eligible for sharing? Are there different waiting periods for different types of needs?', { color: GRAY, italics: true })),
    para(txt('Examples: "General needs: 30 days. Pre-existing conditions: 12 months. Maternity: 10 months." or "No waiting period for preventive care."', { color: GRAY, size: 20, italics: true })),
    answerBox(4),
    hr(),
  );

  // Section 2
  s.push(
    heading('2. Pre-Existing Condition Sharing Rules', HeadingLevel.HEADING_2),
    para(txt('Are pre-existing conditions shareable? If so, after what waiting period? Are there any limitations on sharing amounts for pre-existing conditions?', { color: GRAY, italics: true })),
    para(txt('Examples: "Pre-existing conditions are shareable after a 24-month waiting period, up to a maximum of $50,000 per incident." or "Pre-existing conditions are not shareable."', { color: GRAY, size: 20, italics: true })),
    answerBox(4),
    hr(),
  );

  // Section 3
  s.push(
    heading('3. Maternity Sharing Rules', HeadingLevel.HEADING_2),
    para(txt('Is maternity shareable? What are the eligibility requirements and waiting periods? What is the maximum sharing amount for maternity?', { color: GRAY, italics: true })),
    para(txt('Examples: "Maternity is shareable after 10 months of continuous membership. Normal delivery up to $5,000; C-section up to $7,500. Complications covered separately." or "Maternity is not shareable."', { color: GRAY, size: 20, italics: true })),
    answerBox(4),
    hr(),
  );

  // Section 4
  s.push(
    heading('4. Maximum Sharing Limits', HeadingLevel.HEADING_2),
    para(txt('What are the per-need, annual, and lifetime maximum sharing amounts? Are there different limits by plan tier?', { color: GRAY, italics: true })),
    para(txt('Examples: "Per-need maximum: $250,000. Annual maximum: $500,000. No lifetime maximum." or "Tier 1: $125,000/incident, Tier 2: $250,000/incident, Tier 3: $500,000/incident."', { color: GRAY, size: 20, italics: true })),
    answerBox(4),
    hr(),
  );

  // Section 5
  s.push(
    heading('5. Network / Reference Pricing', HeadingLevel.HEADING_2),
    para(txt('Does the program use a PPO network, reference-based pricing, or cash-pay discount arrangements? How are provider charges evaluated?', { color: GRAY, italics: true })),
    para(txt('Examples: "Members are encouraged to use the First Health PPO network. Out-of-network needs are repriced to 150% of Medicare rates." or "We use reference-based pricing at 140% of Medicare for all facility charges."', { color: GRAY, size: 20, italics: true })),
    answerBox(4),
    hr(),
  );

  // Section 6
  s.push(
    heading('6. Prescription Sharing Structure', HeadingLevel.HEADING_2),
    para(txt('Are prescriptions shareable? Is there a formulary? What are the maximum amounts or any restrictions?', { color: GRAY, italics: true })),
    para(txt('Examples: "Prescriptions are not shareable." or "Generic prescriptions are shareable up to $100/month. Specialty prescriptions shareable up to $3,000/month after IUA." or "Prescriptions managed through a discount card program (not shared)."', { color: GRAY, size: 20, italics: true })),
    answerBox(4),
    hr(),
  );

  // Section 7
  s.push(
    heading('7. Membership Eligibility Requirements', HeadingLevel.HEADING_2),
    para(txt('Who is eligible to join? Are there age limits, geographic restrictions, health attestation requirements, or exclusion criteria?', { color: GRAY, italics: true })),
    para(txt('Examples: "Open to individuals and families in all 50 states. Members must sign a statement of shared beliefs. No age limit. Health questionnaire required at enrollment but does not affect eligibility." or "Ages 0-64 only. Must reside in the United States."', { color: GRAY, size: 20, italics: true })),
    answerBox(4),
    hr(),
  );

  // IUA (pre-filled)
  s.push(
    heading('8. Initial Unshareable Amount (IUA) \u2014 Already Documented', HeadingLevel.HEADING_2),
    para(txt('The following is already included in the submission document. Please review and confirm or update:', { color: GRAY, italics: true })),
    para(txt('The IUA functions as the member\'s responsibility threshold before sharing begins (analogous to a deductible). The IUA amount varies by plan tier and is configured per product. Members must meet their IUA before needs are eligible for sharing. The system tracks IUA amount, remaining IUA, and IUA-met status per need.')),
    para(txt('If you need to add IUA tier details (e.g., "Tier 1: $1,000 IUA, Tier 2: $2,500 IUA, Tier 3: $5,000 IUA"), please specify below:', { color: GRAY, italics: true })),
    answerBox(3),
    hr(),
  );

  // Signature
  s.push(
    new Paragraph({ spacing: { before: 400 }, children: [] }),
    para(txt('Completed by:', { bold: true })),
    new Paragraph({ spacing: { before: 100 }, children: [] }),
    para(txt('Name: _______________________________________________')),
    para(txt('Title: _______________________________________________')),
    para(txt('Date: _______________________________________________')),
    new Paragraph({ spacing: { before: 200 }, children: [] }),
    para(txt('Please return this completed worksheet so it can be incorporated into the Actuarial Data Submission Package before submission.', { italics: true, color: GRAY })),
  );

  return new Document({
    creator: 'Double Helix Hub Technologies EMS',
    title: 'Part 6: Program Structure Worksheet',
    sections: [{
      headers: {
        default: new Header({
          children: [para([txt('Double Helix Hub', { size: 16, color: GRAY }), txt('  |  Part 6 Worksheet', { size: 16, color: GRAY })])],
        }),
      },
      footers: {
        default: new Footer({
          children: [para(txt('CONFIDENTIAL \u2014 Program Structure Worksheet', { size: 16, color: GRAY }), { alignment: AlignmentType.CENTER })],
        }),
      },
      children: s,
    }],
  });
}

async function main() {
  console.log('Generating Part 6 worksheet...\n');
  const doc = buildDoc();
  const buf = await Packer.toBuffer(doc);
  const out = join(OUTPUT_DIR, 'DHH_Part6_Program_Structure_Worksheet.docx');
  writeFileSync(out, buf);
  console.log(`  \u2713 ${out}`);
  console.log('\nDone.');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
