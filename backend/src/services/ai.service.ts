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

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callClaude(
  prompt: string,
  systemPrompt: string = SYSTEM_PROMPT,
  maxTokens = 2048,
): Promise<string> {
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
  },
  orgContext: { name: string; industry?: string; employeeCount?: number }
): string {
  return `Analyze the following workplace survey data for conflict risk assessment.

Organization: ${orgContext.name} (${orgContext.industry || 'Unknown industry'}, ~${orgContext.employeeCount || 'unknown'} employees)
Department: ${surveyData.departmentId}
Intake Period: ${surveyData.surveyPeriod}
Respondent Count: ${surveyData.responseCount} (aggregated — no individual data)

Aggregated Survey Results:
${JSON.stringify(surveyData.aggregatedResponses, null, 2)}

Please provide:
1. **Risk Score** (0-100): Overall conflict risk level
2. **Risk Level**: low/medium/high/critical
3. **Conflict Types Detected**: List specific conflict patterns observed
4. **AI Narrative** (2-3 paragraphs): Professional analysis of team dynamics and conflict indicators
5. **Manager Script**: Practical talking points for the manager to address the situation (use interest-based negotiation principles)

Format your response as JSON with keys: riskScore, riskLevel, conflictTypes, aiNarrative, managerScript`;
}

export function buildConflictSubAnalysisPrompt(
  conflictType: string,
  parent: {
    departmentId: string;
    surveyPeriod: string;
    riskScore: number;
    riskLevel: string;
    aiNarrative: string;
  }
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
}`;
}

export function buildNeuroinclustionGapPrompt(
  assessmentData: {
    respondentRole: string;
    dimensions: Array<{ name: string; score: number }>;
    overallMaturityScore: number;
  },
  orgContext: { name: string; industry?: string }
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
- NO objects, NO nested arrays, NO extra fields`;
}

export function buildConflictIDPPrompt(
  userProfile: { firstName: string; role: string },
  conflictAnalysis: {
    riskScore: number;
    riskLevel: string;
    conflictTypes: string[];
    aiNarrative: string;
  },
  goals: string
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
Required JSON shape: { "goal": string, "currentReality": string, "options": string[], "willDoActions": string[], "milestones": [{"title":string,"weeksFromNow":number,"successCriteria":string}], "resources": string[], "competencyGaps": string[] }`;
}

export function buildIDPPrompt(
  coacheeProfile: {
    firstName: string;
    role: string;
    competencyGaps: string[];
  },
  eqiScores: Record<string, number>,
  goals: string
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
Required JSON shape: { "goal": string, "currentReality": string, "options": string[], "willDoActions": string[], "milestones": [{"title":string,"weeksFromNow":number,"successCriteria":string}], "resources": string[] }`;
}
