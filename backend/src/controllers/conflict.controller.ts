import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { SurveyResponse } from '../models/SurveyResponse.model';
import { ConflictAnalysis } from '../models/ConflictAnalysis.model';
import { Organization } from '../models/Organization.model';
import { buildConflictAnalysisPrompt, callClaude } from '../services/ai.service';

const MIN_GROUP_SIZE = 5;

export async function analyzeConflict(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.user!.organizationId;
    const { templateId, departmentId, surveyPeriod } = req.body;

    // Only filter by departmentId if one was actually specified
    const responseFilter: Record<string, unknown> = { organizationId, templateId };
    if (departmentId) responseFilter['departmentId'] = departmentId;

    const responses = await SurveyResponse.find(responseFilter);

    if (responses.length < MIN_GROUP_SIZE) {
      res.status(400).json({
        error: `Minimum ${MIN_GROUP_SIZE} responses required for analysis. Current: ${responses.length}`,
      });
      return;
    }

    // Aggregate numeric responses only — no individual-level data
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
        surveyPeriod,
        aggregatedResponses: averages,
        responseCount: responses.length,
      },
      { name: org.name, industry: org.industry, employeeCount: org.employeeCount }
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
      surveyPeriod,
      departmentId,
      riskScore: parsed.riskScore,
      riskLevel: parsed.riskLevel,
      conflictTypes: parsed.conflictTypes,
      aiNarrative: parsed.aiNarrative,
      managerScript,
      escalationRequested: false,
    });

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
    const analyses = await ConflictAnalysis.find({ organizationId }).sort({ createdAt: -1 }).limit(50);
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
    });
    if (!analysis) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }
    res.json(analysis);
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
    // TODO: Trigger notification to HR/coach via email service
    res.json(analysis);
  } catch (error) {
    next(error);
  }
}
