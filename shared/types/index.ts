// ============================================================
// Shared TypeScript interfaces — backend + frontend
// People Intelligence Platform
// ============================================================

export type UserRole = 'admin' | 'hr_manager' | 'manager' | 'coachee' | 'coach';
export type PlanType = 'starter' | 'professional' | 'enterprise';
export type ModuleType = 'conflict' | 'neuroinclusion' | 'succession';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type IDPStatus = 'draft' | 'active' | 'completed';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed';
export type QuestionType = 'scale' | 'text' | 'boolean';

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  plan: PlanType;
  modules: string[];
  billingEmail: string;
  stripeCustomerId?: string;
  employeeCount?: number;
  industry?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  category: string;
}

export interface SurveyTemplate {
  _id: string;
  organizationId: string;
  moduleType: ModuleType;
  title: string;
  questions: Question[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ResponseItem {
  questionId: string;
  value: string | number | boolean;
}

export interface SurveyResponse {
  _id: string;
  organizationId: string;
  templateId: string;
  departmentId?: string;
  responses: ResponseItem[];
  submittedAt: string;
  isAnonymous: boolean;
}

export interface ConflictAnalysis {
  _id: string;
  organizationId: string;
  surveyPeriod: string;
  departmentId?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  conflictTypes: string[];
  aiNarrative: string;
  managerScript: string;
  escalationRequested: boolean;
  escalationStatus?: 'pending' | 'in_progress' | 'resolved' | 'escalated';
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  _id: string;
  title: string;
  dueDate: string;
  status: MilestoneStatus;
  notes?: string;
}

export interface DevelopmentPlan {
  _id: string;
  organizationId: string;
  coacheeId: string;
  coachId?: string;
  goal: string;
  currentReality: string;
  options: string[];
  willDoActions: string[];
  milestones: Milestone[];
  eqiScores: Record<string, number>;
  competencyGaps: string[];
  aiGeneratedContent: string;
  status: IDPStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Dimension {
  name: string;
  score: number;
  responses: Record<string, unknown>;
}

export interface NeuroinclustionAssessment {
  _id: string;
  organizationId: string;
  respondentRole: string;
  dimensions: Dimension[];
  overallMaturityScore: number;
  aiGapAnalysis: string;
  actionRoadmap: string[];
  completedAt: string;
  createdAt: string;
  updatedAt: string;
}

// API response wrappers
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'createdAt' | 'updatedAt'> & { id: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  error: string;
  statusCode?: number;
}
