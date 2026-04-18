import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { SurveyResponse } from '../models/SurveyResponse.model';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import { ConflictAnalysis, IConflictAnalysis } from '../models/ConflictAnalysis.model';
import { Organization } from '../models/Organization.model';
import { buildConflictAnalysisPrompt, buildConflictSubAnalysisPrompt, buildConflictRecommendedActionsPrompt, callClaude } from '../services/ai.service';

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
        error: `Minimum ${minRequired} response${minRequired > 1 ? 's' : ''} required for analysis. Current: ${responses.length}`,
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
      res.status(404).json({ error: 'Organization not found' });
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

    const aiResponse = await callClaude(prompt);

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
    }).populate('intakeTemplateId', 'title');
    if (!analysis) {
      res.status(404).json({ error: 'Analysis not found' });
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
      res.status(400).json({ error: 'focusConflictType is required' });
      return;
    }

    const parent = await ConflictAnalysis.findOne({ _id: req.params['id'], organizationId });
    if (!parent) {
      res.status(404).json({ error: 'Parent analysis not found' });
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

    const aiResponse = await callClaude(prompt);

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
      res.status(404).json({ error: 'Analysis not found' });
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

    const aiResponse = await callClaude(prompt);

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
    const analysis = await ConflictAnalysis.findOneAndUpdate(
      { _id: req.params['id'], organizationId },
      { escalationRequested: true, escalationStatus: 'pending' },
      { new: true }
    );
    if (!analysis) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }
    res.json(analysis);
  } catch (error) {
    next(error);
  }
}
