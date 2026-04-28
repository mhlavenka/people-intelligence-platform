/**
 * Seed default intake templates for the HeadSoft Internal org.
 * Run once: npm run seed:surveys
 *
 * Creates 5 templates across all three modules:
 *   1. Conflict Intelligence — Bi-Weekly Pulse Survey
 *   2. Conflict Intelligence — Quarterly Deep-Dive
 *   3. Neuro-Inclusion Compass — Organizational Maturity Assessment
 *   4. Leadership Readiness — 360° Self-Assessment
 *   5. Succession Bench Strength Survey
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import type { IQuestion } from '../models/SurveyTemplate.model';

const bypass = { bypassTenantCheck: true };

// ─────────────────────────────────────────────────────────────────────────────
// Template definitions
// ─────────────────────────────────────────────────────────────────────────────

const conflictPulse: { title: string; moduleType: 'conflict'; questions: IQuestion[] } = {
  title: 'Conflict Intelligence — Bi-Weekly Pulse Survey',
  moduleType: 'conflict',
  questions: [
    // Psychological Safety
    { id: 'cp01', category: 'Psychological Safety', type: 'scale',
      text: 'I feel safe expressing concerns or disagreements with my team without fear of negative consequences.' },
    { id: 'cp02', category: 'Psychological Safety', type: 'scale',
      text: 'People in my team are able to bring up problems and difficult issues.' },
    { id: 'cp03', category: 'Psychological Safety', type: 'boolean',
      text: 'In the past two weeks, have you witnessed behaviour that made you feel uncomfortable or unsafe at work?' },

    // Communication & Trust
    { id: 'cp04', category: 'Communication & Trust', type: 'scale',
      text: 'Communication within my team is open, honest, and respectful.' },
    { id: 'cp05', category: 'Communication & Trust', type: 'scale',
      text: 'I trust that my colleagues will follow through on their commitments.' },
    { id: 'cp06', category: 'Communication & Trust', type: 'scale',
      text: 'Disagreements in my team are resolved constructively rather than avoided or escalated.' },

    // Conflict Frequency
    { id: 'cp07', category: 'Conflict Frequency', type: 'scale',
      text: 'In the past two weeks, how often have you experienced tension or conflict with a colleague?' },
    { id: 'cp08', category: 'Conflict Frequency', type: 'boolean',
      text: 'Is there an unresolved conflict in your team that is affecting your ability to do your job?' },
    { id: 'cp09', category: 'Conflict Frequency', type: 'scale',
      text: 'How much has workplace tension affected your productivity over the past two weeks?' },

    // Management Effectiveness
    { id: 'cp10', category: 'Management Effectiveness', type: 'scale',
      text: 'My manager addresses conflict or interpersonal issues in a fair and timely manner.' },
    { id: 'cp11', category: 'Management Effectiveness', type: 'scale',
      text: 'I feel my manager creates an environment where team members treat each other with respect.' },

    // Escalation Intent
    { id: 'cp12', category: 'Escalation Intent', type: 'boolean',
      text: 'Is there a situation in your team right now that you believe requires HR or leadership intervention?' },
    { id: 'cp13', category: 'Escalation Intent', type: 'text',
      text: 'If you are experiencing a conflict or tension at work, what type best describes it? (e.g. workload, interpersonal, communication, values, leadership)' },

    // Wellbeing
    { id: 'cp14', category: 'Wellbeing', type: 'scale',
      text: 'Overall, how would you rate your sense of wellbeing and belonging at work this week?' },
    { id: 'cp15', category: 'Wellbeing', type: 'text',
      text: 'Is there anything else you would like your manager or HR to be aware of? (Optional — your response is anonymous)' },
  ],
};

const conflictDeepDive: { title: string; moduleType: 'conflict'; questions: IQuestion[] } = {
  title: 'Conflict Intelligence — Quarterly Deep-Dive Analysis',
  moduleType: 'conflict',
  questions: [
    // Conflict Culture
    { id: 'cd01', category: 'Conflict Culture', type: 'scale',
      text: 'Our organization has a healthy culture for addressing conflict and disagreement.' },
    { id: 'cd02', category: 'Conflict Culture', type: 'scale',
      text: 'When conflicts arise, they are typically addressed directly rather than passively avoided.' },
    { id: 'cd03', category: 'Conflict Culture', type: 'scale',
      text: 'My organization provides employees with the tools and support they need to resolve conflicts.' },
    { id: 'cd04', category: 'Conflict Culture', type: 'boolean',
      text: 'Have you received any training on conflict resolution or difficult conversations in the past year?' },

    // Psychological Safety
    { id: 'cd05', category: 'Psychological Safety', type: 'scale',
      text: 'I feel comfortable challenging the ideas of senior colleagues or managers without fear of reprisal.' },
    { id: 'cd06', category: 'Psychological Safety', type: 'scale',
      text: 'Mistakes in my team are treated as learning opportunities, not causes for blame.' },
    { id: 'cd07', category: 'Psychological Safety', type: 'scale',
      text: 'I believe my unique perspective and contributions are genuinely valued by my team.' },

    // Interpersonal Dynamics
    { id: 'cd08', category: 'Interpersonal Dynamics', type: 'scale',
      text: 'There are unresolved interpersonal tensions in my team that have persisted for more than one month.' },
    { id: 'cd09', category: 'Interpersonal Dynamics', type: 'scale',
      text: 'Power imbalances (seniority, personality, influence) negatively affect how conflict is handled in my team.' },
    { id: 'cd10', category: 'Interpersonal Dynamics', type: 'scale',
      text: 'People in my team are able to disagree with each other while still collaborating effectively.' },

    // Leadership & Mediation
    { id: 'cd11', category: 'Leadership & Mediation', type: 'scale',
      text: 'My manager models healthy conflict resolution behaviour in their own interactions.' },
    { id: 'cd12', category: 'Leadership & Mediation', type: 'scale',
      text: 'When I have raised a conflict or concern with my manager, it was handled appropriately.' },
    { id: 'cd13', category: 'Leadership & Mediation', type: 'scale',
      text: 'I trust that HR would handle a formal conflict complaint fairly and confidentially.' },
    { id: 'cd14', category: 'Leadership & Mediation', type: 'boolean',
      text: 'Have you ever avoided raising a valid conflict concern because you were worried about how it would be handled?' },

    // Workload & Structural Stressors
    { id: 'cd15', category: 'Workload & Structural Stressors', type: 'scale',
      text: 'Workload pressure or unclear role boundaries have contributed to friction in my team.' },
    { id: 'cd16', category: 'Workload & Structural Stressors', type: 'scale',
      text: 'Competing priorities between departments or teams create unnecessary conflict.' },
    { id: 'cd17', category: 'Workload & Structural Stressors', type: 'scale',
      text: 'I have the resources, clarity, and autonomy I need to do my job without conflict arising.' },

    // Cross-Team Conflict
    { id: 'cd18', category: 'Cross-Team Conflict', type: 'scale',
      text: 'Conflict or tension between departments or teams is a recurring problem in this organization.' },
    { id: 'cd19', category: 'Cross-Team Conflict', type: 'boolean',
      text: 'Have you experienced conflict with someone outside your immediate team in the past quarter?' },

    // Outcomes & Impact
    { id: 'cd20', category: 'Outcomes & Impact', type: 'scale',
      text: 'Conflict at work has negatively impacted my engagement or intention to stay at this organization.' },
    { id: 'cd21', category: 'Outcomes & Impact', type: 'text',
      text: 'What is the single most important change your organization could make to reduce workplace conflict?' },
  ],
};

const neuroinclMaturity: { title: string; moduleType: 'neuroinclusion'; questions: IQuestion[] } = {
  title: 'Neuro-Inclusion Compass™ — Organizational Maturity Assessment',
  moduleType: 'neuroinclusion',
  questions: [
    // Dimension 1: Awareness & Culture
    { id: 'ni01', category: 'Awareness & Culture', type: 'scale',
      text: 'Leadership in my organization openly and positively acknowledges neurodiversity as part of our inclusion strategy.' },
    { id: 'ni02', category: 'Awareness & Culture', type: 'scale',
      text: 'Employees in my organization have a good understanding of what neurodiversity means (e.g. ADHD, autism, dyslexia, dyspraxia).' },
    { id: 'ni03', category: 'Awareness & Culture', type: 'scale',
      text: 'Neurodivergent employees in my organization feel they can be open about their neurotype without stigma.' },
    { id: 'ni04', category: 'Awareness & Culture', type: 'boolean',
      text: 'Has your organization communicated a formal commitment to neuroinclusion in the past 12 months?' },

    // Dimension 2: Recruitment & Onboarding
    { id: 'ni05', category: 'Recruitment & Onboarding', type: 'scale',
      text: 'Our job postings use plain language, avoid unnecessarily complex requirements, and are accessible to neurodivergent applicants.' },
    { id: 'ni06', category: 'Recruitment & Onboarding', type: 'scale',
      text: 'Our interview process offers alternative formats (e.g. written questions in advance, task-based assessments) for candidates who request them.' },
    { id: 'ni07', category: 'Recruitment & Onboarding', type: 'scale',
      text: 'New employees receive structured onboarding that includes written guides, clear expectations, and regular check-ins.' },
    { id: 'ni08', category: 'Recruitment & Onboarding', type: 'boolean',
      text: 'Are hiring managers trained to provide accommodations during the interview and onboarding process?' },

    // Dimension 3: Workspace & Physical Environment
    { id: 'ni09', category: 'Workspace & Physical Environment', type: 'scale',
      text: 'Our workplace has quiet zones or low-stimulation areas available for employees who need them.' },
    { id: 'ni10', category: 'Workspace & Physical Environment', type: 'scale',
      text: 'Employees have flexibility in where and how they work (e.g. remote work, hot-desking, specific seating) to suit their sensory needs.' },
    { id: 'ni11', category: 'Workspace & Physical Environment', type: 'scale',
      text: 'The physical environment (lighting, noise levels, open-plan layout) is considerate of employees with sensory sensitivities.' },

    // Dimension 4: Communication & Collaboration
    { id: 'ni12', category: 'Communication & Collaboration', type: 'scale',
      text: 'My organization supports multiple communication styles — written, verbal, and asynchronous — without penalizing any preference.' },
    { id: 'ni13', category: 'Communication & Collaboration', type: 'scale',
      text: 'Meeting agendas and materials are shared in advance so all employees can prepare fully.' },
    { id: 'ni14', category: 'Communication & Collaboration', type: 'scale',
      text: 'Employees are not negatively judged for communication differences such as directness, brevity, or unconventional social interaction styles.' },

    // Dimension 5: Leadership & Management
    { id: 'ni15', category: 'Leadership & Management', type: 'scale',
      text: 'Managers in my organization know how to recognize signs that an employee may benefit from a neuroinclusion accommodation.' },
    { id: 'ni16', category: 'Leadership & Management', type: 'scale',
      text: 'Managers tailor their management approach to the individual rather than applying a one-size-fits-all style.' },
    { id: 'ni17', category: 'Leadership & Management', type: 'boolean',
      text: 'Have managers in your organization received training on supporting neurodivergent employees in the past year?' },

    // Dimension 6: Policy & Accommodation Process
    { id: 'ni18', category: 'Policy & Accommodation Process', type: 'scale',
      text: 'My organization has a clear, accessible process for employees to request workplace accommodations.' },
    { id: 'ni19', category: 'Policy & Accommodation Process', type: 'scale',
      text: 'Accommodation requests are handled confidentially, promptly, and without stigma.' },
    { id: 'ni20', category: 'Policy & Accommodation Process', type: 'boolean',
      text: 'Does your organization have a formal neuroinclusion or neurodiversity policy?' },

    // Dimension 7: Learning & Development
    { id: 'ni21', category: 'Learning & Development', type: 'scale',
      text: 'Training and development content in my organization is available in multiple formats (e.g. written, video, self-paced, in-person).' },
    { id: 'ni22', category: 'Learning & Development', type: 'scale',
      text: 'Neurodivergent employees have equal access to career development and advancement opportunities.' },
    { id: 'ni23', category: 'Learning & Development', type: 'scale',
      text: 'Performance evaluation criteria are applied equitably and do not inadvertently disadvantage neurodivergent employees.' },

    // Dimension 8: Workflow Design & Task Structure
    { id: 'ni24', category: 'Workflow Design & Task Structure', type: 'scale',
      text: 'Work is structured with clear priorities, deadlines, and step-by-step guidance that supports executive function.' },
    { id: 'ni25', category: 'Workflow Design & Task Structure', type: 'scale',
      text: 'Employees have access to tools or strategies (e.g. task lists, time-blocking, project management software) that help them stay organized.' },
    { id: 'ni26', category: 'Workflow Design & Task Structure', type: 'scale',
      text: 'Deep-focus work time is protected — employees are not expected to be constantly available or interrupted throughout the day.' },
    { id: 'ni27', category: 'Workflow Design & Task Structure', type: 'text',
      text: 'What is the single most important change your organization could make to become more neuro-inclusive? (Optional)' },
  ],
};

const leadershipReadiness: { title: string; moduleType: 'succession'; questions: IQuestion[] } = {
  title: 'Leadership Readiness — 360° Self-Assessment',
  moduleType: 'succession',
  questions: [
    // Leadership Effectiveness
    { id: 'lr01', category: 'Leadership Effectiveness', type: 'scale',
      text: 'I consistently communicate a clear vision and direction that motivates my team.' },
    { id: 'lr02', category: 'Leadership Effectiveness', type: 'scale',
      text: 'I make sound decisions under pressure, balancing short-term needs with long-term strategy.' },
    { id: 'lr03', category: 'Leadership Effectiveness', type: 'scale',
      text: 'I hold myself and others accountable for results while maintaining a psychologically safe environment.' },

    // Emotional Intelligence
    { id: 'lr04', category: 'Emotional Intelligence', type: 'scale',
      text: 'I am aware of how my emotions affect my behaviour and the people around me.' },
    { id: 'lr05', category: 'Emotional Intelligence', type: 'scale',
      text: 'I demonstrate empathy by genuinely seeking to understand the perspectives and needs of others before responding.' },
    { id: 'lr06', category: 'Emotional Intelligence', type: 'scale',
      text: 'I manage stress and pressure effectively without it negatively impacting my relationships.' },
    { id: 'lr07', category: 'Emotional Intelligence', type: 'scale',
      text: 'I remain optimistic and solution-focused when facing setbacks or ambiguity.' },

    // Communication & Influence
    { id: 'lr08', category: 'Communication & Influence', type: 'scale',
      text: 'I communicate complex ideas clearly and adapt my style to different audiences (executive, team, external).' },
    { id: 'lr09', category: 'Communication & Influence', type: 'scale',
      text: 'I build trust and credibility with stakeholders at all levels of the organization.' },
    { id: 'lr10', category: 'Communication & Influence', type: 'scale',
      text: 'I am comfortable delivering difficult feedback and having courageous conversations.' },

    // Strategic Thinking
    { id: 'lr11', category: 'Strategic Thinking', type: 'scale',
      text: 'I think beyond my immediate role and consider the broader organizational and market context.' },
    { id: 'lr12', category: 'Strategic Thinking', type: 'scale',
      text: 'I proactively identify risks, opportunities, and trends that are relevant to the future of the organization.' },
    { id: 'lr13', category: 'Strategic Thinking', type: 'scale',
      text: 'I translate strategic priorities into concrete plans and actions with measurable outcomes.' },

    // People Development
    { id: 'lr14', category: 'People Development', type: 'scale',
      text: 'I actively invest time in coaching and developing the people who report to me.' },
    { id: 'lr15', category: 'People Development', type: 'scale',
      text: 'I identify and develop successors for my own role and for key positions on my team.' },
    { id: 'lr16', category: 'People Development', type: 'scale',
      text: 'I create an environment where people feel empowered to take initiative and grow.' },

    // Adaptability & Change
    { id: 'lr17', category: 'Adaptability & Change', type: 'scale',
      text: 'I embrace change and help my team navigate ambiguity with confidence.' },
    { id: 'lr18', category: 'Adaptability & Change', type: 'scale',
      text: 'I challenge the status quo and seek continuous improvement rather than defaulting to what has always been done.' },

    // Self-Awareness & Development
    { id: 'lr19', category: 'Self-Awareness & Development', type: 'scale',
      text: 'I actively seek feedback from others and use it to improve my leadership.' },
    { id: 'lr20', category: 'Self-Awareness & Development', type: 'scale',
      text: 'I have a clear picture of my leadership strengths and the competency gaps I need to address.' },
    { id: 'lr21', category: 'Self-Awareness & Development', type: 'text',
      text: 'Describe the leadership challenge or development area you most want to focus on in your IDP.' },
  ],
};

const successionBench: { title: string; moduleType: 'succession'; questions: IQuestion[] } = {
  title: 'Succession Bench Strength Survey',
  moduleType: 'succession',
  questions: [
    // Role Readiness
    { id: 'sb01', category: 'Role Readiness', type: 'scale',
      text: 'I believe I could step into a more senior role within the next 6–12 months with the right support.' },
    { id: 'sb02', category: 'Role Readiness', type: 'scale',
      text: 'I have a clear understanding of what is required to be successful in the next level above my current role.' },
    { id: 'sb03', category: 'Role Readiness', type: 'boolean',
      text: 'Do you currently have an active Individual Development Plan (IDP) aligned to a future leadership role?' },

    // Organizational Knowledge
    { id: 'sb04', category: 'Organizational Knowledge', type: 'scale',
      text: 'I have a strong grasp of my organization\'s strategy, priorities, and competitive position.' },
    { id: 'sb05', category: 'Organizational Knowledge', type: 'scale',
      text: 'I understand the key interdependencies between my function and the rest of the business.' },
    { id: 'sb06', category: 'Organizational Knowledge', type: 'scale',
      text: 'I have built strong relationships with stakeholders across multiple parts of the organization.' },

    // Leadership Aspiration
    { id: 'sb07', category: 'Leadership Aspiration', type: 'scale',
      text: 'I am motivated to take on broader leadership responsibility within this organization.' },
    { id: 'sb08', category: 'Leadership Aspiration', type: 'scale',
      text: 'I see a clear path for career advancement within my current organization over the next 2–3 years.' },
    { id: 'sb09', category: 'Leadership Aspiration', type: 'boolean',
      text: 'Have you had a conversation with your manager about your succession potential in the past year?' },

    // Competency Gaps
    { id: 'sb10', category: 'Competency Gaps', type: 'scale',
      text: 'I have received sufficient stretch assignments or cross-functional experience to prepare me for a senior role.' },
    { id: 'sb11', category: 'Competency Gaps', type: 'scale',
      text: 'I have access to the coaching, mentoring, or sponsorship I need to grow into a leadership role.' },
    { id: 'sb12', category: 'Competency Gaps', type: 'text',
      text: 'What is the biggest gap — skill, experience, or exposure — standing between you and your next leadership role?' },

    // Organizational Support
    { id: 'sb13', category: 'Organizational Support', type: 'scale',
      text: 'My organization proactively identifies and invests in high-potential employees.' },
    { id: 'sb14', category: 'Organizational Support', type: 'scale',
      text: 'Succession planning in this organization is transparent, fair, and not driven by favouritism.' },
    { id: 'sb15', category: 'Organizational Support', type: 'scale',
      text: 'I feel confident that my contributions are visible to senior leadership.' },

    // Retention Risk
    { id: 'sb16', category: 'Retention Risk', type: 'scale',
      text: 'I intend to still be working at this organization in two years\' time.' },
    { id: 'sb17', category: 'Retention Risk', type: 'boolean',
      text: 'Have you considered leaving this organization in the past six months due to a lack of growth opportunities?' },
    { id: 'sb18', category: 'Retention Risk', type: 'text',
      text: 'What is the single most important thing your organization could do to accelerate your readiness for a senior role?' },
  ],
};

const coachingPreSession: {
  title: string;
  moduleType: 'coaching';
  intakeType: 'assessment';
  description: string;
  instructions: string;
  questions: IQuestion[];
} = {
  title: 'Coaching — Pre-Session Reflection',
  moduleType: 'coaching',
  intakeType: 'assessment',
  description:
    'A short reflection for the coachee to complete in the hours before a coaching session. ' +
    'Helps the coach prepare and ensures the session time focuses on what matters most.',
  instructions:
    'Take 5–10 minutes before your session to reflect on the prompts below. ' +
    'There are no right or wrong answers — your honesty gives the session its direction.',
  questions: [
    { id: 'cps01', category: 'Current State', type: 'scale',
      text: 'How would you rate your energy level right now? (1 = depleted, 5 = energised)' },
    { id: 'cps02', category: 'Current State', type: 'scale',
      text: 'How emotionally ready do you feel to explore challenging topics today? (1 = not ready, 5 = fully ready)' },
    { id: 'cps03', category: 'Focus', type: 'text',
      text: 'What is the single most important topic you want to bring to this session?' },
    { id: 'cps04', category: 'Focus', type: 'text',
      text: 'What would make this session a success for you? What do you want to walk away with?' },
    { id: 'cps05', category: 'Since Last Session', type: 'text',
      text: 'What has been most on your mind since we last spoke?' },
    { id: 'cps06', category: 'Since Last Session', type: 'scale',
      text: 'How would you rate your progress on the commitments or actions from your last session? (1 = no progress, 5 = fully delivered)' },
    { id: 'cps07', category: 'Since Last Session', type: 'text',
      text: 'Describe one event, conversation, or insight from the last week or two that feels significant.' },
    { id: 'cps08', category: 'Obstacles', type: 'text',
      text: 'What, if anything, is getting in the way of what you want to achieve right now?' },
    { id: 'cps09', category: 'Support', type: 'text',
      text: 'What kind of support would be most useful from me as your coach today? (e.g. challenge, listening, structure, accountability)' },
    { id: 'cps10', category: 'Boundaries', type: 'text',
      text: 'Is there anything you would prefer not to discuss in this session? (Optional)' },
  ],
};

const coachingPostSession: {
  title: string;
  moduleType: 'coaching';
  intakeType: 'assessment';
  description: string;
  instructions: string;
  questions: IQuestion[];
} = {
  title: 'Coaching — Post-Session Reflection',
  moduleType: 'coaching',
  intakeType: 'assessment',
  description:
    'A short reflection for the coachee to complete shortly after a coaching session. ' +
    'Captures insights while they are fresh and helps both coach and coachee track progress.',
  instructions:
    'Take 5 minutes after your session to capture what landed, what shifted, and what you commit to next. ' +
    'There are no right or wrong answers — your honest reflection is what makes coaching work.',
  questions: [
    { id: 'cposs01', category: 'Insight', type: 'text',
      text: 'What is the single most important thing you are taking away from this session?' },
    { id: 'cposs02', category: 'Insight', type: 'text',
      text: 'What shifted in your thinking, feeling, or perspective during the session?' },
    { id: 'cposs03', category: 'Action', type: 'text',
      text: 'What specific action or commitment will you take before our next session, and by when?' },
    { id: 'cposs04', category: 'Support', type: 'text',
      text: 'What support or resources do you need to follow through on this commitment?' },
    { id: 'cposs05', category: 'Session Quality', type: 'scale',
      text: 'How valuable was this session for you? (1 = not valuable, 5 = highly valuable)' },
  ],
};

const coachingMidpointReview: {
  title: string;
  moduleType: 'coaching';
  intakeType: 'interview';
  description: string;
  instructions: string;
  questions: IQuestion[];
} = {
  title: 'Coaching — Mid-Point Three-Way Review',
  moduleType: 'coaching',
  intakeType: 'interview',
  description:
    'Structured agenda for the mid-engagement three-way conversation between coach, coachee, and sponsor. ' +
    'Captures progress observations, recalibrates goals, and surfaces what the sponsor can do to support the coachee further.',
  instructions:
    'Use this template to lead the mid-point review. Capture each participant\'s perspective in turn. ' +
    'Output is shareable with the sponsor in summary form (sensitive coachee content stays private).',
  questions: [
    { id: 'mid01', category: 'Progress to Goals', type: 'text',
      text: 'For each coaching goal, where are we against where we wanted to be at the half-way mark? Note evidence from the coachee\'s own observations and any third-party signals.' },
    { id: 'mid02', category: 'Behavioral Change Observed', type: 'text',
      text: 'What specific behavioural shifts has the sponsor observed in the coachee since coaching began?' },
    { id: 'mid03', category: 'Behavioral Change Observed', type: 'text',
      text: 'What has the coachee observed about themselves that wasn\'t visible at the start of the engagement?' },
    { id: 'mid04', category: 'Sponsor Perspective', type: 'text',
      text: 'From the sponsor\'s perspective, what is now most important for this coachee to focus on through the second half?' },
    { id: 'mid05', category: 'Sponsor Perspective', type: 'text',
      text: 'What organizational support — assignments, exposure, projects — would amplify the impact of the remaining sessions?' },
    { id: 'mid06', category: 'Areas Needing More Focus', type: 'text',
      text: 'Which goals or development areas are off-track, and what is getting in the way?' },
    { id: 'mid07', category: 'Recalibration', type: 'text',
      text: 'Should any goals be adjusted, dropped, or added based on what we have learned in the first half?' },
    { id: 'mid08', category: 'Recalibration', type: 'text',
      text: 'Are there any contextual changes (organizational, role, personal) that should reshape the plan for the remaining sessions?' },
    { id: 'mid09', category: 'Concerns', type: 'text',
      text: 'Are there any concerns from the sponsor or coachee that need to be addressed before continuing?' },
    { id: 'mid10', category: 'Commitments', type: 'text',
      text: 'What does each party (coach, coachee, sponsor) commit to between now and the close of the engagement?' },
  ],
};

const coachingFinalReview: {
  title: string;
  moduleType: 'coaching';
  intakeType: 'interview';
  description: string;
  instructions: string;
  questions: IQuestion[];
} = {
  title: 'Coaching — Final Engagement Review',
  moduleType: 'coaching',
  intakeType: 'interview',
  description:
    'Closure agenda for the final three-way conversation. Reviews outcomes against goals, captures pre/post change, ' +
    'agrees on a transition plan for sustained growth, and signs off the engagement.',
  instructions:
    'Use this template at the engagement closure meeting with coach, coachee, and sponsor. ' +
    'The output feeds the final report shared with the sponsor.',
  questions: [
    { id: 'fin01', category: 'Outcomes', type: 'text',
      text: 'For each original coaching goal, what was achieved? Where possible, cite measurable evidence (assessment deltas, 360 changes, business outcomes).' },
    { id: 'fin02', category: 'Outcomes', type: 'text',
      text: 'Which outcomes exceeded what was originally agreed, and why?' },
    { id: 'fin03', category: 'Outcomes', type: 'text',
      text: 'Which outcomes fell short of what was agreed, and what would need to be true for them to land in the next 6 months?' },
    { id: 'fin04', category: 'Behavioral Change', type: 'text',
      text: 'What shifts in behaviour, mindset, or capability does the sponsor recognise as most material since coaching began?' },
    { id: 'fin05', category: 'Behavioral Change', type: 'text',
      text: 'How has the coachee\'s self-awareness, choices, and decision-making changed?' },
    { id: 'fin06', category: 'Sustainment', type: 'text',
      text: 'What practices, routines, or supports will the coachee continue independently to keep the gains?' },
    { id: 'fin07', category: 'Sustainment', type: 'text',
      text: 'What organizational reinforcement (manager check-ins, peer accountability, exposure opportunities) will help these gains stick?' },
    { id: 'fin08', category: 'Recommendations', type: 'text',
      text: 'What does the coach recommend for the coachee\'s next 6–12 months — including any further coaching, mentoring, or formal development?' },
    { id: 'fin09', category: 'Recommendations', type: 'text',
      text: 'What is the sponsor\'s recommendation for next steps from an organizational perspective?' },
    { id: 'fin10', category: 'Closure', type: 'text',
      text: 'Acknowledgements: what does each party most want to thank or acknowledge in the others?' },
    { id: 'fin11', category: 'Closure', type: 'text',
      text: 'Does the sponsor have any feedback for the coach on the coaching process itself, for use in future engagements?' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Seeder
// ─────────────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const templates: Array<{
    title: string;
    moduleType: 'conflict' | 'neuroinclusion' | 'succession' | 'coaching';
    intakeType?: 'survey' | 'interview' | 'assessment';
    description?: string;
    instructions?: string;
    questions: IQuestion[];
  }> = [
    conflictPulse,
    conflictDeepDive,
    neuroinclMaturity,
    leadershipReadiness,
    successionBench,
    coachingPreSession,
    coachingPostSession,
    coachingMidpointReview,
    coachingFinalReview,
  ];

  // Remove any old org-scoped copies created by a previous seed run
  const titles = templates.map((t) => t.title);
  const deleted = await SurveyTemplate.deleteMany({
    title: { $in: titles },
    isGlobal: { $ne: true },
  }).setOptions(bypass);
  if (deleted.deletedCount > 0) {
    console.log(`  Removed ${deleted.deletedCount} old org-scoped template(s)`);
  }

  let created = 0;
  let skipped = 0;

  for (const tpl of templates) {
    const existing = await SurveyTemplate
      .findOne({ title: tpl.title, isGlobal: true })
      .setOptions(bypass);

    if (existing) {
      console.log(`  skip  ${tpl.title}`);
      skipped++;
      continue;
    }

    await SurveyTemplate.create({
      moduleType: tpl.moduleType,
      intakeType: tpl.intakeType ?? 'survey',
      title: tpl.title,
      description: tpl.description,
      instructions: tpl.instructions,
      questions: tpl.questions,
      isActive: true,
      isGlobal: true,
      // organizationId and createdBy intentionally omitted — global templates belong to no org
    });

    console.log(`  ✓ created  [${tpl.moduleType}]  ${tpl.title}  (${tpl.questions.length} questions)`);
    created++;
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`  Intake templates: ${created} created, ${skipped} already existed`);
  console.log(`─────────────────────────────────────\n`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
