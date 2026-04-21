# Conflict Intelligence — AI Analysis Prompt Design

**Module:** Conflict Intelligence  
**Section:** 3.2 — Interest-Based Conflict Diagnosis  
**Theoretical Basis:** Harvard Negotiation Project (Fisher, Ury & Patton), Three Conversations (Stone, Patton & Heen), The Third Side (Ury)

---

## System Prompt

```
You are an expert workplace conflict analyst using Helena's coaching-integrated, interest-based mediation methodology grounded in the Harvard Negotiation Project.

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
```

---

## Primary Analysis Prompt (Aggregated Survey → Conflict Risk JSON)

Used by `buildConflictAnalysisPrompt()` in `ai.service.ts`.

### Input Data

```
Organization: {name} ({industry}, ~{employeeCount} employees)
Department: {departmentId}
Intake Period: {surveyPeriod}
Respondent Count: {responseCount} (aggregated — no individual data)

Aggregated Survey Results:
{JSON of averaged responses per question}
```

### Output Structure

```json
{
  "riskScore": 0-100,
  "riskLevel": "low|medium|high|critical",
  "conflictTypes": ["pattern names — structural interests, not personal attributions"],
  "aiNarrative": "2-3 paragraphs in the language of interests and needs",
  "managerScript": "Practical talking points using interest-based negotiation principles"
}
```

### Analysis Layers

The AI must produce output that separates three analytical layers:

| Layer | Output Field | What It Does | Harvard Principle |
|-------|-------------|-------------|-------------------|
| **Narrative** | `aiNarrative` | Composite interpretation of conflict dynamics written in interest/needs language. Describes underlying dynamics, not individual actions. | Focus on Interests |
| **Quantitative** | `riskScore` + `riskLevel` | Objective, data-grounded baseline that removes subjectivity. Anchors conversation in evidence. | Insist on Objective Criteria |
| **Pattern** | `conflictTypes` | Structural patterns (e.g. "Role Ambiguity", "Communication Breakdown", "Leadership-Process Gap") that name interests at stake without personalising. | Separate People from Problem |

### Risk Scoring Model

| Risk Level | Score | Interpretation | Recommended Response |
|-----------|-------|---------------|---------------------|
| Low | 0–30 | Healthy conflict culture; minor tensions being managed | Monitor with regular pulse surveys; reinforce positive practices |
| Medium | 31–55 | Emerging patterns that could escalate without attention | Manager-led conversations using provided scripts; short-term actions |
| High | 56–75 | Active conflict affecting productivity and wellbeing | Immediate actions + coaching involvement; consider escalation to mediation |
| Critical | 76–100 | Severe conflict requiring urgent intervention | Escalate to professional mediation; immediate safety and wellbeing measures |

### Narrative Writing Rules

1. **Interest-based language only.** Write about "unmet needs for clarity", "underlying concerns about recognition", "competing interests around resource allocation" — never "Person X is causing problems" or "the team is dysfunctional."
2. **Three Conversations awareness.** When the data suggests suppressed emotions (low Psychological Safety + low Wellbeing), name the Feelings Conversation. When identity indicators are low (belonging, value, recognition), name the Identity Conversation. When communication and trust scores diverge from conflict frequency, name the "What Happened?" Conversation.
3. **No blame, no adjudication.** The narrative describes what the aggregate data reveals about team dynamics. It does not speculate about individuals, assign fault, or recommend consequences for specific people.
4. **Composite picture.** The narrative synthesises across multiple respondents to provide a picture that no single individual's story could provide. This is the "balcony view" (Ury, Getting Past No) — objective vantage before entering the conversation.

---

## Sub-Analysis Prompt (Focused Deep-Dive per Conflict Type)

Used by `buildConflictSubAnalysisPrompt()` in `ai.service.ts`.

### Purpose

When the primary analysis identifies multiple conflict types, each can be explored in a focused deep-dive. The sub-analysis isolates one conflict pattern and produces a targeted manager conversation guide.

### Output Structure

```json
{
  "riskScore": 0-100,
  "riskLevel": "low|medium|high|critical",
  "conflictTypes": ["the single focused type"],
  "aiNarrative": "2-3 paragraphs: what this pattern looks like, root causes, impact",
  "managerScript": {
    "opening": "How to open the conversation — shared concerns, not accusations (Principle 1)",
    "keyQuestions": [
      "Interest-based questions exploring underlying needs (Principle 2)",
      "What would need to change for you to feel confident about X?",
      "Help me understand what's been most difficult about Y"
    ],
    "resolution": "Resolution approaches inviting collaborative problem-solving (Principle 3)"
  }
}
```

### Manager Script Design Principles

The script translates principled negotiation into practical conversation guidance:

- **Opening** → Principle 1 (Separate People from Problem): Frame around shared concerns, not accusations. "I've been looking at team feedback and want to understand how we can improve…" not "I've heard there's a problem with…"
- **Key Questions** → Principle 2 (Focus on Interests): Open-ended, curiosity-driven. Explore underlying needs. "What would need to change…?" / "Help me understand…" / "What matters most to you about…?" — never "Who is responsible?" / "Why did you…?"
- **Resolution** → Principle 3 (Invent Options for Mutual Gain): Invite collaborative problem-solving. Generate options together. "What if we tried…?" / "What would work for everyone?"

---

## Recommended Actions Prompt

Used by `buildConflictRecommendedActionsPrompt()` in `ai.service.ts`.

### Three-Tier Structure

Maps to the interest hierarchy from Getting to Yes:

| Tier | Timeframe | Interest Level | Harvard Principle |
|------|-----------|---------------|-------------------|
| **Immediate** | This week | Acute emotional/safety needs | Separate People from Problem |
| **Short-Term** | 2–4 weeks | Structural and procedural interests | Focus on Interests + Invent Options |
| **Long-Term** | 1–3 months | Cultural and systemic interests | Objective Criteria |
| **Preventive** | Ongoing | Systemic conditions that generate conflict | All four principles |

### Output Structure

```json
{
  "immediateActions": [
    {
      "title": "action title",
      "description": "1-2 sentence explanation",
      "owner": "HR|Manager|Coach|Team Lead",
      "priority": "high|medium|low"
    }
  ],
  "shortTermActions": [
    {
      "title": "action title",
      "description": "explanation",
      "owner": "suggested role",
      "priority": "high|medium|low",
      "timeframe": "e.g. within 2 weeks"
    }
  ],
  "longTermActions": [
    {
      "title": "action title",
      "description": "explanation",
      "owner": "suggested role",
      "priority": "high|medium|low",
      "timeframe": "e.g. 1-3 months"
    }
  ],
  "preventiveMeasures": [
    "specific ongoing practice or policy change"
  ]
}
```

### Action Design Rules

1. Actions are assigned across **multiple roles** (Manager, HR, Coach, Team Lead) — conflict resolution is a community function (Ury, The Third Side), not a single person's burden.
2. Actions must be **specific, measurable, and assignable** — not vague recommendations like "improve communication."
3. The AI generates a **portfolio of options**, not a single solution. This mirrors the "invent options before deciding" principle from Getting to Yes.
4. **Match urgency to risk level:** Critical = act NOW; High = move quickly; Medium = address systematically; Low = monitor and reinforce.

---

## Escalation Pathway — The Third Side

When the risk level is high or critical, the system supports structured handoff to professional mediation. This implements Ury's Third Side framework:

| Step | Action | Theoretical Basis |
|------|--------|-------------------|
| 1. Flag | HR/Manager escalates; coach is assigned | Bilateral resolution has reached its limits |
| 2. Consultation | Coach reviews AI analysis + intake with HR | Third Side enters with data-grounded understanding |
| 3. Mediation | Interest-based mediation facilitated by coach | Full Harvard method: separate people, explore interests, generate options |
| 4. Follow-Up | Pulse survey at 30–60 days | Objective Criteria: measure whether interests have been addressed |

The escalation pathway is deliberately **not automated**. High/critical conflict involves Identity Conversation dynamics that require human judgment, empathy, and relational skill.

---

## Three Conversations Detection Matrix

Reference for how survey signals map to the Three Conversations framework:

| Survey Signal | Conversation Layer | Detection Pattern | AI Response |
|--------------|-------------------|-------------------|-------------|
| Low Psych Safety + Low Wellbeing | **Feelings** | Emotions suppressed by professional norms | Flag suppressed emotional dynamics; include emotion-acknowledging language in scripts |
| Low Belonging + High Avoidance (cd14=true) | **Identity** | Self-image under threat → defensive/rigid | Detect identity threat patterns; recommend coaching/mediation |
| Divergent Comm/Trust vs Conflict Frequency | **What Happened?** | Different stories about events | Identify divergent narratives without assigning blame; suggest structured dialogue |
| High Escalation Intent (cp12=true) | **All three at threshold** | Someone has reached the limit | Flag for immediate attention; check which conversations are active |
| Low Mgmt Effectiveness + High Conflict | **Third Side deficit** | Manager unable to contain conflict | Recommend Third Side activation (coaching, HR, external mediation) |
| High Workload Stress + High Interpersonal | **Structural → Relational** | Structural pressures generating interpersonal friction | Separate structural interventions from relational ones in actions |

---

## Prompt Engineering Principles

Every AI prompt in the Conflict Intelligence module follows three principles drawn from the theoretical foundations:

1. **Interest-based framing:** Never ask the AI to determine who is right or wrong. Ask it to identify patterns, root causes, and unmet needs.
2. **Conversation-ready output:** Produce manager scripts using open-ended, interest-probing questions — never accusatory or position-defending language.
3. **Multi-option generation:** Generate multiple options across time horizons and stakeholder roles, reflecting "invent options for mutual gain."

---

## Language Support

All prompts accept a `language` parameter and append an instruction to respond in the target language (en, fr, es). The analysis framework and terminology remain consistent across languages.
