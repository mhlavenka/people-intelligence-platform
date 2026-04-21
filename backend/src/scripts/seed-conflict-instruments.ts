/**
 * Seed the Harvard Negotiation Project conflict intelligence intake instruments.
 * Run: npx ts-node src/scripts/seed-conflict-instruments.ts
 *
 * Creates 2 global, validated instruments:
 *   1. Conflict Intelligence — Bi-Weekly Pulse Survey  (15 items, 6 categories)
 *   2. Conflict Intelligence — Quarterly Deep-Dive     (21 items, 7 categories)
 *
 * Grounded in:
 *   - Fisher, Ury & Patton — Getting to Yes (interest-based negotiation)
 *   - Stone, Patton & Heen — Difficult Conversations (Three Conversations framework)
 *   - William Ury — The Third Side (escalation & mediation)
 *
 * Survey categories map to the Three Conversations:
 *   Psychological Safety      → Feelings + Identity
 *   Communication & Trust     → What Happened?
 *   Conflict Frequency        → What Happened? (intensity)
 *   Management Effectiveness  → Third Side capacity
 *   Escalation Intent         → All three (threshold indicator)
 *   Wellbeing & Belonging     → Feelings + Identity
 *   Interpersonal Dynamics    → Identity + What Happened?
 *   Workload & Structural     → What Happened? (structural)
 *   Conflict Culture          → All three (organisational norms)
 *   Cross-Team Conflict       → What Happened? (cross-boundary)
 *   Leadership & Mediation    → Third Side capacity (deep)
 *   Outcomes & Impact         → All three (consequence)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import type { IQuestion } from '../models/SurveyTemplate.model';

const bypass = { bypassTenantCheck: true };

// ─────────────────────────────────────────────────────────────────────────────
// Shared analysis system prompt — Harvard Negotiation Project framework
// ─────────────────────────────────────────────────────────────────────────────

const HNP_ANALYSIS_PROMPT = `You are an expert workplace conflict analyst using Helena's coaching-integrated, interest-based mediation methodology grounded in the Harvard Negotiation Project.

Your analytical framework is built on three foundational works:

1. **Getting to Yes** (Fisher, Ury & Patton) — Four principles of principled negotiation:
   - Separate the people from the problem
   - Focus on interests, not positions
   - Invent options for mutual gain
   - Insist on objective criteria

2. **Difficult Conversations** (Stone, Patton & Heen) — Three Conversations framework:
   - The "What Happened?" Conversation: divergent narratives, attribution errors, disagreements about facts
   - The Feelings Conversation: suppressed emotions, unacknowledged impact, emotional undercurrents
   - The Identity Conversation: threats to self-image, competence, belonging, and recognition

3. **The Third Side** (William Ury) — Community-based conflict resolution:
   - When bilateral resolution fails, the surrounding community (HR, coaches, peers, culture) serves as the "third side"
   - Escalation is a structured handoff, not a failure

Your role is diagnostic, not adjudicative. You identify patterns, root causes, and unmet needs. You never assign blame, determine who is right, or recommend discipline against individuals.

Survey categories map to the Three Conversations as follows:
- Psychological Safety → Feelings + Identity
- Communication & Trust → What Happened?
- Conflict Frequency → What Happened? (intensity)
- Management Effectiveness → Third Side capacity
- Escalation Intent → All three (threshold indicator)
- Wellbeing & Belonging → Feelings + Identity
- Interpersonal Dynamics → Identity + What Happened?
- Workload & Structural Stressors → What Happened? (structural)
- Conflict Culture → All three (organisational norms)
- Cross-Team Conflict → What Happened? (cross-boundary)
- Leadership & Mediation → Third Side capacity (deep)
- Outcomes & Impact → All three (consequence)

Analysis rules:
- Write narratives in the language of interests and needs, never positions and blame.
- When data suggests suppressed emotions (low Psychological Safety + low Wellbeing), name the Feelings Conversation.
- When identity indicators are low (belonging, value, recognition), name the Identity Conversation.
- When communication/trust scores diverge from conflict frequency, name the "What Happened?" Conversation.
- The narrative synthesises across respondents to provide a composite "balcony view" (Ury, Getting Past No).
- Conflict Types should name structural interests (e.g. "Role Ambiguity", "Communication Breakdown") without personalising.
- Manager scripts use open-ended, interest-probing questions: "What would need to change…?" / "Help me understand…"
- Recommended actions span multiple roles (Manager, HR, Coach, Team Lead) — conflict resolution is a community function.
- Match urgency to risk level: Critical = act NOW, High = move quickly, Medium = address systematically, Low = monitor.

Risk scoring model:
- Low (0–30): Healthy conflict culture; minor tensions being managed
- Medium (31–55): Emerging patterns that could escalate without attention
- High (56–75): Active conflict affecting productivity and wellbeing
- Critical (76–100): Severe conflict requiring urgent intervention`;

// ─────────────────────────────────────────────────────────────────────────────
// Instrument 1 — Bi-Weekly Pulse Survey (15 items)
// ─────────────────────────────────────────────────────────────────────────────

const biWeeklyPulse = {
  instrumentId: 'HNP-PULSE',
  instrumentVersion: '2026-04',
  title: 'Conflict Intelligence — Bi-Weekly Pulse Survey',
  moduleType: 'conflict' as const,
  intakeType: 'survey' as const,
  analysisPrompt: HNP_ANALYSIS_PROMPT,
  description:
    'A short, frequent pulse check (3–5 minutes) designed to detect early conflict signals ' +
    'across the Three Conversations framework (Stone, Patton & Heen). Covers psychological safety, ' +
    'communication quality, conflict frequency, management effectiveness, escalation intent, and wellbeing.',
  instructions:
    'Please answer each question honestly based on your experience over the past two weeks. ' +
    'All responses are anonymous and aggregated — no individual answers are ever shared. ' +
    'Your candour helps your organisation build a healthier conflict culture.',
  questions: [
    // ── Psychological Safety (Feelings + Identity conversation) ──
    { id: 'cp01', category: 'Psychological Safety', type: 'scale',
      text: 'I feel safe expressing concerns or disagreements with my team without fear of negative consequences.' },
    { id: 'cp02', category: 'Psychological Safety', type: 'scale',
      text: 'People in my team are able to bring up problems and difficult issues.' },
    { id: 'cp03', category: 'Psychological Safety', type: 'boolean',
      text: 'In the past two weeks, have you witnessed behaviour that made you feel uncomfortable or unsafe at work?' },

    // ── Communication & Trust (What Happened? conversation) ──
    { id: 'cp04', category: 'Communication & Trust', type: 'scale',
      text: 'Communication within my team is open, honest, and respectful.' },
    { id: 'cp05', category: 'Communication & Trust', type: 'scale',
      text: 'I trust that my colleagues will follow through on their commitments.' },
    { id: 'cp06', category: 'Communication & Trust', type: 'scale',
      text: 'Disagreements in my team are resolved constructively rather than avoided or escalated.' },

    // ── Conflict Frequency (What Happened? — intensity) ──
    { id: 'cp07', category: 'Conflict Frequency', type: 'scale',
      text: 'In the past two weeks, how often have you experienced tension or conflict with a colleague?' },
    { id: 'cp08', category: 'Conflict Frequency', type: 'boolean',
      text: 'Is there an unresolved conflict in your team that is affecting your ability to do your job?' },
    { id: 'cp09', category: 'Conflict Frequency', type: 'scale',
      text: 'How much has workplace tension affected your productivity over the past two weeks?' },

    // ── Management Effectiveness (Third Side capacity) ──
    { id: 'cp10', category: 'Management Effectiveness', type: 'scale',
      text: 'My manager addresses conflict or interpersonal issues in a fair and timely manner.' },
    { id: 'cp11', category: 'Management Effectiveness', type: 'scale',
      text: 'I feel my manager creates an environment where team members treat each other with respect.' },

    // ── Escalation Intent (All three conversations — threshold indicator) ──
    { id: 'cp12', category: 'Escalation Intent', type: 'boolean',
      text: 'Is there a situation in your team right now that you believe requires HR or leadership intervention?' },
    { id: 'cp13', category: 'Escalation Intent', type: 'text',
      text: 'If you are experiencing a conflict or tension at work, what type best describes it? (e.g. workload, interpersonal, communication, values, leadership)' },

    // ── Wellbeing & Belonging (Feelings + Identity conversation) ──
    { id: 'cp14', category: 'Wellbeing & Belonging', type: 'scale',
      text: 'Overall, how would you rate your sense of wellbeing and belonging at work this week?' },
    { id: 'cp15', category: 'Wellbeing & Belonging', type: 'text',
      text: 'Is there anything else you would like your manager or HR to be aware of? (Optional — your response is anonymous)' },
  ] as IQuestion[],
};

// ─────────────────────────────────────────────────────────────────────────────
// Instrument 2 — Quarterly Deep-Dive Analysis (21 items)
// ─────────────────────────────────────────────────────────────────────────────

const quarterlyDeepDive = {
  instrumentId: 'HNP-DEEP',
  instrumentVersion: '2026-04',
  title: 'Conflict Intelligence — Quarterly Deep-Dive Analysis',
  moduleType: 'conflict' as const,
  intakeType: 'survey' as const,
  analysisPrompt: HNP_ANALYSIS_PROMPT,
  description:
    'A comprehensive quarterly assessment (10–15 minutes) that surfaces systemic conflict patterns ' +
    'across seven dimensions. Extends the bi-weekly pulse with deeper structural analysis of conflict culture, ' +
    'interpersonal dynamics, leadership effectiveness, workload stressors, and cross-team friction. ' +
    'Grounded in the Harvard Negotiation Project interest-based framework.',
  instructions:
    'This survey takes approximately 10–15 minutes. Please reflect on your experience over the past quarter. ' +
    'All responses are anonymous and require a minimum of 5 respondents before any results are generated. ' +
    'Your honest input drives evidence-based improvements to how your organisation handles conflict.',
  questions: [
    // ── Conflict Culture (All three conversations — organisational norms) ──
    { id: 'cd01', category: 'Conflict Culture', type: 'scale',
      text: 'Our organization has a healthy culture for addressing conflict and disagreement.' },
    { id: 'cd02', category: 'Conflict Culture', type: 'scale',
      text: 'When conflicts arise, they are typically addressed directly rather than passively avoided.' },
    { id: 'cd03', category: 'Conflict Culture', type: 'scale',
      text: 'My organization provides employees with the tools and support they need to resolve conflicts.' },
    { id: 'cd04', category: 'Conflict Culture', type: 'boolean',
      text: 'Have you received any training on conflict resolution or difficult conversations in the past year?' },

    // ── Psychological Safety (Feelings + Identity conversation) ──
    { id: 'cd05', category: 'Psychological Safety', type: 'scale',
      text: 'I feel comfortable challenging the ideas of senior colleagues or managers without fear of reprisal.' },
    { id: 'cd06', category: 'Psychological Safety', type: 'scale',
      text: 'Mistakes in my team are treated as learning opportunities, not causes for blame.' },
    { id: 'cd07', category: 'Psychological Safety', type: 'scale',
      text: 'I believe my unique perspective and contributions are genuinely valued by my team.' },

    // ── Interpersonal Dynamics (Identity + What Happened? conversation) ──
    { id: 'cd08', category: 'Interpersonal Dynamics', type: 'scale',
      text: 'There are unresolved interpersonal tensions in my team that have persisted for more than one month.' },
    { id: 'cd09', category: 'Interpersonal Dynamics', type: 'scale',
      text: 'Power imbalances (seniority, personality, influence) negatively affect how conflict is handled in my team.' },
    { id: 'cd10', category: 'Interpersonal Dynamics', type: 'scale',
      text: 'People in my team are able to disagree with each other while still collaborating effectively.' },

    // ── Leadership & Mediation (Third Side capacity — deep) ──
    { id: 'cd11', category: 'Leadership & Mediation', type: 'scale',
      text: 'My manager models healthy conflict resolution behaviour in their own interactions.' },
    { id: 'cd12', category: 'Leadership & Mediation', type: 'scale',
      text: 'When I have raised a conflict or concern with my manager, it was handled appropriately.' },
    { id: 'cd13', category: 'Leadership & Mediation', type: 'scale',
      text: 'I trust that HR would handle a formal conflict complaint fairly and confidentially.' },
    { id: 'cd14', category: 'Leadership & Mediation', type: 'boolean',
      text: 'Have you ever avoided raising a valid conflict concern because you were worried about how it would be handled?' },

    // ── Workload & Structural Stressors (What Happened? — structural) ──
    { id: 'cd15', category: 'Workload & Structural Stressors', type: 'scale',
      text: 'Workload pressure or unclear role boundaries have contributed to friction in my team.' },
    { id: 'cd16', category: 'Workload & Structural Stressors', type: 'scale',
      text: 'Competing priorities between departments or teams create unnecessary conflict.' },
    { id: 'cd17', category: 'Workload & Structural Stressors', type: 'scale',
      text: 'I have the resources, clarity, and autonomy I need to do my job without conflict arising.' },

    // ── Cross-Team Conflict (What Happened? — cross-boundary) ──
    { id: 'cd18', category: 'Cross-Team Conflict', type: 'scale',
      text: 'Conflict or tension between departments or teams is a recurring problem in this organization.' },
    { id: 'cd19', category: 'Cross-Team Conflict', type: 'boolean',
      text: 'Have you experienced conflict with someone outside your immediate team in the past quarter?' },

    // ── Outcomes & Impact (All three conversations — consequence) ──
    { id: 'cd20', category: 'Outcomes & Impact', type: 'scale',
      text: 'Conflict at work has negatively impacted my engagement or intention to stay at this organization.' },
    { id: 'cd21', category: 'Outcomes & Impact', type: 'text',
      text: 'What is the single most important change your organization could make to reduce workplace conflict?' },
  ] as IQuestion[],
};

// ─────────────────────────────────────────────────────────────────────────────
// Seeder
// ─────────────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const instruments = [biWeeklyPulse, quarterlyDeepDive];

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const inst of instruments) {
    // Check for existing by instrumentId (preferred) or title
    const existing = await SurveyTemplate
      .findOne({
        $or: [
          { instrumentId: inst.instrumentId, isGlobal: true },
          { title: inst.title, isGlobal: true },
        ],
      })
      .setOptions(bypass);

    if (existing) {
      // Update to latest version
      existing.instrumentId = inst.instrumentId;
      existing.instrumentVersion = inst.instrumentVersion;
      existing.description = inst.description;
      existing.instructions = inst.instructions;
      existing.questions = inst.questions;
      existing.analysisPrompt = inst.analysisPrompt;
      await existing.save();
      console.log(`  ↻ updated  [${inst.instrumentId}]  ${inst.title}  (${inst.questions.length} questions)`);
      updated++;
      continue;
    }

    await SurveyTemplate.create({
      moduleType: inst.moduleType,
      intakeType: inst.intakeType,
      instrumentId: inst.instrumentId,
      instrumentVersion: inst.instrumentVersion,
      title: inst.title,
      description: inst.description,
      instructions: inst.instructions,
      questions: inst.questions,
      analysisPrompt: inst.analysisPrompt,
      isActive: true,
      isGlobal: true,
    });

    console.log(`  ✓ created  [${inst.instrumentId}]  ${inst.title}  (${inst.questions.length} questions)`);
    created++;
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`  Conflict instruments: ${created} created, ${updated} updated, ${skipped} skipped`);
  console.log(`─────────────────────────────────────\n`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
