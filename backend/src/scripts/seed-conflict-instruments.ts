/**
 * Seed the Harvard Negotiation Project conflict intelligence intake instruments.
 * Run: npx ts-node src/scripts/seed-conflict-instruments.ts
 *
 * Creates 3 global, validated instruments:
 *   1. Conflict Intelligence — Bi-Weekly Pulse Survey        (15 items, 6 categories, team-level)
 *   2. Conflict Intelligence — Quarterly Deep-Dive           (21 items, 7 categories, team-level)
 *   3. HNP Conflict Handling Style Assessment                (24 items, 6 categories, individual-level)
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
// Instrument 3 — HNP Conflict Handling Mode Assessment (24 items)
// Individual-level assessment measuring conflict handling competency through
// the four Harvard principles and the Three Conversations framework.
// ─────────────────────────────────────────────────────────────────────────────

const HNP_CHS_ANALYSIS_PROMPT = `You are an expert conflict handling style analyst using the Harvard Negotiation Project framework.

You are analysing an individual's conflict handling profile based on the HNP Conflict Handling Mode Assessment. This instrument measures how a person navigates conflict across six dimensions grounded in Fisher, Ury & Patton's principled negotiation and Stone, Patton & Heen's Three Conversations framework.

The six assessment dimensions are:

1. **Interest Discovery** (ch01–ch04): Does this person focus on underlying interests rather than stated positions? Do they probe for needs, concerns, and motivations behind what people say they want? (Harvard Principle 2: Focus on interests, not positions)

2. **Separating People from Problems** (ch05–ch08): Can this person decouple emotional/relational dynamics from substantive issues? Do they address the person and the problem as distinct? (Harvard Principle 1)

3. **Option Generation** (ch09–ch12): Does this person create multiple solutions before deciding? Do they expand the pie rather than dividing it? (Harvard Principle 3: Invent options for mutual gain)

4. **Objective Criteria** (ch13–ch16): Does this person ground discussions in data, standards, and precedent rather than power or personality? (Harvard Principle 4: Insist on objective criteria)

5. **Emotional & Identity Awareness** (ch17–ch20): Can this person recognise and navigate the Feelings Conversation and the Identity Conversation? Do they acknowledge emotions and protect self-image during conflict? (Stone, Patton & Heen: Three Conversations)

6. **Conflict Response Pattern** (ch21–ch24): What is this person's default behavioural pattern under conflict? Engage/collaborate vs avoid/accommodate vs compete? How adaptive are they?

Scoring approach:
- Scale items (1–5): higher = stronger competency in that dimension
- Forced-choice items: reveal the person's default mode preference (not right/wrong)
- Boolean items: flag specific behavioural patterns (avoidance, escalation, reflection)

Your analysis should:
1. **Profile summary** (2–3 paragraphs): Describe this person's conflict handling style using interest-based language. Identify their strengths and growth edges. Reference specific dimensions.
2. **Strongest dimensions**: Which 2–3 dimensions show highest competency?
3. **Development priorities**: Which 1–2 dimensions would most improve their conflict effectiveness?
4. **Practical recommendations**: 3–5 specific, actionable steps this person can take to develop their conflict handling capability. Frame recommendations around the Harvard principles.
5. **Conflict mode tendency**: Based on forced-choice responses, describe their default conflict mode (collaborative, competitive, accommodating, avoiding, or compromising) and when it serves them well vs when it may limit them.

Return ONLY valid JSON:
{
  "overallScore": <0-100 composite conflict handling competency>,
  "dimensionScores": [
    { "name": "<dimension name>", "score": <0-100>, "level": "<strong|developing|emerging>" }
  ],
  "profileSummary": "<2-3 paragraph narrative>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "developmentPriorities": ["<priority 1>", "<priority 2>"],
  "recommendations": [
    { "title": "<action title>", "description": "<1-2 sentence explanation>" }
  ],
  "conflictModeTendency": "<description of default mode and its implications>"
}`;

const conflictHandlingMode = {
  instrumentId: 'HNP-CHS',
  instrumentVersion: '2026-04',
  title: 'HNP Conflict Handling Style Assessment',
  moduleType: 'conflict' as const,
  intakeType: 'assessment' as const,
  analysisPrompt: HNP_CHS_ANALYSIS_PROMPT,
  level_of_analysis: 'individual' as const,
  minResponsesForAnalysis: 1,
  description:
    'An individual conflict handling assessment grounded in the Harvard Negotiation Project framework. ' +
    'Measures competency across the four principled negotiation principles (Fisher, Ury & Patton) and ' +
    'emotional/identity awareness from the Three Conversations model (Stone, Patton & Heen). ' +
    'Takes 10–15 minutes. Results produce a personalised conflict handling profile with development recommendations.',
  instructions:
    'This assessment measures how you handle conflict and disagreement at work. There are no right or wrong answers — ' +
    'each question explores your natural tendencies and learned approaches. Answer based on what you actually do, ' +
    'not what you think you should do. For forced-choice questions, pick the option that feels most like you, even if neither is perfect. ' +
    'Your results will be used to create a personalised development profile.',
  questions: [
    // ── Interest Discovery (Harvard Principle 2: Focus on interests, not positions) ──
    { id: 'ch01', category: 'Interest Discovery', type: 'scale',
      text: 'When someone takes a strong position in a disagreement, I try to understand what underlying need or concern is driving that position.' },
    { id: 'ch02', category: 'Interest Discovery', type: 'scale',
      text: 'Before proposing a solution to a conflict, I ask questions to understand what each person actually needs — not just what they are asking for.' },
    { id: 'ch03', category: 'Interest Discovery', type: 'scale',
      text: 'I can usually identify at least one interest that both sides of a conflict share, even when their positions seem incompatible.' },
    { id: 'ch04', category: 'Interest Discovery', type: 'forced_choice',
      text: 'When a colleague insists on a specific solution you disagree with, which response is closer to your instinct?',
      options: [
        { value: 'A', text: 'I explain why their solution won\'t work and propose my alternative.', subscale: 'competing' },
        { value: 'B', text: 'I ask what problem they are trying to solve — there might be a way to address both our concerns.', subscale: 'collaborating' },
      ] },

    // ── Separating People from Problems (Harvard Principle 1) ──
    { id: 'ch05', category: 'Separating People from Problems', type: 'scale',
      text: 'I can disagree with someone\'s idea without it affecting how I feel about them as a person.' },
    { id: 'ch06', category: 'Separating People from Problems', type: 'scale',
      text: 'When I feel frustrated during a disagreement, I focus on the issue rather than criticising the other person.' },
    { id: 'ch07', category: 'Separating People from Problems', type: 'scale',
      text: 'I make a conscious effort to acknowledge the other person\'s perspective before presenting my own, even when I disagree strongly.' },
    { id: 'ch08', category: 'Separating People from Problems', type: 'forced_choice',
      text: 'A team member misses a deadline that affects your work. Which response is closer to yours?',
      options: [
        { value: 'A', text: 'I address the impact on the project and ask what happened, without making it personal.', subscale: 'collaborating' },
        { value: 'B', text: 'I absorb the impact myself and find a workaround to avoid a difficult conversation.', subscale: 'accommodating' },
      ] },

    // ── Option Generation (Harvard Principle 3: Invent options for mutual gain) ──
    { id: 'ch09', category: 'Option Generation', type: 'scale',
      text: 'When facing a conflict, I brainstorm multiple possible solutions before committing to one.' },
    { id: 'ch10', category: 'Option Generation', type: 'scale',
      text: 'I look for creative solutions where both parties can gain something important, rather than splitting the difference.' },
    { id: 'ch11', category: 'Option Generation', type: 'scale',
      text: 'I involve the other party in generating solutions rather than arriving with a pre-formed answer.' },
    { id: 'ch12', category: 'Option Generation', type: 'forced_choice',
      text: 'Two departments need the same budget allocation. Which approach is closer to yours?',
      options: [
        { value: 'A', text: 'I propose splitting it proportionally — fair and efficient.', subscale: 'compromising' },
        { value: 'B', text: 'I explore whether we can restructure the timeline or find additional funding so both departments get what they need.', subscale: 'collaborating' },
      ] },

    // ── Objective Criteria (Harvard Principle 4: Insist on objective criteria) ──
    { id: 'ch13', category: 'Objective Criteria', type: 'scale',
      text: 'When negotiating a disagreement, I try to find external standards, benchmarks, or precedents to anchor the discussion.' },
    { id: 'ch14', category: 'Objective Criteria', type: 'scale',
      text: 'I prefer to resolve conflicts based on data and evidence rather than who has more authority or influence.' },
    { id: 'ch15', category: 'Objective Criteria', type: 'scale',
      text: 'I actively seek feedback from neutral parties or objective sources when I am unsure whether my position is reasonable.' },
    { id: 'ch16', category: 'Objective Criteria', type: 'forced_choice',
      text: 'You and a peer disagree on the right approach for a project. Which is closer to your instinct?',
      options: [
        { value: 'A', text: 'I defer to whoever has more experience or seniority on this topic.', subscale: 'accommodating' },
        { value: 'B', text: 'I suggest we agree on criteria for evaluating both approaches, then assess them objectively.', subscale: 'collaborating' },
      ] },

    // ── Emotional & Identity Awareness (Three Conversations: Feelings + Identity) ──
    { id: 'ch17', category: 'Emotional & Identity Awareness', type: 'scale',
      text: 'I can recognise when my own emotional reaction to a conflict is disproportionate to the issue at hand.' },
    { id: 'ch18', category: 'Emotional & Identity Awareness', type: 'scale',
      text: 'When someone becomes defensive during a disagreement, I consider that their sense of competence or identity may feel threatened.' },
    { id: 'ch19', category: 'Emotional & Identity Awareness', type: 'scale',
      text: 'I am comfortable naming emotions in a conflict conversation — saying things like "It sounds like this has been really frustrating for you."' },
    { id: 'ch20', category: 'Emotional & Identity Awareness', type: 'boolean',
      text: 'In the past month, have you paused to reflect on your own emotional state before entering a difficult conversation at work?' },

    // ── Conflict Response Pattern (default behavioural mode) ──
    { id: 'ch21', category: 'Conflict Response Pattern', type: 'forced_choice',
      text: 'When you sense a conflict brewing, what is your first instinct?',
      options: [
        { value: 'A', text: 'Address it directly — I prefer to get issues on the table early.', subscale: 'competing' },
        { value: 'B', text: 'Observe and wait — I want to understand the full picture before acting.', subscale: 'avoiding' },
      ] },
    { id: 'ch22', category: 'Conflict Response Pattern', type: 'forced_choice',
      text: 'When a conversation becomes heated, which is closer to your response?',
      options: [
        { value: 'A', text: 'I hold my ground — backing down too quickly means my concerns get overlooked.', subscale: 'competing' },
        { value: 'B', text: 'I de-escalate — maintaining the relationship is more important than winning this point.', subscale: 'accommodating' },
      ] },
    { id: 'ch23', category: 'Conflict Response Pattern', type: 'forced_choice',
      text: 'After a conflict is resolved, which better describes your feeling?',
      options: [
        { value: 'A', text: 'Satisfied if the outcome is fair, even if neither side got everything they wanted.', subscale: 'compromising' },
        { value: 'B', text: 'Satisfied only if both parties\' core concerns were genuinely addressed.', subscale: 'collaborating' },
      ] },
    { id: 'ch24', category: 'Conflict Response Pattern', type: 'boolean',
      text: 'Do you sometimes avoid raising legitimate concerns at work because you worry about the conversation becoming uncomfortable?' },
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

  const instruments = [biWeeklyPulse, quarterlyDeepDive, conflictHandlingMode];

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
      existing.intakeType = inst.intakeType;
      existing.description = inst.description;
      existing.instructions = inst.instructions;
      existing.questions = inst.questions;
      existing.analysisPrompt = inst.analysisPrompt;
      if ('level_of_analysis' in inst) (existing as any).level_of_analysis = inst.level_of_analysis;
      if ('minResponsesForAnalysis' in inst) existing.minResponsesForAnalysis = inst.minResponsesForAnalysis;
      await existing.save();
      console.log(`  ↻ updated  [${inst.instrumentId}]  ${inst.title}  (${inst.questions.length} questions)`);
      updated++;
      continue;
    }

    const createPayload: Record<string, unknown> = {
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
    };
    if ('level_of_analysis' in inst) createPayload['level_of_analysis'] = inst.level_of_analysis;
    if ('minResponsesForAnalysis' in inst) createPayload['minResponsesForAnalysis'] = inst.minResponsesForAnalysis;
    await SurveyTemplate.create(createPayload);

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
