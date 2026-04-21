/**
 * Generate Interest-Based Negotiation Toolkit PDFs and upload to S3.
 * Run: npx ts-node --project tsconfig.json src/scripts/generate-toolkit-pdfs.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/env';

const s3 = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

const C = { navy: '#1B2A47', blue: '#3A9FD6', green: '#27C4A0', grey: '#5a6a7e', line: '#d0d7e0' };
const L = 50;                    // left margin
const R = 545;                   // right edge (A4 width 595 - 50)
const W = R - L;                 // content width
const BOT = 780;                 // bottom safe zone

function mk(): PDFKit.PDFDocument {
  return new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: L, right: 50 },
    info: { Author: 'Helena Coaching', Creator: 'ARTES' } });
}

function needSpace(doc: PDFKit.PDFDocument, h: number): void {
  if (doc.y + h > BOT) { doc.addPage(); doc.y = 50; }
}

function hdr(doc: PDFKit.PDFDocument, title: string): void {
  doc.rect(0, 0, 595, 80).fill(C.navy);
  doc.fill('#fff').font('Helvetica-Bold').fontSize(18).text(title, L, 22, { width: W });
  doc.font('Helvetica').fontSize(9)
    .text('Interest-Based Negotiation Toolkit — Harvard Negotiation Project', L, 50, { width: W });
  doc.fillColor(C.navy); doc.y = 95;
}

function ftr(doc: PDFKit.PDFDocument): void {
  const pages = (doc as any).bufferedPageRange?.() ?? { start: 0, count: 0 };
  for (let i = 0; i < (pages.count || 1); i++) {
    (doc as any).switchToPage?.(i);
  }
  doc.fontSize(7).fillColor(C.grey).font('Helvetica')
    .text('ARTES Conflict Intelligence — Helena Coaching × HeadSoft Tech  |  Harvard Negotiation Project',
      L, 810, { width: W, align: 'center' });
}

function sec(doc: PDFKit.PDFDocument, text: string): void {
  needSpace(doc, 30);
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.blue).text(text, L, doc.y, { width: W });
  doc.moveDown(0.15); doc.font('Helvetica').fontSize(9.5).fillColor(C.navy);
}

function p(doc: PDFKit.PDFDocument, text: string): void {
  needSpace(doc, 20);
  doc.font('Helvetica').fontSize(9.5).fillColor(C.navy).text(text, L, doc.y, { width: W, lineGap: 2 });
  doc.moveDown(0.2);
}

function italic(doc: PDFKit.PDFDocument, text: string): void {
  needSpace(doc, 20);
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(C.grey).text(text, L, doc.y, { width: W, lineGap: 2 });
  doc.moveDown(0.2); doc.font('Helvetica').fillColor(C.navy);
}

function bullets(doc: PDFKit.PDFDocument, items: string[]): void {
  for (const item of items) {
    needSpace(doc, 14);
    doc.font('Helvetica').fontSize(9.5).fillColor(C.navy)
      .text(`\u2022  ${item}`, L + 8, doc.y, { width: W - 8, lineGap: 1.5 });
  }
  doc.moveDown(0.15);
}

function nums(doc: PDFKit.PDFDocument, items: string[]): void {
  items.forEach((item, i) => {
    needSpace(doc, 14);
    doc.font('Helvetica').fontSize(9.5).fillColor(C.navy)
      .text(`${i + 1}.  ${item}`, L + 8, doc.y, { width: W - 8, lineGap: 1.5 });
  });
  doc.moveDown(0.15);
}

function field(doc: PDFKit.PDFDocument, label: string, lines = 2): void {
  needSpace(doc, 12 + lines * 16);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.blue).text(label, L, doc.y, { width: W });
  doc.moveDown(0.1);
  for (let i = 0; i < lines; i++) {
    doc.moveTo(L, doc.y + 12).lineTo(R, doc.y + 12).strokeColor(C.line).lineWidth(0.5).stroke();
    doc.y += 16;
  }
  doc.moveDown(0.1);
}

function subsec(doc: PDFKit.PDFDocument, text: string): void {
  needSpace(doc, 22);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.blue).text(text, L, doc.y, { width: W });
  doc.moveDown(0.1); doc.font('Helvetica').fontSize(9.5).fillColor(C.navy);
}

function table(doc: PDFKit.PDFDocument, headers: [string, string], rows: [string, string][]): void {
  const col1 = W * 0.42;
  const col2 = W - col1;

  needSpace(doc, 20 + rows.length * 28);

  // header row
  const hy = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.blue);
  doc.text(headers[0], L, hy, { width: col1 - 6 });
  doc.text(headers[1], L + col1, hy, { width: col2 - 6 });
  const afterH = Math.max(doc.y, hy + 12);
  doc.moveTo(L, afterH + 2).lineTo(R, afterH + 2).strokeColor(C.blue).lineWidth(0.6).stroke();
  doc.y = afterH + 6;

  // data rows
  doc.font('Helvetica').fontSize(9).fillColor(C.navy);
  for (const [c1, c2] of rows) {
    const ry = doc.y;
    needSpace(doc, 26);
    const startY = doc.y;

    // measure both columns
    const h1 = doc.heightOfString(c1, { width: col1 - 10 });
    const h2 = doc.heightOfString(c2, { width: col2 - 10 });
    const rowH = Math.max(h1, h2);

    doc.text(c1, L, startY, { width: col1 - 10 });
    doc.text(c2, L + col1, startY, { width: col2 - 10 });
    doc.y = startY + rowH + 4;
    doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor(C.line).lineWidth(0.3).stroke();
    doc.y += 4;
  }
  doc.moveDown(0.15);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Positions vs. Interests Framework
// ═══════════════════════════════════════════════════════════════════════════════
function positionsFramework(doc: PDFKit.PDFDocument): void {
  hdr(doc, 'Positions vs. Interests Framework');

  sec(doc, 'The Core Distinction');
  p(doc, 'A position is what someone says they want. An interest is why they want it. Durable conflict resolution requires moving past positions to discover the underlying interests that drive them.');
  italic(doc, '"The most powerful interests are basic human needs: security, economic well-being, a sense of belonging, recognition, and control over one\'s life." — Fisher, Ury & Patton');

  sec(doc, 'How to Spot the Difference');
  table(doc, ['Position (What)', 'Interest (Why)'], [
    ['Statement of demand or solution', 'Underlying need, concern, or fear'],
    ['"I need a private office."', '"I need quiet to concentrate on complex work."'],
    ['"We need to hire two more people."', '"We can\'t meet deadlines with current capacity."'],
    ['"I want to be on that project."', '"I want recognition for my expertise."'],
    ['"That deadline is impossible."', '"I\'m worried about quality if we rush."'],
  ]);

  sec(doc, 'Three Questions to Move from Positions to Interests');
  nums(doc, [
    '"Help me understand — what\'s most important to you about this?"',
    '"If you had that, what would it give you that you don\'t have now?"',
    '"What are you most concerned about if this doesn\'t work out?"',
  ]);

  sec(doc, 'The Five Categories of Interests');
  bullets(doc, [
    'Security — physical, financial, or job safety',
    'Economic well-being — compensation, resources, budget',
    'Belonging — inclusion, respect within the group',
    'Recognition — acknowledgement of contribution and competence',
    'Autonomy — control over one\'s work, decisions, and time',
  ]);

  sec(doc, 'Quick Self-Check');
  field(doc, 'What is MY position?', 2);
  field(doc, 'What interest is driving that position?', 2);
  field(doc, 'What might the OTHER person\'s underlying interest be?', 2);
  field(doc, 'Is there a solution that addresses both interests?', 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Interest Mapping Worksheet
// ═══════════════════════════════════════════════════════════════════════════════
function interestMapping(doc: PDFKit.PDFDocument): void {
  hdr(doc, 'Interest Mapping Worksheet');

  sec(doc, 'Purpose');
  p(doc, 'Use this worksheet before a difficult conversation or mediation. Map each party\'s interests to find common ground and creative solutions.');

  sec(doc, 'Step 1: Define the Situation');
  field(doc, 'What is the conflict about? (One sentence)', 2);
  field(doc, 'Who are the parties involved?', 1);

  sec(doc, 'Step 2: Map Party A\'s Interests');
  field(doc, 'Party A\'s stated position:', 2);
  field(doc, 'What might Party A need? (security, recognition, autonomy, belonging, resources)', 2);
  field(doc, 'What is Party A afraid of losing?', 2);

  sec(doc, 'Step 3: Map Party B\'s Interests');
  field(doc, 'Party B\'s stated position:', 2);
  field(doc, 'What might Party B need?', 2);
  field(doc, 'What is Party B afraid of losing?', 2);

  sec(doc, 'Step 4: Identify Shared Interests');
  p(doc, 'Look for interests that appear on both sides — these are the foundation for resolution.');
  field(doc, 'What do both parties share?', 2);

  sec(doc, 'Step 5: Generate Options');
  p(doc, 'Brainstorm at least three options. Do not evaluate yet — just generate.');
  field(doc, 'Option 1:', 2);
  field(doc, 'Option 2:', 2);
  field(doc, 'Option 3:', 2);

  sec(doc, 'Step 6: Evaluate Against Interests');
  p(doc, 'Does each option address Party A\'s core interest? Party B\'s? Which addresses the most interests?');
  field(doc, 'Best option and why:', 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. BATNA Assessment Guide
// ═══════════════════════════════════════════════════════════════════════════════
function batnaGuide(doc: PDFKit.PDFDocument): void {
  hdr(doc, 'BATNA Assessment Guide');

  sec(doc, 'What is a BATNA?');
  p(doc, 'Your BATNA (Best Alternative To a Negotiated Agreement) is what you will do if the negotiation fails. It is your walk-away benchmark.');
  italic(doc, '"The reason you negotiate is to produce something better than the results you can obtain without negotiating." — Fisher & Ury');

  sec(doc, 'Why It Matters');
  bullets(doc, [
    'A strong BATNA gives you confidence — you know you have options',
    'A weak BATNA signals you need this agreement more than you think',
    'Understanding the other party\'s BATNA helps you assess their flexibility',
    'A BATNA is not a threat — it is a private benchmark for decision-making',
  ]);

  sec(doc, 'Step 1: List Your Alternatives');
  p(doc, 'If this negotiation fails, what are ALL your alternatives?');
  field(doc, 'Alternative 1:', 2);
  field(doc, 'Alternative 2:', 2);
  field(doc, 'Alternative 3:', 2);

  sec(doc, 'Step 2: Evaluate Each Alternative');
  p(doc, 'For each: How realistic is it? What are the costs? What do I lose?');
  field(doc, 'Best alternative (this is your BATNA):', 2);

  sec(doc, 'Step 3: Strengthen Your BATNA');
  field(doc, 'What could I do to make my BATNA stronger?', 2);

  sec(doc, 'Step 4: Consider Their BATNA');
  field(doc, 'What is the other party\'s likely BATNA?', 2);
  field(doc, 'How does their BATNA compare to what I\'m offering?', 2);

  sec(doc, 'Decision Rule');
  p(doc, 'Accept any agreement better than your BATNA. Reject any agreement worse. This keeps emotion out of the decision.');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Reframing Exercises
// ═══════════════════════════════════════════════════════════════════════════════
function reframingExercises(doc: PDFKit.PDFDocument): void {
  hdr(doc, 'Reframing Exercises');

  sec(doc, 'What is Reframing?');
  p(doc, 'Reframing converts positional, blaming, or adversarial statements into interest-based questions that open dialogue. It is one of the most powerful Harvard negotiation tools.');

  sec(doc, 'The Reframing Formula');
  bullets(doc, [
    'Position \u2192 "Help me understand what\'s important to you about that."',
    'Blame \u2192 "It sounds like [concern]. Can you tell me more?"',
    'Demand \u2192 "What would that give you that you don\'t have now?"',
    'Threat \u2192 "What are you most worried about here?"',
  ]);

  sec(doc, 'Practice: Reframe These Statements');
  const exercises = [
    '"That\'s not my job — I shouldn\'t have to do this."',
    '"You never listen to my ideas in meetings."',
    '"If we don\'t get more budget, this project will fail."',
    '"I need to work from home every Friday — no exceptions."',
    '"The new process is terrible. Go back to the old way."',
    '"They always get the good projects and we get the leftovers."',
  ];
  for (const stmt of exercises) {
    needSpace(doc, 50);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.navy).text(stmt, L, doc.y, { width: W });
    field(doc, 'Your reframe:', 1);
  }

  sec(doc, 'Sample Reframes');
  table(doc, ['Positional Statement', 'Interest-Based Reframe'], [
    ['"That\'s not my job."', '"It sounds like role clarity matters — can we map responsibilities?"'],
    ['"You never listen."', '"I want to make sure your perspective is heard — what am I missing?"'],
    ['"We need more budget."', '"What would additional resources enable that you can\'t do now?"'],
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Manager Conversation Planner
// ═══════════════════════════════════════════════════════════════════════════════
function managerPlanner(doc: PDFKit.PDFDocument): void {
  hdr(doc, 'Manager Conversation Planner');

  sec(doc, 'Before the Conversation');
  field(doc, 'Situation (facts only — no judgments):', 2);
  field(doc, 'My interests (what do I need?):', 2);
  field(doc, 'Their likely interests (what do they need?):', 2);
  field(doc, 'Shared interests:', 2);

  sec(doc, 'Opening (Principle 1: Separate People from Problem)');
  p(doc, 'Start with shared purpose, not accusations. Examples:');
  bullets(doc, [
    '"I\'d like to talk about [situation] because I think we both want [shared goal]."',
    '"I\'ve noticed [behaviour] and I want to understand your perspective."',
  ]);
  field(doc, 'My opening statement:', 2);

  sec(doc, 'Exploring Interests (Principle 2: Focus on Interests)');
  field(doc, 'Question 1:', 1);
  field(doc, 'Question 2:', 1);
  field(doc, 'Question 3:', 1);

  sec(doc, 'Generating Options (Principle 3: Mutual Gain)');
  field(doc, 'Option A:', 2);
  field(doc, 'Option B:', 2);

  sec(doc, 'Objective Criteria (Principle 4)');
  field(doc, 'What standard, policy, or data anchors this discussion?', 2);
  field(doc, 'How will we measure whether the solution is working?', 2);

  sec(doc, 'Closing');
  field(doc, 'What did we agree to?', 2);
  field(doc, 'Who will do what, by when?', 2);
  field(doc, 'When will we check in?', 1);

  sec(doc, 'Post-Conversation Reflection');
  field(doc, 'What went well?', 2);
  field(doc, 'What would I do differently?', 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. The Balcony Technique
// ═══════════════════════════════════════════════════════════════════════════════
function balconyTechnique(doc: PDFKit.PDFDocument): void {
  hdr(doc, 'The Balcony Technique');

  sec(doc, 'The Concept');
  p(doc, 'William Ury\'s "Go to the Balcony" is about stepping back from reactive emotions to gain perspective — like stepping onto a balcony above a stage. The AI analysis in ARTES serves as your "balcony view." This exercise builds the habit personally.');

  sec(doc, 'When to Use It');
  bullets(doc, [
    'Before entering any difficult conversation',
    'When your heart rate rises during a disagreement',
    'When you feel the urge to respond immediately to a provocation',
    'After receiving feedback that triggers a strong emotional reaction',
    'Before writing an email you might regret',
  ]);

  sec(doc, 'The 5-Step Balcony Process');

  subsec(doc, 'Step 1: Pause');
  p(doc, 'Stop. Do not respond yet. Take a breath. Even 10 seconds changes the dynamic.');

  subsec(doc, 'Step 2: Name What You\'re Feeling');
  p(doc, 'Silently label your emotion: "I\'m feeling angry" or "threatened." Naming reduces intensity.');
  field(doc, 'Right now, I am feeling:', 1);

  subsec(doc, 'Step 3: Identify the Trigger');
  p(doc, 'Separate the trigger from the story you\'re telling about it.');
  field(doc, 'The trigger was:', 1);
  field(doc, 'The story I\'m telling myself:', 1);

  subsec(doc, 'Step 4: Look for the Interest');
  p(doc, 'From the balcony: What is the other person\'s underlying interest? What is mine?');
  field(doc, 'Their likely interest:', 1);
  field(doc, 'My underlying interest:', 1);

  subsec(doc, 'Step 5: Choose Your Response');
  p(doc, 'Now — and only now — decide how to respond. You are responding from the balcony, not the stage.');
  field(doc, 'What I will say or do:', 2);

  sec(doc, 'Quick Reference: Balcony Phrases');
  bullets(doc, [
    '"Let me think about that and come back to you."',
    '"I want to respond properly — can we continue in 30 minutes?"',
    '"I notice I\'m having a strong reaction. Give me a moment."',
    '"Before I respond, help me understand your perspective better."',
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Conflict Type Diagnostic
// ═══════════════════════════════════════════════════════════════════════════════
function conflictDiagnostic(doc: PDFKit.PDFDocument): void {
  hdr(doc, 'Conflict Type Diagnostic');

  sec(doc, 'The Four Conflict Types');

  subsec(doc, '1. Interpersonal');
  p(doc, 'Between individuals — personality friction, communication mismatches, accumulated resentment. Maps to the Feelings and Identity Conversations.');
  bullets(doc, [
    'Signals: avoidance, personality complaints, "I can\'t work with them"',
    'Intervention: facilitated dialogue, coaching, relationship repair',
  ]);

  subsec(doc, '2. Structural');
  p(doc, 'Generated by systems — unclear roles, competing KPIs, resource scarcity. Maps to "What Happened?"');
  bullets(doc, [
    'Signals: same conflict with different people, cross-dept friction, "the process is broken"',
    'Intervention: RACI clarification, process redesign, resource reallocation',
  ]);

  subsec(doc, '3. Cultural');
  p(doc, 'Rooted in values, norms, or identity — generational, cross-cultural, or professional clashes. Maps to Identity Conversation.');
  bullets(doc, [
    'Signals: "that\'s not how we do things," discomfort with difference',
    'Intervention: inclusion training, norming exercises, values dialogue',
  ]);

  subsec(doc, '4. Positional');
  p(doc, 'Incompatible positions masking compatible interests. Most responsive to the Harvard method.');
  bullets(doc, [
    'Signals: deadlock, escalation of demands, "my way or the highway"',
    'Intervention: interest mapping, option generation, objective criteria',
  ]);

  sec(doc, 'Diagnostic Checklist');
  p(doc, 'Check all that apply to the conflict you are currently facing:');
  table(doc, ['Signal', 'Likely Type'], [
    ['Same conflict keeps happening with different people', 'Structural'],
    ['Two specific people cannot work together', 'Interpersonal'],
    ['Involves values, identity, or "how we do things"', 'Cultural'],
    ['Both sides have stated incompatible demands', 'Positional'],
    ['Gets worse under workload pressure', 'Structural'],
    ['Emotions run high even on minor issues', 'Interpersonal'],
    ['Crosses department or team boundaries', 'Structural'],
    ['One party feels competence or worth questioned', 'Cultural / Identity'],
  ]);

  field(doc, 'Primary conflict type for this situation:', 1);
  field(doc, 'Recommended intervention approach:', 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Generate and upload
// ═══════════════════════════════════════════════════════════════════════════════

const documents = [
  { filename: 'positions-vs-interests-framework', gen: positionsFramework },
  { filename: 'interest-mapping-worksheet', gen: interestMapping },
  { filename: 'batna-assessment-guide', gen: batnaGuide },
  { filename: 'reframing-exercises', gen: reframingExercises },
  { filename: 'manager-conversation-planner', gen: managerPlanner },
  { filename: 'balcony-technique', gen: balconyTechnique },
  { filename: 'conflict-type-diagnostic', gen: conflictDiagnostic },
];

async function run(): Promise<void> {
  const bucket = config.aws.s3Bucket;
  if (!bucket) throw new Error('AWS_S3_BUCKET not set');
  console.log(`Bucket: ${bucket}\n`);

  for (const { filename, gen } of documents) {
    const doc = mk();
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', resolve);
      doc.on('error', reject);
      gen(doc);
      doc.end();
    });
    const buf = Buffer.concat(chunks);
    const key = `toolkit/${filename}.pdf`;
    await s3.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: buf,
      ContentType: 'application/pdf',
      ContentDisposition: `inline; filename="${filename}.pdf"`,
    }));
    console.log(`  \u2713  ${filename}.pdf  (${(buf.length / 1024).toFixed(1)} KB)`);
  }
  console.log('\nDone.');
}

run().catch((e) => { console.error(e); process.exit(1); });
