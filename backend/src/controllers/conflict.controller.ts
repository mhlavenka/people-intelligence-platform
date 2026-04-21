import i18next from 'i18next';
function t(req: import('express').Request, key: string, opts?: Record<string, unknown>): string { if (typeof req.t === 'function') return String(req.t(key, opts ?? {})); return String(i18next.t(key, opts ?? {})); }
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { SurveyResponse } from '../models/SurveyResponse.model';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import { ConflictAnalysis, IConflictAnalysis } from '../models/ConflictAnalysis.model';
import { Organization } from '../models/Organization.model';
import { User } from '../models/User.model';
import { buildConflictAnalysisPrompt, buildConflictSubAnalysisPrompt, buildConflictRecommendedActionsPrompt, callClaude } from '../services/ai.service';
import { sendEmail } from '../services/email.service';
import { createHubNotification } from '../services/hubNotification.service';

const MIN_GROUP_SIZE = 5;

export async function analyzeConflict(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.user!.organizationId;
    const { templateId, departmentId, name } = req.body;

    const responseFilter: Record<string, unknown> = { organizationId, templateId };
    if (departmentId) responseFilter['departmentId'] = departmentId;

    const responses = await SurveyResponse.find(responseFilter);

    const template = await SurveyTemplate.findById(templateId).setOptions({ bypassTenantCheck: true });
    const isSurvey = !template || template.intakeType === 'survey';
    const minRequired = template?.minResponsesForAnalysis ?? (isSurvey ? MIN_GROUP_SIZE : 1);
    if (responses.length < minRequired) {
      res.status(400).json({
        error: t(req, 'errors.minimumResponsesRequired', { min: minRequired, count: responses.length }),
      });
      return;
    }

    const aggregated: Record<string, number[]> = {};
    for (const response of responses) {
      for (const item of response.responses) {
        if (!aggregated[item.questionId]) aggregated[item.questionId] = [];
        if (typeof item.value === 'number') {
          aggregated[item.questionId].push(item.value);
        }
      }
    }

    const averages: Record<string, number> = {};
    for (const [qId, values] of Object.entries(aggregated)) {
      averages[qId] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
    }

    const org = await Organization.findById(organizationId);
    if (!org) {
      res.status(404).json({ error: t(req, 'errors.organizationNotFound') });
      return;
    }

    const prompt = buildConflictAnalysisPrompt(
      {
        departmentId: departmentId || 'All Departments',
        surveyPeriod: name,
        aggregatedResponses: averages,
        responseCount: responses.length,
      },
      { name: org.name, industry: org.industry, employeeCount: org.employeeCount },
      req.language
    );

    const aiResponse = await callClaude(prompt, undefined, undefined, organizationId);

    let parsed: {
      riskScore: number;
      riskLevel: string;
      conflictTypes: string[];
      aiNarrative: string;
      managerScript: string;
    };

    try {
      let clean = aiResponse.replace(/```(?:json)?\r?\n?/g, '').replace(/```/g, '').trim();
      const jsonStart = clean.indexOf('{');
      const jsonEnd   = clean.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) clean = clean.slice(jsonStart, jsonEnd + 1);
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        riskScore: 50,
        riskLevel: 'medium',
        conflictTypes: [],
        aiNarrative: aiResponse,
        managerScript: '',
      };
    }

    const managerScript =
      typeof parsed.managerScript === 'string'
        ? parsed.managerScript
        : JSON.stringify(parsed.managerScript, null, 2);

    const analysis = await ConflictAnalysis.create({
      organizationId,
      intakeTemplateId: templateId,
      name,
      departmentId,
      riskScore: parsed.riskScore,
      riskLevel: parsed.riskLevel,
      conflictTypes: parsed.conflictTypes,
      aiNarrative: parsed.aiNarrative,
      managerScript,
      escalationRequested: false,
    });

    // Populate the template reference before returning so the client
    // doesn't need a second round-trip.
    await analysis.populate('intakeTemplateId', 'title');

    res.status(201).json(analysis);
  } catch (error) {
    next(error);
  }
}

export async function getAnalyses(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.user!.organizationId;
    const analyses = await ConflictAnalysis.find({ organizationId })
      .populate('intakeTemplateId', 'title')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(analyses);
  } catch (error) {
    next(error);
  }
}

export async function getAnalysis(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.user!.organizationId;
    const analysis = await ConflictAnalysis.findOne({
      _id: req.params['id'],
      organizationId,
    })
      .populate('intakeTemplateId', 'title')
      .populate('escalatedToCoachId', 'firstName lastName');
    if (!analysis) {
      res.status(404).json({ error: t(req, 'errors.analysisNotFound') });
      return;
    }
    res.json(analysis);
  } catch (error) {
    next(error);
  }
}

export async function getSubAnalyses(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.user!.organizationId;
    const subAnalyses = await ConflictAnalysis.find({
      organizationId,
      parentId: req.params['id'],
    }).sort({ createdAt: -1 });
    res.json(subAnalyses);
  } catch (error) {
    next(error);
  }
}

export async function createSubAnalysis(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.user!.organizationId;
    const { focusConflictType } = req.body as { focusConflictType: string };

    if (!focusConflictType) {
      res.status(400).json({ error: t(req, 'errors.focusConflictTypeRequired') });
      return;
    }

    const parent = await ConflictAnalysis.findOne({ _id: req.params['id'], organizationId });
    if (!parent) {
      res.status(404).json({ error: t(req, 'errors.parentAnalysisNotFound') });
      return;
    }

    const existing = await ConflictAnalysis.findOne({
      organizationId,
      parentId: parent._id,
      focusConflictType,
    });
    if (existing) {
      res.json(existing);
      return;
    }

    const prompt = buildConflictSubAnalysisPrompt(focusConflictType, {
      departmentId: parent.departmentId || 'All Departments',
      surveyPeriod: parent.name,
      riskScore: parent.riskScore,
      riskLevel: parent.riskLevel,
      aiNarrative: parent.aiNarrative,
    }, req.language);

    const aiResponse = await callClaude(prompt, undefined, undefined, organizationId);

    let parsed: {
      riskScore: number;
      riskLevel: string;
      conflictTypes: string[];
      aiNarrative: string;
      managerScript: unknown;
    };

    try {
      let clean = aiResponse.replace(/```(?:json)?\r?\n?/g, '').replace(/```/g, '').trim();
      const jsonStart = clean.indexOf('{');
      const jsonEnd   = clean.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) clean = clean.slice(jsonStart, jsonEnd + 1);
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        riskScore: parent.riskScore,
        riskLevel: parent.riskLevel,
        conflictTypes: [focusConflictType],
        aiNarrative: aiResponse,
        managerScript: '',
      };
    }

    const managerScript =
      typeof parsed.managerScript === 'string'
        ? parsed.managerScript
        : JSON.stringify(parsed.managerScript, null, 2);

    const subAnalysis = await ConflictAnalysis.create({
      organizationId,
      name: parent.name,
      departmentId: parent.departmentId,
      parentId: parent._id,
      focusConflictType,
      riskScore: parsed.riskScore,
      riskLevel: parsed.riskLevel as 'low' | 'medium' | 'high' | 'critical',
      conflictTypes: parsed.conflictTypes?.length ? parsed.conflictTypes : [focusConflictType],
      aiNarrative: parsed.aiNarrative,
      managerScript,
      escalationRequested: false,
    });

    res.status(201).json(subAnalysis);
  } catch (error) {
    next(error);
  }
}

export async function generateRecommendedActions(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.user!.organizationId;
    const analysis = await ConflictAnalysis.findOne({
      _id: req.params['id'],
      organizationId,
    });
    if (!analysis) {
      res.status(404).json({ error: t(req, 'errors.analysisNotFound') });
      return;
    }

    const prompt = buildConflictRecommendedActionsPrompt({
      name: analysis.name,
      departmentId: analysis.departmentId,
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      conflictTypes: analysis.conflictTypes,
      aiNarrative: analysis.aiNarrative,
    }, req.language);

    const aiResponse = await callClaude(prompt, undefined, undefined, organizationId);

    let parsed: unknown;
    try {
      let clean = aiResponse.replace(/```(?:json)?\r?\n?/g, '').replace(/```/g, '').trim();
      const jsonStart = clean.indexOf('{');
      const jsonEnd = clean.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) clean = clean.slice(jsonStart, jsonEnd + 1);
      parsed = JSON.parse(clean);
    } catch {
      parsed = { immediateActions: [], shortTermActions: [], longTermActions: [], preventiveMeasures: [aiResponse] };
    }

    analysis.recommendedActions = parsed as IConflictAnalysis['recommendedActions'];
    await analysis.save();

    res.json(parsed);
  } catch (error) {
    next(error);
  }
}

export async function escalateConflict(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.user!.organizationId;
    const { coachId, message } = req.body as { coachId?: string; message?: string };

    if (!coachId) {
      res.status(400).json({ error: t(req, 'errors.coachIdRequired') });
      return;
    }

    const coach = await User.findOne({ _id: coachId, organizationId }).select('firstName lastName email');
    if (!coach) {
      res.status(404).json({ error: t(req, 'errors.coachNotFound') });
      return;
    }

    const analysis = await ConflictAnalysis.findOneAndUpdate(
      { _id: req.params['id'], organizationId },
      {
        escalationRequested: true,
        escalationStatus: 'pending',
        escalatedToCoachId: coachId,
        escalationMessage: message,
        professionalReview: { status: 'pending' },
      },
      { new: true }
    );
    if (!analysis) {
      res.status(404).json({ error: t(req, 'errors.analysisNotFound') });
      return;
    }

    // Build action summary for email
    const ra = analysis.recommendedActions;
    const actionLines: string[] = [];
    if (ra?.immediateActions?.length) {
      actionLines.push('<h3>Immediate Actions</h3><ul>');
      for (const a of ra.immediateActions) actionLines.push(`<li><strong>${a.title}</strong> — ${a.description}</li>`);
      actionLines.push('</ul>');
    }
    if (ra?.shortTermActions?.length) {
      actionLines.push('<h3>Short-Term Actions</h3><ul>');
      for (const a of ra.shortTermActions) actionLines.push(`<li><strong>${a.title}</strong> — ${a.description}</li>`);
      actionLines.push('</ul>');
    }

    const emailHtml = `
      <h2>Professional Review Requested: ${analysis.name}</h2>
      <p>You have been assigned to review a conflict analysis.</p>
      <p><strong>Risk Level:</strong> ${analysis.riskLevel.toUpperCase()} (${analysis.riskScore}/100)</p>
      <p><strong>Conflict Types:</strong> ${analysis.conflictTypes.join(', ')}</p>
      ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
      <h3>AI Narrative</h3>
      <p>${analysis.aiNarrative}</p>
      ${actionLines.join('\n')}
      <p style="margin-top:24px"><a href="https://artes.helenacoaching.com/conflict/${analysis._id}" style="background:#3A9FD6;color:white;padding:10px 24px;border-radius:6px;text-decoration:none">Review in ARTES</a></p>
    `;

    await sendEmail({
      to: coach.email,
      subject: `Professional Review Requested: ${analysis.name} — ${analysis.riskLevel.toUpperCase()} Risk`,
      html: emailHtml,
    });

    await createHubNotification({
      userId: coachId,
      organizationId,
      type: 'conflict_alert',
      title: 'Professional Review Requested',
      body: `You've been asked to review "${analysis.name}" — ${analysis.riskLevel} risk conflict analysis.`,
      link: `/conflict/${analysis._id}`,
    });

    res.json(analysis);
  } catch (error) {
    next(error);
  }
}

export async function updateProfessionalReview(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { notes, recommendations, status } = req.body as {
      notes?: string;
      recommendations?: string;
      status?: 'in_progress' | 'completed';
    };

    const analysis = await ConflictAnalysis.findOne({
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
      escalatedToCoachId: req.user!.userId,
    });
    if (!analysis) {
      res.status(404).json({ error: t(req, 'errors.analysisNotFound') });
      return;
    }

    const review = analysis.professionalReview || { status: 'pending' };
    if (notes !== undefined) review.notes = notes;
    if (recommendations !== undefined) review.recommendations = recommendations;
    if (status) review.status = status;
    if (status === 'completed') review.reviewedAt = new Date();
    analysis.professionalReview = review;

    if (status === 'completed') {
      analysis.escalationStatus = 'resolved';
    } else if (status === 'in_progress') {
      analysis.escalationStatus = 'in_progress';
    }

    await analysis.save();
    res.json(analysis);
  } catch (error) {
    next(error);
  }
}

export async function generateActionIntake(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { actionTitle, actionDescription, actionIndex } = req.body as {
      actionTitle: string;
      actionDescription: string;
      actionIndex: number;
    };
    if (!actionTitle || !actionDescription) {
      res.status(400).json({ error: t(req, 'errors.actionDetailsRequired') });
      return;
    }

    const analysis = await ConflictAnalysis.findOne({
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
    });
    if (!analysis) {
      res.status(404).json({ error: t(req, 'errors.analysisNotFound') });
      return;
    }

    const existingMap = (analysis.generatedIntakeIds || {}) as Record<string, string>;
    const key = `immediate_${actionIndex}`;
    if (existingMap[key]) {
      res.status(409).json({ error: 'Intake already generated for this action', templateId: existingMap[key] });
      return;
    }

    const prompt = `You are an expert workplace conflict resolution intake designer.

Context: A conflict analysis "${analysis.name}" (risk: ${analysis.riskLevel}, types: ${analysis.conflictTypes.join(', ')}) has recommended the following immediate action:

Title: ${actionTitle}
Description: ${actionDescription}

Generate a focused intake survey template (5-8 questions) that would help gather data related to this specific action item. Questions should help assess the current state and track progress on this action.

Return ONLY valid JSON:
{
  "title": "<intake title related to the action>",
  "description": "<1-2 sentence description of what this intake measures>",
  "questions": [
    { "id": "q1", "text": "<question text>", "type": "<scale|text|boolean|forced_choice>", "category": "action_tracking" }
  ]
}

Rules:
- Mix question types: 2-3 scale (1-5), 2-3 text, 1-2 boolean or forced_choice
- Questions should be specific to the action, not generic
- Keep questions concise and actionable`;

    const aiResponse = await callClaude(prompt, undefined, undefined, req.user!.organizationId);
    let parsed: any;
    try {
      let clean = aiResponse.replace(/```(?:json)?\r?\n?/g, '').replace(/```/g, '').trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end > start) clean = clean.slice(start, end + 1);
      parsed = JSON.parse(clean);
    } catch {
      res.status(500).json({ error: 'Failed to parse AI response' });
      return;
    }

    const template = await SurveyTemplate.create({
      organizationId: req.user!.organizationId,
      title: parsed.title || `Follow-up: ${actionTitle}`,
      description: parsed.description || actionDescription,
      moduleType: 'conflict',
      intakeType: 'survey',
      questions: (parsed.questions || []).map((q: any, i: number) => ({
        id: q.id || `q${i + 1}`,
        text: q.text,
        type: q.type || 'text',
        category: q.category || 'action_tracking',
      })),
      isActive: true,
      isAutoGenerated: true,
    });

    existingMap[key] = template._id.toString();
    analysis.generatedIntakeIds = existingMap;
    analysis.markModified('generatedIntakeIds');
    await analysis.save();

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
}
