/**
 * ICF (International Coach Federation) credential level requirements.
 *
 * These are the official thresholds as of 2026. ICF revises requirements
 * periodically — keep this file in sync rather than hardcoding values
 * elsewhere.
 *
 * Source: https://coachingfederation.org/credentials-and-standards
 */

export type IcfLevelKey = 'ACC' | 'PCC' | 'MCC';

export interface IcfLevel {
  key: IcfLevelKey;
  name: string;
  coachingHoursRequired: number;
  trainingHoursRequired: number;     // separate; ARTES does not track these yet
  mentorCoachingHoursRequired: number;
}

export const ICF_LEVELS: IcfLevel[] = [
  {
    key: 'ACC',
    name: 'Associate Certified Coach',
    coachingHoursRequired: 100,
    trainingHoursRequired: 60,
    mentorCoachingHoursRequired: 10,
  },
  {
    key: 'PCC',
    name: 'Professional Certified Coach',
    coachingHoursRequired: 500,
    trainingHoursRequired: 125,
    mentorCoachingHoursRequired: 10,
  },
  {
    key: 'MCC',
    name: 'Master Certified Coach',
    coachingHoursRequired: 2500,
    trainingHoursRequired: 200,
    mentorCoachingHoursRequired: 10,
  },
];

export function getIcfLevel(key: IcfLevelKey): IcfLevel {
  const level = ICF_LEVELS.find((l) => l.key === key);
  if (!level) throw new Error(`Unknown ICF level: ${key}`);
  return level;
}
