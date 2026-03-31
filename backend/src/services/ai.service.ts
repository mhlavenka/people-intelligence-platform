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
Survey Period: ${surveyData.surveyPeriod}
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
