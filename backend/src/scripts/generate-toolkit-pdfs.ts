/**
 * Generate Interest-Based Negotiation Toolkit PDFs and upload to S3.
 * Run: npx ts-node --project tsconfig.json src/scripts/generate-toolkit-pdfs.ts
 *
 * Creates 7 downloadable worksheets:
 *   1. Positions vs. Interests Framework
 *   2. Interest Mapping Worksheet
 *   3. BATNA Assessment Guide
 *   4. Reframing Exercises
 *   5. Manager Conversation Planner
 *   6. The Balcony Technique
 *   7. Conflict Type Diagnostic
 *
 * Uploads to: s3://{bucket}/toolkit/{filename}.pdf
 * Public URLs printed to console for frontend integration.
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

const BRAND = {
  navy: '#1B2A47',
  blue: '#3A9FD6',
  green: '#27C4A0',
  lightBg: '#EBF5FB',
  grey: '#5a6a7e',
  lightGrey: '#e8edf4',
};

function createDoc(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 60, left: 55, right: 55 },
    info: {
      Author: 'Helena Coaching × HeadSoft Tech',
      Creator: 'ARTES Conflict Intelligence Module',
    },
  });
}

function header(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
  doc.rect(0, 0, doc.page.width, 100).fill(BRAND.navy);
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
    .text(title, 55, 30, { width: doc.page.width - 110 });
  doc.fontSize(11).font('Helvetica')
    .text(subtitle, 55, 58, { width: doc.page.width - 110 });
  doc.fillColor(BRAND.navy);
  doc.y = 120;
}

function footer(doc: PDFKit.PDFDocument): void {
  const y = doc.page.height - 40;
  doc.fontSize(8).fillColor(BRAND.grey).font('Helvetica')
    .text('ARTES Conflict Intelligence™ — Helena Coaching × HeadSoft Tech', 55, y, {
      width: doc.page.width - 110,
      align: 'center',
    });
  doc.text('Grounded in the Harvard Negotiation Project — Fisher, Ury & Patton', 55, y + 10, {
    width: doc.page.width - 110,
    align: 'center',
  });
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string): void {
  doc.moveDown(0.8);
  doc.fontSize(14).fillColor(BRAND.blue).font('Helvetica-Bold').text(text);
  doc.moveDown(0.3);
  doc.fillColor(BRAND.navy).font('Helvetica').fontSize(10);
}

function bodyText(doc: PDFKit.PDFDocument, text: string): void {
  doc.fontSize(10).fillColor(BRAND.navy).font('Helvetica')
    .text(text, { lineGap: 3 });
  doc.moveDown(0.3);
}

function bulletList(doc: PDFKit.PDFDocument, items: string[]): void {
  for (const item of items) {
    doc.fontSize(10).fillColor(BRAND.navy).font('Helvetica')
      .text(`•  ${item}`, { indent: 12, lineGap: 2 });
  }
  doc.moveDown(0.4);
}

function numberedList(doc: PDFKit.PDFDocument, items: string[]): void {
  items.forEach((item, i) => {
    doc.fontSize(10).fillColor(BRAND.navy).font('Helvetica')
      .text(`${i + 1}.  ${item}`, { indent: 12, lineGap: 2 });
  });
  doc.moveDown(0.4);
}

function fillableField(doc: PDFKit.PDFDocument, label: string, lines: number = 3): void {
  doc.fontSize(10).fillColor(BRAND.blue).font('Helvetica-Bold')
    .text(label);
  doc.moveDown(0.2);
  for (let i = 0; i < lines; i++) {
    const y = doc.y;
    doc.moveTo(55, y).lineTo(doc.page.width - 55, y)
      .strokeColor(BRAND.lightGrey).lineWidth(0.5).stroke();
    doc.moveDown(1);
  }
  doc.moveDown(0.2);
}

function twoColumnTable(doc: PDFKit.PDFDocument, rows: [string, string][], headerRow: [string, string]): void {
  const colW = (doc.page.width - 110) / 2;
  const startX = 55;

  // Header
  doc.fontSize(10).fillColor(BRAND.blue).font('Helvetica-Bold');
  doc.text(headerRow[0], startX, doc.y, { width: colW, continued: false });
  const headerY = doc.y - doc.currentLineHeight();
  doc.text(headerRow[1], startX + colW, headerY, { width: colW });
  doc.moveDown(0.3);
  doc.moveTo(startX, doc.y).lineTo(startX + colW * 2, doc.y)
    .strokeColor(BRAND.blue).lineWidth(0.8).stroke();
  doc.moveDown(0.4);

  // Rows
  doc.font('Helvetica').fillColor(BRAND.navy);
  for (const [left, right] of rows) {
    const rowY = doc.y;
    doc.fontSize(10).text(left, startX, rowY, { width: colW - 10 });
    const leftH = doc.y - rowY;
    doc.text(right, startX + colW, rowY, { width: colW - 10 });
    const rightH = doc.y - (rowY + leftH);
    doc.y = rowY + Math.max(leftH, leftH + rightH) + 4;
    doc.moveTo(startX, doc.y).lineTo(startX + colW * 2, doc.y)
      .strokeColor(BRAND.lightGrey).lineWidth(0.3).stroke();
    doc.moveDown(0.3);
  }
  doc.moveDown(0.3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Document generators
// ─────────────────────────────────────────────────────────────────────────────

function positionsFramework(doc: PDFKit.PDFDocument): void {
  header(doc, 'Positions vs. Interests Framework', 'Interest-Based Negotiation Toolkit — Harvard Negotiation Project');
  footer(doc);

  sectionTitle(doc, 'The Core Distinction');
  bodyText(doc, 'A position is what someone says they want. An interest is why they want it. Durable conflict resolution requires moving past positions to discover the underlying interests that drive them.');
  bodyText(doc, '"The most powerful interests are basic human needs: security, economic well-being, a sense of belonging, recognition, and control over one\'s life." — Fisher, Ury & Patton, Getting to Yes');

  sectionTitle(doc, 'How to Spot the Difference');
  twoColumnTable(doc, [
    ['Statement of demand or solution', 'Underlying need, concern, or fear'],
    ['"I need a private office."', '"I need quiet to concentrate on complex work."'],
    ['"We need to hire two more people."', '"We can\'t meet deadlines with current capacity."'],
    ['"I want to be on that project."', '"I want recognition for my expertise in this area."'],
    ['"That deadline is impossible."', '"I\'m worried about quality if we rush."'],
  ], ['Position (What)', 'Interest (Why)']);

  sectionTitle(doc, 'Three Questions to Move from Positions to Interests');
  numberedList(doc, [
    '"Help me understand — what\'s most important to you about this?"',
    '"If you had that, what would it give you that you don\'t have now?"',
    '"What are you most concerned about if this doesn\'t work out?"',
  ]);

  sectionTitle(doc, 'The Five Categories of Interests');
  bodyText(doc, 'Fisher and Ury identify five bedrock interests that motivate all people in conflict:');
  bulletList(doc, [
    'Security — physical, financial, or job safety',
    'Economic well-being — compensation, resources, budget',
    'Belonging — inclusion, respect within the group',
    'Recognition — acknowledgement of contribution and competence',
    'Autonomy — control over one\'s work, decisions, and time',
  ]);

  sectionTitle(doc, 'Quick Self-Check');
  bodyText(doc, 'Before your next difficult conversation, ask yourself:');
  fillableField(doc, 'What is MY position?', 2);
  fillableField(doc, 'What interest is driving that position?', 2);
  fillableField(doc, 'What might the OTHER person\'s underlying interest be?', 2);
  fillableField(doc, 'Is there a solution that addresses both interests?', 2);
}

function interestMapping(doc: PDFKit.PDFDocument): void {
  header(doc, 'Interest Mapping Worksheet', 'Interest-Based Negotiation Toolkit — Harvard Negotiation Project');
  footer(doc);

  sectionTitle(doc, 'Purpose');
  bodyText(doc, 'Use this worksheet before entering a difficult conversation or mediation. Map each party\'s interests to find common ground and creative solutions. Complete one worksheet per conflict situation.');

  sectionTitle(doc, 'Step 1: Define the Situation');
  fillableField(doc, 'What is the conflict or disagreement about? (One sentence)', 2);
  fillableField(doc, 'Who are the parties involved?', 1);

  sectionTitle(doc, 'Step 2: Map Party A\'s Interests');
  fillableField(doc, 'What is Party A\'s stated position?', 2);
  fillableField(doc, 'What might Party A need? (security, recognition, autonomy, belonging, resources)', 3);
  fillableField(doc, 'What is Party A afraid of losing?', 2);

  sectionTitle(doc, 'Step 3: Map Party B\'s Interests');
  fillableField(doc, 'What is Party B\'s stated position?', 2);
  fillableField(doc, 'What might Party B need? (security, recognition, autonomy, belonging, resources)', 3);
  fillableField(doc, 'What is Party B afraid of losing?', 2);

  doc.addPage();
  footer(doc);

  sectionTitle(doc, 'Step 4: Identify Shared Interests');
  bodyText(doc, 'Look for interests that appear on both sides — these are the foundation for resolution.');
  fillableField(doc, 'What do both parties share? (e.g. team success, project quality, good working relationship)', 3);

  sectionTitle(doc, 'Step 5: Generate Options');
  bodyText(doc, 'Brainstorm at least three options that address the core interests of both parties. Do not evaluate yet — just generate.');
  fillableField(doc, 'Option 1:', 2);
  fillableField(doc, 'Option 2:', 2);
  fillableField(doc, 'Option 3:', 2);

  sectionTitle(doc, 'Step 6: Evaluate Against Interests');
  bodyText(doc, 'For each option, ask: Does this address Party A\'s core interest? Party B\'s? Which option addresses the most interests for both?');
  fillableField(doc, 'Best option and why:', 3);
}

function batnaGuide(doc: PDFKit.PDFDocument): void {
  header(doc, 'BATNA Assessment Guide', 'Interest-Based Negotiation Toolkit — Harvard Negotiation Project');
  footer(doc);

  sectionTitle(doc, 'What is a BATNA?');
  bodyText(doc, 'Your BATNA (Best Alternative To a Negotiated Agreement) is what you will do if the current negotiation fails. It is your walk-away point — the benchmark against which any proposed agreement should be measured.');
  bodyText(doc, '"The reason you negotiate is to produce something better than the results you can obtain without negotiating." — Fisher & Ury, Getting to Yes');

  sectionTitle(doc, 'Why It Matters in Workplace Conflict');
  bulletList(doc, [
    'A strong BATNA gives you confidence — you know you have options',
    'A weak BATNA signals you need this agreement more than you think',
    'Understanding the other party\'s BATNA helps you assess their flexibility',
    'A BATNA is not a threat — it is a private benchmark for your own decision-making',
  ]);

  sectionTitle(doc, 'Step 1: List Your Alternatives');
  bodyText(doc, 'If this conversation or negotiation fails, what are ALL your alternatives? List them without judging.');
  fillableField(doc, 'Alternative 1:', 2);
  fillableField(doc, 'Alternative 2:', 2);
  fillableField(doc, 'Alternative 3:', 2);

  sectionTitle(doc, 'Step 2: Evaluate Each Alternative');
  bodyText(doc, 'For each alternative, assess: How realistic is it? What are the costs? What do I lose?');
  fillableField(doc, 'Best alternative and why (this is your BATNA):', 3);

  sectionTitle(doc, 'Step 3: Strengthen Your BATNA');
  bodyText(doc, 'Can you improve your best alternative before entering the negotiation? The stronger your BATNA, the more confident and flexible you can be.');
  fillableField(doc, 'What could I do to make my BATNA stronger?', 3);

  sectionTitle(doc, 'Step 4: Consider Their BATNA');
  fillableField(doc, 'What is the other party\'s likely BATNA?', 2);
  fillableField(doc, 'How does their BATNA compare to what I\'m offering?', 2);

  sectionTitle(doc, 'Decision Rule');
  bodyText(doc, 'Accept any proposed agreement that is better than your BATNA. Reject any agreement that is worse. This keeps emotion out of the decision.');
}

function reframingExercises(doc: PDFKit.PDFDocument): void {
  header(doc, 'Reframing Exercises', 'Interest-Based Negotiation Toolkit — Harvard Negotiation Project');
  footer(doc);

  sectionTitle(doc, 'What is Reframing?');
  bodyText(doc, 'Reframing is the skill of converting positional, blaming, or adversarial statements into interest-based questions that open up dialogue. It is one of the most powerful tools in the Harvard negotiation method.');

  sectionTitle(doc, 'The Reframing Formula');
  bodyText(doc, 'When you hear a position or accusation, reframe it as a question about interests:');
  bulletList(doc, [
    'Position → "Help me understand what\'s important to you about that."',
    'Blame → "It sounds like [concern]. Can you tell me more?"',
    'Demand → "What would that give you that you don\'t have now?"',
    'Threat → "What are you most worried about here?"',
  ]);

  sectionTitle(doc, 'Practice: Reframe These Statements');
  bodyText(doc, 'For each positional statement, write an interest-based reframe:');

  const exercises = [
    '"That\'s not my job — I shouldn\'t have to do this."',
    '"You never listen to my ideas in meetings."',
    '"If we don\'t get more budget, this project will fail."',
    '"I need to work from home every Friday — no exceptions."',
    '"The new process is terrible. We should go back to the old way."',
    '"They always get the good projects and we get the leftovers."',
  ];

  for (const statement of exercises) {
    doc.fontSize(10).fillColor(BRAND.navy).font('Helvetica-Bold')
      .text(statement);
    fillableField(doc, 'Your reframe:', 2);
  }

  sectionTitle(doc, 'Sample Reframes');
  twoColumnTable(doc, [
    ['"That\'s not my job."', '"It sounds like role clarity is important to you — can we map out what you see as your responsibilities?"'],
    ['"You never listen."', '"I want to make sure your perspective is heard — what\'s the most important thing I\'m missing?"'],
    ['"We need more budget."', '"What would additional resources enable that you can\'t do now?"'],
  ], ['Positional Statement', 'Interest-Based Reframe']);
}

function managerPlanner(doc: PDFKit.PDFDocument): void {
  header(doc, 'Manager Conversation Planner', 'Interest-Based Negotiation Toolkit — Harvard Negotiation Project');
  footer(doc);

  sectionTitle(doc, 'Purpose');
  bodyText(doc, 'Use this planner to prepare for a conflict conversation using the four Harvard principles. Complete it before the meeting — preparation is the single biggest predictor of a productive outcome.');

  sectionTitle(doc, 'Before the Conversation');
  fillableField(doc, 'What is the situation? (Facts only — no judgments)', 3);
  fillableField(doc, 'What are MY interests in this conversation? (What do I need?)', 2);
  fillableField(doc, 'What might THEIR interests be? (What do they need?)', 2);
  fillableField(doc, 'What shared interests exist? (Team success, project quality, working relationship)', 2);

  sectionTitle(doc, 'Opening the Conversation (Principle 1: Separate People from Problem)');
  bodyText(doc, 'Start with shared purpose, not accusations. Example openings:');
  bulletList(doc, [
    '"I\'d like to talk about [situation] because I think we both want [shared goal]."',
    '"I\'ve noticed [observable behaviour] and I want to understand your perspective."',
    '"I value our working relationship and want to address something before it becomes a bigger issue."',
  ]);
  fillableField(doc, 'My opening statement:', 3);

  sectionTitle(doc, 'Exploring Interests (Principle 2: Focus on Interests)');
  bodyText(doc, 'Prepare 3 open-ended questions to explore underlying needs:');
  fillableField(doc, 'Question 1:', 2);
  fillableField(doc, 'Question 2:', 2);
  fillableField(doc, 'Question 3:', 2);

  doc.addPage();
  footer(doc);

  sectionTitle(doc, 'Generating Options (Principle 3: Invent Options for Mutual Gain)');
  bodyText(doc, 'Come with at least two possible solutions, but be ready to brainstorm more together.');
  fillableField(doc, 'Option A:', 2);
  fillableField(doc, 'Option B:', 2);
  fillableField(doc, 'Invitation to brainstorm: "What else might work for both of us?"', 1);

  sectionTitle(doc, 'Grounding in Criteria (Principle 4: Objective Criteria)');
  fillableField(doc, 'What objective standard, policy, or data can anchor this discussion?', 2);
  fillableField(doc, 'How will we measure whether the agreed solution is working?', 2);

  sectionTitle(doc, 'Closing the Conversation');
  bodyText(doc, 'End with clear commitments and a follow-up plan:');
  fillableField(doc, 'What specifically did we agree to?', 2);
  fillableField(doc, 'Who will do what, by when?', 2);
  fillableField(doc, 'When will we check in on progress?', 1);

  sectionTitle(doc, 'Post-Conversation Reflection');
  fillableField(doc, 'What went well?', 2);
  fillableField(doc, 'What would I do differently next time?', 2);
}

function balconyTechnique(doc: PDFKit.PDFDocument): void {
  header(doc, 'The Balcony Technique', 'Interest-Based Negotiation Toolkit — William Ury, Getting Past No');
  footer(doc);

  sectionTitle(doc, 'The Concept');
  bodyText(doc, 'William Ury\'s "Go to the Balcony" technique is about stepping back from reactive emotions to gain perspective — like stepping onto a balcony above a stage to observe the scene below. In workplace conflict, the AI analysis in ARTES serves as your "balcony view." This exercise helps you build the habit personally.');

  sectionTitle(doc, 'When to Use It');
  bulletList(doc, [
    'Before entering any difficult conversation',
    'When you notice your heart rate rising during a disagreement',
    'When you feel the urge to respond immediately to a provocation',
    'After receiving feedback that triggers a strong emotional reaction',
    'Before writing an email you might regret',
  ]);

  sectionTitle(doc, 'The 5-Step Balcony Process');

  doc.fontSize(11).fillColor(BRAND.blue).font('Helvetica-Bold')
    .text('Step 1: Pause');
  bodyText(doc, 'Stop. Do not respond yet. Take a breath. The pause itself is the most important step. Even 10 seconds changes the dynamic.');

  doc.fontSize(11).fillColor(BRAND.blue).font('Helvetica-Bold')
    .text('Step 2: Name What You\'re Feeling');
  bodyText(doc, 'Silently label your emotion: "I\'m feeling angry" or "I\'m feeling threatened." Research shows that naming an emotion reduces its intensity (affect labelling).');
  fillableField(doc, 'Right now, I am feeling:', 1);

  doc.fontSize(11).fillColor(BRAND.blue).font('Helvetica-Bold')
    .text('Step 3: Identify the Trigger');
  bodyText(doc, 'What specifically triggered your reaction? Separate the trigger from the story you\'re telling about it.');
  fillableField(doc, 'The trigger was:', 2);
  fillableField(doc, 'The story I\'m telling myself about it:', 2);

  doc.fontSize(11).fillColor(BRAND.blue).font('Helvetica-Bold')
    .text('Step 4: Look for the Interest');
  bodyText(doc, 'From the balcony, ask: What is the other person\'s underlying interest? What is mine? Is there a way to address both?');
  fillableField(doc, 'Their likely interest:', 2);
  fillableField(doc, 'My underlying interest:', 2);

  doc.fontSize(11).fillColor(BRAND.blue).font('Helvetica-Bold')
    .text('Step 5: Choose Your Response');
  bodyText(doc, 'Now — and only now — decide how to respond. You are responding from the balcony, not from the stage.');
  fillableField(doc, 'What I will say or do:', 3);

  sectionTitle(doc, 'Quick Reference: Balcony Phrases');
  bulletList(doc, [
    '"Let me think about that and come back to you."',
    '"I want to respond to this properly — can we continue this in 30 minutes?"',
    '"I notice I\'m having a strong reaction. Give me a moment."',
    '"Before I respond, help me understand your perspective better."',
  ]);
}

function conflictDiagnostic(doc: PDFKit.PDFDocument): void {
  header(doc, 'Conflict Type Diagnostic', 'Interest-Based Negotiation Toolkit — Harvard Negotiation Project');
  footer(doc);

  sectionTitle(doc, 'Purpose');
  bodyText(doc, 'Not all conflict is the same. The right intervention depends on correctly diagnosing the type of conflict. Use this diagnostic to identify the primary conflict type before choosing your approach.');

  sectionTitle(doc, 'The Four Conflict Types');

  doc.fontSize(11).fillColor(BRAND.blue).font('Helvetica-Bold')
    .text('1. Interpersonal Conflict');
  bodyText(doc, 'Between individuals — driven by personality friction, communication style mismatches, or accumulated resentment. Mapped to the Feelings and Identity Conversations.');
  bulletList(doc, [
    'Signals: avoidance between specific people, complaints about personality, "I can\'t work with them"',
    'Intervention: facilitated dialogue, coaching, relationship repair',
  ]);

  doc.fontSize(11).fillColor(BRAND.blue).font('Helvetica-Bold')
    .text('2. Structural Conflict');
  bodyText(doc, 'Generated by systems, not people — unclear roles, competing KPIs, resource scarcity, bad processes. Mapped to the "What Happened?" Conversation.');
  bulletList(doc, [
    'Signals: same conflict recurring with different people, cross-department friction, "the process is broken"',
    'Intervention: RACI clarification, process redesign, resource reallocation',
  ]);

  doc.fontSize(11).fillColor(BRAND.blue).font('Helvetica-Bold')
    .text('3. Cultural Conflict');
  bodyText(doc, 'Rooted in values, norms, or identity — generational, cross-cultural, or professional-culture clashes. Mapped to the Identity Conversation.');
  bulletList(doc, [
    'Signals: "that\'s not how we do things," discomfort with difference, exclusion patterns',
    'Intervention: inclusion training, norming exercises, values dialogue',
  ]);

  doc.fontSize(11).fillColor(BRAND.blue).font('Helvetica-Bold')
    .text('4. Positional Conflict');
  bodyText(doc, 'Two parties holding incompatible positions — often masking compatible interests. The most common type and the most responsive to the Harvard method.');
  bulletList(doc, [
    'Signals: deadlock, "my way or the highway," escalation of demands',
    'Intervention: interest mapping, option generation, objective criteria',
  ]);

  sectionTitle(doc, 'Diagnostic Checklist');
  bodyText(doc, 'For the conflict you are currently facing, check all that apply:');

  const checks = [
    ['□ The same conflict keeps happening with different people', 'Structural'],
    ['□ Two specific people cannot work together', 'Interpersonal'],
    ['□ The conflict involves values, identity, or "how we do things"', 'Cultural'],
    ['□ Both sides have stated incompatible demands', 'Positional'],
    ['□ The conflict gets worse under workload pressure', 'Structural'],
    ['□ Emotions run high even when discussing minor issues', 'Interpersonal / Identity'],
    ['□ The conflict crosses department or team boundaries', 'Structural'],
    ['□ One party feels their competence or worth is questioned', 'Cultural / Identity'],
  ];

  for (const [check, type] of checks) {
    doc.fontSize(10).fillColor(BRAND.navy).font('Helvetica')
      .text(`${check}  →  ${type}`, { indent: 12, lineGap: 4 });
  }

  doc.moveDown(0.5);
  fillableField(doc, 'Primary conflict type for this situation:', 1);
  fillableField(doc, 'Recommended intervention approach:', 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate and upload
// ─────────────────────────────────────────────────────────────────────────────

interface ToolkitDoc {
  filename: string;
  generator: (doc: PDFKit.PDFDocument) => void;
}

const documents: ToolkitDoc[] = [
  { filename: 'positions-vs-interests-framework', generator: positionsFramework },
  { filename: 'interest-mapping-worksheet', generator: interestMapping },
  { filename: 'batna-assessment-guide', generator: batnaGuide },
  { filename: 'reframing-exercises', generator: reframingExercises },
  { filename: 'manager-conversation-planner', generator: managerPlanner },
  { filename: 'balcony-technique', generator: balconyTechnique },
  { filename: 'conflict-type-diagnostic', generator: conflictDiagnostic },
];

async function generateAndUpload(): Promise<void> {
  const bucket = config.aws.s3Bucket;
  if (!bucket) throw new Error('AWS_S3_BUCKET not set in .env');

  console.log(`Uploading to bucket: ${bucket}\n`);
  const urls: string[] = [];

  for (const { filename, generator } of documents) {
    const doc = createDoc();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve());
      doc.on('error', reject);

      generator(doc);
      doc.end();
    });

    const buffer = Buffer.concat(chunks);
    const key = `toolkit/${filename}.pdf`;

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      ContentDisposition: `attachment; filename="${filename}.pdf"`,
    }));

    const url = `https://${bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
    urls.push(url);
    console.log(`  ✓  ${filename}.pdf  (${(buffer.length / 1024).toFixed(1)} KB)  →  ${url}`);
  }

  console.log('\n─────────────────────────────────────');
  console.log(`  ${urls.length} toolkit PDFs uploaded to S3`);
  console.log('─────────────────────────────────────\n');
  console.log('URLs for frontend integration:');
  console.log(JSON.stringify(urls, null, 2));
}

generateAndUpload().catch((err) => {
  console.error(err);
  process.exit(1);
});
