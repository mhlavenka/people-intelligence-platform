import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';

const SYSTEM_PROMPT =
  'You are an expert organizational psychologist and executive coach assistant ' +
  'working within the Helena Coaching methodology. You apply the GROW model ' +
  '(Goal, Reality, Options, Will) for development planning, interest-based ' +
  'negotiation principles for conflict analysis, and neurodiversity-affirming ' +
  'practices for inclusion assessments. Always provide structured, actionable, ' +
  'empathetic outputs suitable for HR professionals and organizational leaders. ' +
  'Never identify individuals from aggregated data. Keep outputs professional ' +
  'and grounded in evidence-based organizational psychology.';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

function languageInstruction(language: string): string {
  const langNames: Record<string, string> = {
    fr: 'French (use formal "vous" register)',
    es: 'Spanish (use formal "usted" register)',
    sk: 'Slovak (use formal "vykanie" register)',
  };
  const langName = langNames[language] ?? 'English';
  return `\n\nIMPORTANT: All string values in your JSON response must be written in ${langName}. Do not translate the JSON keys — they must stay exactly as specified above.`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AILimitExceededError extends Error {
  constructor() {
    super('AI generation limit reached for this billing period. Please upgrade your plan or purchase additional credits.');
    this.name = 'AILimitExceededError';
  }
}

export async function callClaude(
  prompt: string,
  systemPrompt: string = SYSTEM_PROMPT,
  maxTokens = 2048,
  organizationId?: string,
): Promise<string> {
  if (organizationId) {
    const limitOk = await checkAILimit(organizationId);
    if (!limitOk) throw new AILimitExceededError();
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(Math.pow(2, attempt) * 1000);
      }

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0];
      if (content.type === 'text') {
        if (organizationId) {
          trackAIGeneration(organizationId).catch((err) =>
            console.error('[AIService] Failed to track AI generation:', err),
          );
        }
        return content.text;
      }
      throw new Error('Unexpected response type from Claude');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[AIService] Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('AI service failed after 3 attempts');
}

async function checkAILimit(organizationId: string): Promise<boolean> {
  const { Organization } = await import('../models/Organization.model');
  const { Plan } = await import('../models/Plan.model');
  const org = await Organization.findById(organizationId).select('plan aiGenerationsUsed aiGenerationsResetAt').lean();
  if (!org) return true;

  const plan = await Plan.findOne({ key: org.plan }).select('limits').lean();
  const maxAI = plan?.limits?.maxAIAnalyses ?? 0;
  if (maxAI === 0) return true; // 0 = unlimited

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const resetAt = org.aiGenerationsResetAt;
  const used = (!resetAt || resetAt < monthStart) ? 0 : (org.aiGenerationsUsed ?? 0);

  return used < maxAI;
}

async function trackAIGeneration(organizationId: string): Promise<void> {
  const { Organization } = await import('../models/Organization.model');
  const now = new Date();
  const org = await Organization.findById(organizationId).select('aiGenerationsResetAt').lean();
  const resetAt = org?.aiGenerationsResetAt;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (!resetAt || resetAt < monthStart) {
    await Organization.updateOne(
      { _id: organizationId },
      { $set: { aiGenerationsUsed: 1, aiGenerationsResetAt: now } },
    );
  } else {
    await Organization.updateOne(
      { _id: organizationId },
      { $inc: { aiGenerationsUsed: 1 } },
    );
  }
}

/** Extract the first complete JSON object from a Claude response that may contain prose. */
export function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in AI response');
  }
  return text.slice(start, end + 1);
}

export function buildConflictAnalysisPrompt(
  surveyData: {
    departmentId: string;
    surveyPeriod: string;
    aggregatedResponses: Record<string, number | string>;
    responseCount: number;
    // Layer 1–3 divergence metrics. All optional; legacy callers still work.
    responseQuality?: {
      totalSubmitted: number; acceptedCount: number; droppedCount: number;
      droppedReasons: Record<string, number | undefined>;
    };
    itemMetrics?: Array<{
      questionId: string; text?: string; dimension?: string;
      mean: number; sd: number; bimodalityCoef: number; rwg: number;
    }>;
    dimensionMetrics?: Array<{
      dimension: string; mean?: number | null; rwg: number; disagreementScore: number;
    }>;
    subgroupAnalysis?: {
      k: number; silhouette: number;
      clusters: Array<{
        label: string; size: number;
        meanByDimension: Record<string, number>;
        distinguishingItemIds: string[];
      }>;
    } | null;
  },
  orgContext: { name: string; industry?: string; employeeCount?: number },
  language: string = 'en'
): string {
  const qualityBlock = surveyData.responseQuality
    ? `\nQUALITY\n- ${surveyData.responseQuality.totalSubmitted} responses submitted; ${surveyData.responseQuality.acceptedCount} accepted, ${surveyData.responseQuality.droppedCount} dropped${
        surveyData.responseQuality.droppedCount > 0
          ? ' (' + Object.entries(surveyData.responseQuality.droppedReasons)
              .filter(([, n]) => (n ?? 0) > 0)
              .map(([k, n]) => `${k}: ${n}`)
              .join(', ') + ')'
          : ''
      }.\n`
    : '';

  const hasSubgroups = !!(surveyData.subgroupAnalysis && surveyData.subgroupAnalysis.clusters.length);

  // Top-3 most-divergent items (lowest rwg). Helps Claude calibrate which items
  // are noisy/split vs. unanimously low. The bimodality interpretation depends
  // on whether the subgroup detector fired — high BC with NO subgroup is a
  // singleton/minority-voice signature, not a structural split.
  const topDivergent = (surveyData.itemMetrics ?? [])
    .slice()
    .sort((a, b) => a.rwg - b.rwg)
    .slice(0, 3);
  const highBcItems = topDivergent.filter((m) => m.bimodalityCoef > 0.555);
  const itemBlock = topDivergent.length
    ? '\nPER-ITEM DIVERGENCE (top 3 by disagreement)\n' +
      topDivergent.map((m) => {
        const bimodal = m.bimodalityCoef > 0.555
          ? hasSubgroups
            ? `, bimodal (BC ${m.bimodalityCoef.toFixed(2)}) — team is split`
            : `, high BC ${m.bimodalityCoef.toFixed(2)} but NO subgroup detected — likely minority-voice / singleton outlier, not a structural split`
          : '';
        return `- ${m.questionId}${m.text ? ' "' + m.text.slice(0, 110) + '"' : ''} — mean ${m.mean}, sd ${m.sd}, rwg ${m.rwg}${bimodal}`;
      }).join('\n') + '\n'
    : '';

  const dimensionBlock = (surveyData.dimensionMetrics ?? []).length
    ? '\nDIMENSIONAL DIVERGENCE (rwg ≥0.7 = good agreement, <0.5 = low)\n' +
      surveyData.dimensionMetrics!.map((d) => {
        // Some dimensions (e.g. boolean-only ones like Escalation Intent)
        // intentionally have no continuous-scale mean. Use "n/a" so the LLM
        // doesn't infer a fake value from "null" or "undefined" wording.
        const meanLabel = (typeof d.mean === 'number') ? d.mean : 'n/a';
        return `- ${d.dimension}: mean ${meanLabel}, rwg ${d.rwg} (disagreement ${d.disagreementScore}/100)`;
      }).join('\n') + '\n'
    : '';

  const subgroupBlock = hasSubgroups
    ? `\nSUBGROUP STRUCTURE\n` +
      `- ${surveyData.subgroupAnalysis!.clusters.length} distinct response patterns detected (k=${surveyData.subgroupAnalysis!.k}, silhouette ${surveyData.subgroupAnalysis!.silhouette}).\n` +
      surveyData.subgroupAnalysis!.clusters.map((c) => {
        const dims = Object.entries(c.meanByDimension)
          .sort((a, b) => a[1] - b[1])
          .slice(0, 5)
          .map(([d, m]) => `${d} ${m}`)
          .join(', ');
        const distinguishing = c.distinguishingItemIds.length
          ? ` Distinguishing items: ${c.distinguishingItemIds.join(', ')}.`
          : '';
        return `- Cluster ${c.label} (${c.size} respondents): ${dims}.${distinguishing}`;
      }).join('\n') + '\n'
    : (highBcItems.length
        ? `\nSUBGROUP STRUCTURE\n- Subgroup detector ran but did NOT fire — no cluster of ≥3 respondents with a coherent differing response pattern. High item-level bimodality (${highBcItems.map(i => i.questionId).join(', ')}) without subgroup structure is the Condorcet / Aumann signature of a SINGLETON OUTLIER or MINORITY VOICE within an otherwise aligned team, not a structural split.\n`
        : '');

  const interpretationGuidance = (qualityBlock || itemBlock || dimensionBlock || subgroupBlock)
    ? `\nINTERPRETATION GUIDANCE
Treat divergence as STRUCTURAL signal, not individual blame. A split team is reporting different experiences of the same workplace — possible drivers include role, shift, tenure, team membership, or recent events. Minority voices may reflect the truth rather than dysfunction. Use the rwg + bimodality data to CALIBRATE confidence in your interpretation and to suggest interventions that do NOT single out individuals.${
        hasSubgroups
          ? ' When SUBGROUP STRUCTURE is present, treat the clusters as STATISTICAL response patterns, not as social factions or sides of a conflict — they likely reflect role, shift, tenure, or recent experience. Never speculate about who belongs to which cluster (membership is never disclosed). Use the cluster profiles to surface the structural drivers of disagreement and propose interventions that respect the differing experiences each cluster reports.'
          : (highBcItems.length
              ? ' When NO SUBGROUP STRUCTURE was detected despite high item-level bimodality: do NOT use fracture / split / divide / polarised / subgroup / bimodal-split framing in the narrative or conflictTypes — the team is NOT structurally split. Frame the pattern as a MINORITY VOICE signal: one or a few respondents are reporting a markedly different reality from an otherwise aligned majority. Acknowledge that the minority reading may be more accurate than the majority (Condorcet / Aumann), and recommend AGGREGATE channels (anonymous follow-up survey, skip-level conversations, ombudsperson, exit interviews) rather than identification. conflictTypes in this case should reference "minority voice", "outlier signal", or "unsurfaced concern" — never "subgroup", "bimodal split", "polarised", or "fractured".'
              : '')
      }\n`
    : '';

  return `Analyze the following workplace survey data for conflict risk assessment.

Organization: ${orgContext.name} (${orgContext.industry || 'Unknown industry'}, ~${orgContext.employeeCount || 'unknown'} employees)
Department: ${surveyData.departmentId}
Intake Period: ${surveyData.surveyPeriod}
Respondent Count: ${surveyData.responseCount} (aggregated — no individual data)
${qualityBlock}${itemBlock}${dimensionBlock}${subgroupBlock}${interpretationGuidance}
Aggregated Survey Results (per-item means):
${JSON.stringify(surveyData.aggregatedResponses, null, 2)}

Please provide:
1. **Risk Score** (0-100): Overall conflict risk level
2. **Risk Level**: low/medium/high/critical
3. **Conflict Types Detected**: List specific conflict patterns observed
4. **AI Narrative** (2-3 paragraphs): Professional analysis of team dynamics and conflict indicators. Where divergence metrics are present, reference the structure of disagreement (which dimensions are split vs. uniformly low) WITHOUT speculating about individual respondents.
5. **Manager Script**: Practical talking points for the manager to address the situation (use interest-based negotiation principles)

Format your response as JSON with keys: riskScore, riskLevel, conflictTypes, aiNarrative, managerScript` + languageInstruction(language);
}

export function buildConflictSubAnalysisPrompt(
  conflictType: string,
  parent: {
    departmentId: string;
    surveyPeriod: string;
    riskScore: number;
    riskLevel: string;
    aiNarrative: string;
  },
  language: string = 'en'
): string {
  return `You are an expert workplace conflict analyst using Helena's coaching-integrated, interest-based mediation methodology.

A conflict analysis for ${parent.departmentId || 'the organization'} (${parent.surveyPeriod}) identified "${conflictType}" as a detected conflict type with an overall risk score of ${parent.riskScore}/100 (${parent.riskLevel}).

Overall analysis context:
${parent.aiNarrative.slice(0, 600)}

Provide a focused deep-dive sub-analysis specifically on the "${conflictType}" conflict type within this department. Assess its specific contribution to the overall risk, its likely root causes, and concrete intervention steps.

Return ONLY valid JSON with these keys:
{
  "riskScore": <number 0-100 specific to this conflict type>,
  "riskLevel": <"low"|"medium"|"high"|"critical">,
  "conflictTypes": ["${conflictType}"],
  "aiNarrative": "<2-3 paragraph focused analysis of this specific conflict type: what it looks like in this context, its root causes, and impact>",
  "managerScript": {
    "opening": "<how to open a conversation specifically about this conflict type>",
    "keyQuestions": ["<interest-based question 1>", "<question 2>", "<question 3>"],
    "resolution": "<specific resolution approach and next steps for this conflict type>"
  }
}` + languageInstruction(language);
}

export function buildConflictRecommendedActionsPrompt(
  analysis: {
    name: string;
    departmentId?: string;
    riskScore: number;
    riskLevel: string;
    conflictTypes: string[];
    aiNarrative: string;
  },
  language: string = 'en'
): string {
  return `You are an expert workplace conflict resolution strategist using Helena's coaching-integrated, interest-based methodology.

Given this conflict analysis:
Name: ${analysis.name}
Department: ${analysis.departmentId || 'All Departments'}
Risk Score: ${analysis.riskScore}/100 (${analysis.riskLevel})
Conflict Types: ${analysis.conflictTypes.join(', ')}

Analysis:
${analysis.aiNarrative.slice(0, 1200)}

Generate concrete, prioritized recommended actions organized by timeframe. Each action should be specific, measurable, and assignable.

Return ONLY valid JSON with this exact structure:
{
  "immediateActions": [
    { "title": "<action title>", "description": "<1-2 sentence explanation>", "owner": "<suggested role: HR, Manager, Coach, or Team Lead>", "priority": "<high|medium|low>" }
  ],
  "shortTermActions": [
    { "title": "<action title>", "description": "<1-2 sentence explanation>", "owner": "<suggested role>", "priority": "<high|medium|low>", "timeframe": "<e.g. within 2 weeks>" }
  ],
  "longTermActions": [
    { "title": "<action title>", "description": "<1-2 sentence explanation>", "owner": "<suggested role>", "priority": "<high|medium|low>", "timeframe": "<e.g. 1-3 months>" }
  ],
  "preventiveMeasures": [
    "<specific ongoing practice or policy change to prevent recurrence>"
  ]
}

Rules:
- immediateActions: 2-4 items for THIS WEEK
- shortTermActions: 3-5 items for the next 2-4 weeks
- longTermActions: 2-3 items for 1-3 months
- preventiveMeasures: 2-4 plain-text strings
- Match urgency to the risk level: ${analysis.riskLevel} risk means ${analysis.riskLevel === 'critical' ? 'act NOW' : analysis.riskLevel === 'high' ? 'move quickly' : 'address systematically'}` + languageInstruction(language);
}

export function buildPostSessionReflectionPrompt(
  context: {
    coacheeName: string;
    topics: string[];
    sharedNotes?: string;
    coachNotes?: string;
    summary?: string;
    growFocus?: string[];
  },
  language: string = 'en'
): string {
  const topicList = context.topics.length
    ? `Topics discussed: ${context.topics.join(', ')}`
    : '';
  const notesContext = context.sharedNotes
    ? `Shared session notes:\n${context.sharedNotes.slice(0, 800)}`
    : '';
  const privateContext = context.coachNotes
    ? `Coach's private observations:\n${context.coachNotes.slice(0, 600)}`
    : '';
  const summaryContext = context.summary
    ? `Coach-provided session summary:\n${context.summary}`
    : '';
  const growContext = context.growFocus?.length
    ? `GROW phases explored: ${context.growFocus.join(', ')}`
    : '';

  return `You are an expert executive coaching assistant. Generate reflective questions for a coachee to complete after a coaching session.

Coachee: ${context.coacheeName}
${topicList}
${growContext}
${notesContext}
${privateContext}
${summaryContext}

Generate 6-8 thoughtful post-session reflection questions. The questions should:
- Help the coachee consolidate insights from the session
- Encourage them to identify concrete next steps
- Be open-ended and thought-provoking
- Reference specific topics/themes from the session when possible
- Include at least one question about what they'll do differently
- Include at least one question about support they need

Return ONLY valid JSON — an array of question objects:
[
  {
    "id": "<unique short id like q1, q2...>",
    "text": "<the question text>",
    "type": "text",
    "category": "<one of: Insights, Action Steps, Support Needed, Reflection>"
  }
]

Rules:
- 6-8 questions total
- All questions must be type "text" (open-ended)
- Categories: Insights (2-3), Action Steps (2), Support Needed (1), Reflection (1-2)
- Warm, encouraging tone — this is a growth conversation, not an exam
- Do NOT reference the coach's private notes in the question text` + languageInstruction(language);
}

export function buildNeuroinclustionGapPrompt(
  assessmentData: {
    respondentRole: string;
    dimensions: Array<{ name: string; score: number }>;
    overallMaturityScore: number;
  },
  orgContext: { name: string; industry?: string },
  language: string = 'en'
): string {
  return `Analyze the following neuroinclusion maturity assessment results.

Organization: ${orgContext.name} (${orgContext.industry || 'Unknown industry'})
Respondent Role: ${assessmentData.respondentRole}
Overall Maturity Score: ${assessmentData.overallMaturityScore}/100

Dimension Scores:
${assessmentData.dimensions.map((d) => `- ${d.name}: ${d.score}/100`).join('\n')}

Please provide:
1. **Gap Analysis** (2-3 paragraphs): Identify the most significant neuroinclusion gaps using neurodiversity-affirming language
2. **Action Roadmap**: 5-7 specific, prioritized actions to improve neuroinclusion maturity
3. **Quick Wins**: 2-3 immediate actions that can be implemented within 30 days
4. **Long-term Initiatives**: 2-3 strategic initiatives for the next 6-12 months

Respond with ONLY valid JSON — no markdown, no code fences, no extra keys.
Use exactly this structure (every value must be a plain string, never a nested object):

{
  "aiGapAnalysis": ["paragraph one text", "paragraph two text", "paragraph three text"],
  "actionRoadmap": ["Full action description including timeline", "..."],
  "quickWins": ["Full quick win description", "..."],
  "longTermInitiatives": ["Full initiative description", "..."]
}

Rules:
- aiGapAnalysis: exactly 2–3 plain-text paragraph strings
- actionRoadmap: exactly 5–7 plain-text strings, each self-contained (include the timeline in the sentence)
- quickWins: exactly 2–3 plain-text strings
- longTermInitiatives: exactly 2–3 plain-text strings
- NO objects, NO nested arrays, NO extra fields` + languageInstruction(language);
}

export function buildConflictIDPPrompt(
  userProfile: { firstName: string; role: string },
  conflictAnalysis: {
    riskScore: number;
    riskLevel: string;
    conflictTypes: string[];
    aiNarrative: string;
  },
  goals: string,
  language: string = 'en'
): string {
  return `Generate a professional Individual Development Plan (IDP) focused on conflict resolution and interpersonal skill development using the GROW model.

Context: A workplace conflict analysis has been conducted with the following results:
- Risk Score: ${conflictAnalysis.riskScore}/100 (${conflictAnalysis.riskLevel})
- Conflict Types Detected: ${conflictAnalysis.conflictTypes.join(', ')}
- Analysis Summary: ${conflictAnalysis.aiNarrative.slice(0, 800)}

Target Individual:
- Name: ${userProfile.firstName}
- Role: ${userProfile.role}
- Development Goals: ${goals}

Create a development plan that specifically addresses the conflict patterns identified above. Focus on:
- Conflict resolution skills relevant to the detected conflict types
- Communication and emotional intelligence competencies
- Interest-based negotiation techniques
- Team dynamics and relationship repair strategies
- Self-awareness and conflict style management

Please create a comprehensive IDP with:
1. **GROW Framework**:
   - Goal: Specific, measurable conflict-resolution development goal
   - Reality: Current conflict landscape and skill baseline
   - Options: 4-6 development strategies targeting the identified conflict types
   - Will: 3-5 concrete committed actions with timelines

2. **Milestones**: 4 milestone checkpoints over 6 months with success criteria

3. **Resources**: Recommended tools, training, or support for conflict skill building

Respond with ONLY valid JSON — no explanation, no markdown, no code fences. Start your response with { and end with }.
Required JSON shape: { "goal": string, "currentReality": string, "options": string[], "willDoActions": string[], "milestones": [{"title":string,"weeksFromNow":number,"successCriteria":string}], "resources": string[], "competencyGaps": string[] }` + languageInstruction(language);
}

export function buildIDPPrompt(
  coacheeProfile: {
    firstName: string;
    role: string;
    competencyGaps: string[];
  },
  eqiScores: Record<string, number>,
  goals: string,
  language: string = 'en'
): string {
  return `Generate a professional Individual Development Plan (IDP) using the GROW model.

Coachee Profile:
- Name: ${coacheeProfile.firstName}
- Role: ${coacheeProfile.role}
- Development Goals: ${goals}
- Competency Gaps: ${coacheeProfile.competencyGaps.join(', ')}

EQ-i Assessment Scores:
${Object.entries(eqiScores)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

Please create a comprehensive IDP with:
1. **GROW Framework**:
   - Goal: Specific, measurable development goal
   - Reality: Current situation and baseline assessment
   - Options: 4-6 development strategies and approaches
   - Will: 3-5 concrete committed actions with timelines

2. **Milestones**: 4 milestone checkpoints over 6 months with success criteria

3. **Resources**: Recommended tools, training, or support

Respond with ONLY valid JSON — no explanation, no markdown, no code fences. Start your response with { and end with }.
Required JSON shape: { "goal": string, "currentReality": string, "options": string[], "willDoActions": string[], "milestones": [{"title":string,"weeksFromNow":number,"successCriteria":string}], "resources": string[] }` + languageInstruction(language);
}

// ═══════════════════════════════════════════════════════════════════════════
// COACHING JOURNAL AI PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export function buildSessionSummaryPrompt(note: {
  preSession?: { agenda?: string; hypotheses?: string; coachIntention?: string };
  inSession?: { openingState?: string; keyThemes?: string[]; observations?: string; notableQuotes?: string[]; coachInterventions?: string; energyShifts?: string };
  postSession?: { coachReflection?: string; whatWorked?: string; whatToExplore?: string; clientGrowthEdge?: string };
}, language: string = 'en'): string {
  return `You are an expert coaching supervisor analyzing a coaching session note. Use ICF core competencies (active listening, evoking awareness, facilitating growth) as your analytical lens.

SESSION NOTE DATA:

PRE-SESSION:
- Agenda: ${note.preSession?.agenda || 'Not provided'}
- Hypotheses: ${note.preSession?.hypotheses || 'Not provided'}
- Coach Intention: ${note.preSession?.coachIntention || 'Not provided'}

IN-SESSION:
- Opening State: ${note.inSession?.openingState || 'Not provided'}
- Key Themes: ${(note.inSession?.keyThemes || []).join(', ') || 'None'}
- Observations: ${note.inSession?.observations || 'Not provided'}
- Notable Quotes: ${(note.inSession?.notableQuotes || []).filter(Boolean).join(' | ') || 'None'}
- Coach Interventions: ${note.inSession?.coachInterventions || 'Not provided'}
- Energy Shifts: ${note.inSession?.energyShifts || 'Not provided'}

POST-SESSION:
- Coach Reflection: ${note.postSession?.coachReflection || 'Not provided'}
- What Worked: ${note.postSession?.whatWorked || 'Not provided'}
- What to Explore Next: ${note.postSession?.whatToExplore || 'Not provided'}
- Client's Growth Edge: ${note.postSession?.clientGrowthEdge || 'Not provided'}

Please synthesize this session into:
1. A 3-5 sentence narrative summary capturing the arc and key moments
2. 3-6 coaching-relevant thematic tags (e.g. "self-doubt", "boundary-setting", "leadership identity", "emotional regulation")
3. The single most significant growth edge moment or insight from this session

Respond with ONLY valid JSON — no markdown, no code fences.
Required JSON shape: { "summary": string, "themes": string[], "growthEdgeMoment": string }` + languageInstruction(language);
}

export function buildEngagementInsightPrompt(
  sessionNotes: Array<{
    sessionNumber: number;
    sessionDate: string;
    preSession?: { agenda?: string };
    inSession?: { keyThemes?: string[]; observations?: string };
    postSession?: { coachReflection?: string; whatToExplore?: string; clientGrowthEdge?: string };
    aiSummary?: string;
    aiThemes?: string[];
  }>,
  language: string = 'en'
): string {
  const sessionsText = sessionNotes
    .map((n) => `Session #${n.sessionNumber} (${n.sessionDate}):
  AI Summary: ${n.aiSummary || 'Not generated'}
  Themes: ${(n.aiThemes || []).join(', ') || 'None'}
  Observations: ${n.inSession?.observations?.slice(0, 300) || 'N/A'}
  Growth Edge: ${n.postSession?.clientGrowthEdge || 'N/A'}
  Coach Reflection: ${n.postSession?.coachReflection?.slice(0, 200) || 'N/A'}`)
    .join('\n\n');

  return `You are an expert coaching supervisor reviewing a full coaching engagement. Analyze the progression across all sessions using ICF core competencies as your lens.

COMPLETED SESSION NOTES (${sessionNotes.length} sessions):

${sessionsText}

Provide a cross-session insight report with:
1. **Recurring Themes**: Patterns that appear across multiple sessions
2. **Growth Arc**: How the coachee has evolved from the first session to the most recent
3. **Coach Observations**: Meta-observations about coaching approach effectiveness
4. **Open Threads**: Unresolved topics or areas that need continued attention
5. **Suggested Next Focus**: Recommended focus for upcoming sessions based on the trajectory

Respond with ONLY valid JSON — no markdown, no code fences.
Required JSON shape: { "recurringThemes": string[], "growthArc": string, "coachObservations": string, "openThreads": string[], "suggestedNextFocus": string }` + languageInstruction(language);
}

export function buildSupervisionDigestPrompt(
  reflectiveEntries: Array<{ title: string; body: string; mood: string; entryDate: string; tags?: string[] }>,
  sessionNotes: Array<{ sessionNumber: number; sessionDate: string; postSession?: { coachReflection?: string }; aiThemes?: string[] }>,
  language: string = 'en'
): string {
  const reflectionsText = reflectiveEntries
    .map((e) => `[${e.entryDate}] "${e.title}" (Mood: ${e.mood})${e.tags?.length ? ` Tags: ${e.tags.join(', ')}` : ''}
  ${e.body.slice(0, 400)}`)
    .join('\n\n');

  const sessionReflections = sessionNotes
    .filter((n) => n.postSession?.coachReflection)
    .map((n) => `Session #${n.sessionNumber} (${n.sessionDate}): ${n.postSession!.coachReflection!.slice(0, 300)}`)
    .join('\n');

  return `You are an experienced coaching supervisor preparing a supervision session. Analyze the coach's reflective journal entries and session reflections to identify patterns, development areas, and supervision discussion points.

REFLECTIVE JOURNAL ENTRIES (${reflectiveEntries.length} entries flagged for supervision):

${reflectionsText}

SESSION REFLECTIONS (from ${sessionNotes.length} sessions):

${sessionReflections}

Provide a supervision preparation digest with:
1. **Coach Themes**: Recurring themes in the coach's own reflective practice
2. **Cross-Engagement Patterns**: Patterns the coach may be carrying across different coaching relationships
3. **Questions for Supervisor**: 3-5 powerful questions to explore in supervision
4. **Development Areas**: Specific ICF competency areas for the coach's own growth

Respond with ONLY valid JSON — no markdown, no code fences.
Required JSON shape: { "coachThemes": string[], "crossEngagementPatterns": string, "questionsForSupervisor": string[], "developmentAreas": string[] }` + languageInstruction(language);
}

export function buildAITemplatePrompt(
  description: string,
  options: {
    moduleType: 'conflict' | 'neuroinclusion' | 'succession' | 'coaching';
    intakeType: 'survey' | 'interview' | 'assessment';
    questionCount?: number;
  },
  language: string = 'en',
): string {
  const count = Math.min(Math.max(options.questionCount ?? 8, 3), 20);

  const moduleHint: Record<string, string> = {
    conflict: 'Workplace conflict, team dynamics, psychological safety, communication breakdowns.',
    neuroinclusion: 'Neurodiversity, accessibility, sensory load, cognitive style, accommodations.',
    succession: 'Career growth, leadership readiness, skill development, IDP / GROW model.',
    coaching: 'Coaching session reflection, GROW model, mood, intentions, commitments.',
  };
  const intakeHint: Record<string, string> = {
    survey: 'Self-service, anonymous, completed by many respondents and aggregated.',
    interview: 'Coach-led, captured on behalf of a single coachee in a 1:1 conversation.',
    assessment: 'Coach-led or self-completed structured assessment for an individual.',
  };

  return `You are an expert organisational psychologist designing a custom intake template for the ARTES platform.

Coach's description of what they want:
"""
${description.slice(0, 2000)}
"""

Module: ${options.moduleType} — ${moduleHint[options.moduleType]}
Intake type: ${options.intakeType} — ${intakeHint[options.intakeType]}

Generate a complete intake template. Return ONLY valid JSON — no markdown, no code fences — matching this exact shape:
{
  "title": "<short, descriptive title (max 80 chars)>",
  "description": "<one-sentence purpose of this intake (max 200 chars)>",
  "instructions": "<2-3 sentence instructions shown to the respondent before they begin>",
  "questions": [
    {
      "id": "<short stable id like q1, q2, q3...>",
      "text": "<the question text>",
      "type": "<one of: scale, text, boolean>",
      "category": "<thematic grouping like 'Communication', 'Trust', 'Workload'>"
    }
  ]
}

Rules:
- ${count} questions total
- Mix question types: 50–70% scale (1–5 Likert), 20–40% text (open-ended), 0–20% boolean (yes/no)
- Group questions by category — aim for 3–5 distinct categories
- Each question must be unambiguous, single-barrelled, and behaviourally observable where possible
- Use a warm, respectful, neutral tone
- For scale questions, frame them so a higher number consistently means a more positive state
- ID must be a stable short identifier (q1, q2, ... or category-prefixed like comm1, comm2)
- Title and description should reflect the coach's described intent` + languageInstruction(language);
}
