/**
 * EQi 2.0 PDF Assessment Parser
 * Extracts scores from MHS EQi 2.0 PDF reports (Workplace, Leadership, 360, Group).
 * Uses pdf-parse for text extraction and pattern matching for score detection.
 */
import * as fs from 'fs';
import { PDFParse } from 'pdf-parse';

// ── Interfaces ───────────────────────────────────────────────────────────────

export type ReportType = 'WORKPLACE' | 'LEADERSHIP' | 'GROUP' | 'THREESIXTY' | 'UNKNOWN';

export interface EqiScores {
  // 15 subscales
  selfRegard: number | null;
  selfActualization: number | null;
  emotionalSelfAwareness: number | null;
  emotionalExpression: number | null;
  assertiveness: number | null;
  independence: number | null;
  interpersonalRelationships: number | null;
  empathy: number | null;
  socialResponsibility: number | null;
  problemSolving: number | null;
  realityTesting: number | null;
  impulseControl: number | null;
  flexibility: number | null;
  stressTolerance: number | null;
  optimism: number | null;
  // 5 composites
  selfPerceptionComposite: number | null;
  selfExpressionComposite: number | null;
  interpersonalComposite: number | null;
  decisionMakingComposite: number | null;
  stressManagementComposite: number | null;
  // totals
  totalEI: number | null;
  wellBeingIndicator: number | null;
}

export interface ObserverScores {
  selfPerceptionComposite: number | null;
  selfExpressionComposite: number | null;
  interpersonalComposite: number | null;
  decisionMakingComposite: number | null;
  stressManagementComposite: number | null;
}

export interface ParseValidation {
  allScoresPresent: boolean;
  allScoresInRange: boolean;
  missingFields: string[];
  outOfRangeFields: string[];
  requiresManualReview: boolean;
  reviewReasons: string[];
}

export interface ParseResult {
  success: boolean;
  reportType: ReportType;
  scores: EqiScores;
  observerScores?: ObserverScores;
  metadata: {
    assessmentYear: number | null;
    normGroup: string | null;
    reportVersion: string | null;
  };
  validation: ParseValidation;
  rawTextPreview: string;
}

// ── Score field definitions ──────────────────────────────────────────────────

interface ScoreFieldDef {
  key: keyof EqiScores;
  patterns: RegExp[];
}

const SUBSCALE_FIELDS: ScoreFieldDef[] = [
  { key: 'selfRegard',                 patterns: [/self[\s-]?regard/i] },
  { key: 'selfActualization',          patterns: [/self[\s-]?actualization/i] },
  { key: 'emotionalSelfAwareness',     patterns: [/emotional\s*self[\s-]?awareness/i, /\bESA\b/] },
  { key: 'emotionalExpression',        patterns: [/emotional\s*expression/i] },
  { key: 'assertiveness',              patterns: [/assertiveness/i] },
  { key: 'independence',               patterns: [/independence/i] },
  { key: 'interpersonalRelationships', patterns: [/interpersonal\s*(?:relationships?|rel\.?)/i] },
  { key: 'empathy',                    patterns: [/empathy/i] },
  { key: 'socialResponsibility',       patterns: [/social\s*resp(?:onsibility|\.)/i] },
  { key: 'problemSolving',             patterns: [/problem[\s-]?solving/i] },
  { key: 'realityTesting',             patterns: [/reality[\s-]?testing/i] },
  { key: 'impulseControl',             patterns: [/impulse[\s-]?control/i] },
  { key: 'flexibility',                patterns: [/flexibility/i] },
  { key: 'stressTolerance',            patterns: [/stress[\s-]?tolerance/i] },
  { key: 'optimism',                   patterns: [/optimism/i] },
];

const COMPOSITE_FIELDS: ScoreFieldDef[] = [
  { key: 'selfPerceptionComposite',    patterns: [/self[\s-]?perception/i] },
  { key: 'selfExpressionComposite',    patterns: [/self[\s-]?expression/i] },
  { key: 'interpersonalComposite',     patterns: [/interpersonal(?:\s*composite)?$/im, /^interpersonal\b/im] },
  { key: 'decisionMakingComposite',    patterns: [/decision[\s-]?making/i] },
  { key: 'stressManagementComposite',  patterns: [/stress[\s-]?management/i] },
];

const TOTAL_FIELDS: ScoreFieldDef[] = [
  { key: 'totalEI',            patterns: [/total\s*(?:ei|emotional\s*intelligence)/i, /overall\s*ei/i, /ei\s*composite/i] },
  { key: 'wellBeingIndicator', patterns: [/well[\s-]?being(?:\s*indicator)?/i, /\bWBI\b/, /happiness/i] },
];

const ALL_SCORE_FIELDS = [...SUBSCALE_FIELDS, ...COMPOSITE_FIELDS, ...TOTAL_FIELDS];

const COMPOSITE_SUBSCALES: Record<string, (keyof EqiScores)[]> = {
  selfPerceptionComposite:   ['selfRegard', 'selfActualization', 'emotionalSelfAwareness'],
  selfExpressionComposite:   ['emotionalExpression', 'assertiveness', 'independence'],
  interpersonalComposite:    ['interpersonalRelationships', 'empathy', 'socialResponsibility'],
  decisionMakingComposite:   ['problemSolving', 'realityTesting', 'impulseControl'],
  stressManagementComposite: ['flexibility', 'stressTolerance', 'optimism'],
};

const SCORE_MIN = 55;
const SCORE_MAX = 145;
const PLAUSIBILITY_THRESHOLD = 20;

// ── Parser class ─────────────────────────────────────────────────────────────

export class EqiPdfParser {

  async parseFromBuffer(pdfBuffer: Buffer): Promise<ParseResult> {
    const emptyScores = this.emptyScores();
    try {
      const text = await this.extractText(pdfBuffer);
      if (!text || text.length < 100) {
        return this.failResult('PDF text extraction returned insufficient content');
      }

      const reportType = this.detectReportType(text);
      const scores = this.extractScores(text);
      const observerScores = reportType === 'THREESIXTY' ? this.extractObserverScores(text) : undefined;
      const metadata = this.extractMetadata(text);
      const validation = this.validateScores(scores);

      return {
        success: !validation.requiresManualReview || validation.missingFields.length <= 3,
        reportType,
        scores,
        observerScores,
        metadata,
        validation,
        rawTextPreview: text.slice(0, 500),
      };
    } catch (err: any) {
      return this.failResult(err?.message || 'Unknown parsing error');
    }
  }

  async parseFromPath(filePath: string): Promise<ParseResult> {
    try {
      const buffer = fs.readFileSync(filePath);
      return this.parseFromBuffer(buffer);
    } catch (err: any) {
      return this.failResult(`File read error: ${err?.message}`);
    }
  }

  // ── Private methods ───────────────────────────────────────────

  private async extractText(pdfBuffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    return result.text;
  }

  detectReportType(text: string): ReportType {
    // Check the title area — typically first few lines contain "REPORT\nLEADERSHIP" or "REPORT\nWORKPLACE"
    const firstPage = text.split(/--\s*\d+\s*of\s*\d+\s*--/)[0] || text.slice(0, 1500);
    const title = firstPage.toLowerCase();

    // Check for explicit report type labels (these appear as headings, not in body text)
    // "LEADERSHIP" as a standalone line/word near "REPORT" is definitive
    if (/\breport\b[\s\S]{0,30}\bleadership\b|\bleadership\b[\s\S]{0,30}\breport\b/i.test(firstPage.slice(0, 500))) return 'LEADERSHIP';
    if (/\breport\b[\s\S]{0,30}\bworkplace\b|\bworkplace\b[\s\S]{0,30}\breport\b/i.test(firstPage.slice(0, 500))) return 'WORKPLACE';
    if (title.includes('eq-360') || title.includes('eq 360') || /\b360\b/.test(firstPage.slice(0, 500))) return 'THREESIXTY';
    if (/\bgroup\s*report\b/i.test(firstPage.slice(0, 500))) return 'GROUP';

    // Fallback: broader search
    if (title.includes('leadership')) return 'LEADERSHIP';
    if (title.includes('workplace')) return 'WORKPLACE';
    if (title.includes('360')) return 'THREESIXTY';
    if (title.includes('group')) return 'GROUP';
    return 'UNKNOWN';
  }

  extractScores(text: string): EqiScores {
    const scores = this.emptyScores();

    // Strategy 1: Parenthesized scores — "Self-Regard(69)" or "Self-Regard (69)"
    // Most reliable for subscales in Leadership/Workplace reports
    const parenPattern = /([A-Za-z][A-Za-z\s-]+?)\s*\((\d{2,3})\)/g;
    let match;
    while ((match = parenPattern.exec(text)) !== null) {
      const label = match[1].trim();
      const value = parseInt(match[2], 10);
      if (value < 40 || value > 160) continue;
      const field = this.matchLabelToField(label);
      if (field && scores[field] === null) {
        scores[field] = value;
      }
    }

    // Strategy 2: Overview table — sequential numbers after "Total EI" + "Name:"
    // The MHS overview page has 21 consecutive score lines in a fixed order:
    // TotalEI, SelfPerception(C), SelfRegard, SelfActualization, ESA,
    // SelfExpression(C), EmotionalExpression, Assertiveness, Independence,
    // Interpersonal(C), InterpersonalRel, Empathy, SocialResponsibility,
    // DecisionMaking(C), ProblemSolving, RealityTesting, ImpulseControl,
    // StressMgmt(C), Flexibility, StressTolerance, Optimism
    const overviewOrder: (keyof EqiScores)[] = [
      'totalEI',
      'selfPerceptionComposite', 'selfRegard', 'selfActualization', 'emotionalSelfAwareness',
      'selfExpressionComposite', 'emotionalExpression', 'assertiveness', 'independence',
      'interpersonalComposite', 'interpersonalRelationships', 'empathy', 'socialResponsibility',
      'decisionMakingComposite', 'problemSolving', 'realityTesting', 'impulseControl',
      'stressManagementComposite', 'flexibility', 'stressTolerance', 'optimism',
    ];

    const lines = text.split('\n');
    for (let i = 0; i < lines.length - 25; i++) {
      // Look for "Overview" followed by "Total EI" within a few lines
      if (lines[i].trim() === 'Overview' || lines[i].trim() === 'Total EI') {
        // Scan forward for the first run of 21 consecutive number-only lines
        for (let j = i + 1; j < Math.min(i + 30, lines.length - 21); j++) {
          const val = parseInt(lines[j].trim(), 10);
          if (isNaN(val) || val < 40 || val > 160) continue;

          // Check if we have 21 consecutive number lines starting here
          const numberRun: number[] = [];
          for (let k = j; k < j + 25 && numberRun.length < 21; k++) {
            const n = parseInt(lines[k].trim(), 10);
            if (!isNaN(n) && n >= 40 && n <= 160 && lines[k].trim() === String(n)) {
              numberRun.push(n);
            } else if (lines[k].trim().length === 0) {
              continue; // skip blank lines
            } else {
              break;
            }
          }

          if (numberRun.length >= 17) { // at least 17 of 21 = good enough
            for (let idx = 0; idx < Math.min(numberRun.length, overviewOrder.length); idx++) {
              const key = overviewOrder[idx];
              if (scores[key] === null) {
                scores[key] = numberRun[idx];
              }
            }
            break; // found the table, stop searching
          }
        }
        if (scores.totalEI !== null) break; // found it
      }
    }

    // Strategy 3: Pattern matching — "SubscaleName [NUMBER]" or near-label numbers
    // Fallback for any still-missing scores
    for (const field of ALL_SCORE_FIELDS) {
      if (scores[field.key] === null) {
        scores[field.key] = this.findScoreNearLabel(text, field.patterns);
      }
    }

    return scores;
  }

  private extractObserverScores(text: string): ObserverScores {
    // In 360 reports, observer scores appear near "Observer" labels
    const observerSection = this.findSection(text, /observer/i);
    const scores: ObserverScores = {
      selfPerceptionComposite: null,
      selfExpressionComposite: null,
      interpersonalComposite: null,
      decisionMakingComposite: null,
      stressManagementComposite: null,
    };

    if (observerSection) {
      for (const field of COMPOSITE_FIELDS) {
        const key = field.key as keyof ObserverScores;
        if (key in scores) {
          scores[key] = this.findScoreNearLabel(observerSection, field.patterns);
        }
      }
    }

    return scores;
  }

  private extractMetadata(text: string): ParseResult['metadata'] {
    // Year: look for assessment date on the title page (typically "January 14, 2026" or "2026-01-14")
    let assessmentYear: number | null = null;
    // Priority 1: Date near the top of the report (first page, after the name)
    const firstPage = text.split(/--\s*\d+\s*of\s*\d+\s*--/)[0] || text.slice(0, 1000);
    const dateMatch = firstPage.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*(20[12]\d)/i)
      || firstPage.match(/(\b20[2-3]\d)\b/); // prefer recent years (2020+) on title page
    // Priority 2: Near "date" or "assessment" keywords
    const yearMatch = dateMatch
      || text.match(/(?:date|assessment|administered|completed)[:\s]*.*?(\b20[12]\d\b)/i);
    if (yearMatch) {
      assessmentYear = parseInt(yearMatch[1], 10);
    }

    // Norm group
    let normGroup: string | null = null;
    const normMatch = text.match(/norm\s*(?:group|sample)[:\s]*([^\n]+)/i);
    if (normMatch) {
      normGroup = normMatch[1].trim().slice(0, 100);
    }

    // Report version
    let reportVersion: string | null = null;
    const versionMatch = text.match(/(?:version|v\.?)\s*([\d.]+)/i);
    if (versionMatch) {
      reportVersion = versionMatch[1];
    }

    return { assessmentYear, normGroup, reportVersion };
  }

  validateScores(scores: EqiScores): ParseValidation {
    const missingFields: string[] = [];
    const outOfRangeFields: string[] = [];
    const reviewReasons: string[] = [];

    for (const field of ALL_SCORE_FIELDS) {
      const value = scores[field.key];
      if (value === null) {
        missingFields.push(field.key);
      } else if (value < SCORE_MIN || value > SCORE_MAX) {
        outOfRangeFields.push(field.key);
      }
    }

    // Composite plausibility check
    for (const [compositeKey, subscaleKeys] of Object.entries(COMPOSITE_SUBSCALES)) {
      const compositeScore = scores[compositeKey as keyof EqiScores];
      if (compositeScore === null) continue;

      const subscaleValues = subscaleKeys
        .map((k) => scores[k])
        .filter((v): v is number => v !== null);

      if (subscaleValues.length === 3) {
        const mean = Math.round(subscaleValues.reduce((a, b) => a + b, 0) / 3);
        if (Math.abs(compositeScore - mean) > PLAUSIBILITY_THRESHOLD) {
          reviewReasons.push(
            `${compositeKey} (${compositeScore}) differs from subscale mean (${mean}) by more than ${PLAUSIBILITY_THRESHOLD} points`
          );
        }
      }
    }

    if (missingFields.length > 0) {
      reviewReasons.push(`Missing scores: ${missingFields.join(', ')}`);
    }
    if (outOfRangeFields.length > 0) {
      reviewReasons.push(`Out of range (${SCORE_MIN}-${SCORE_MAX}): ${outOfRangeFields.join(', ')}`);
    }

    const allScoresPresent = missingFields.length === 0;
    const allScoresInRange = outOfRangeFields.length === 0;
    const requiresManualReview = !allScoresPresent || !allScoresInRange || reviewReasons.length > 0;

    return { allScoresPresent, allScoresInRange, missingFields, outOfRangeFields, requiresManualReview, reviewReasons };
  }

  // ── Helpers ───────────────────────────────────────────────────

  private matchLabelToField(label: string): keyof EqiScores | null {
    const l = label.toLowerCase().replace(/[-\s]+/g, ' ').trim();
    const map: Record<string, keyof EqiScores> = {
      'self regard': 'selfRegard',
      'self actualization': 'selfActualization',
      'emotional self awareness': 'emotionalSelfAwareness',
      'emotional expression': 'emotionalExpression',
      'assertiveness': 'assertiveness',
      'independence': 'independence',
      'interpersonal relationships': 'interpersonalRelationships',
      'interpersonal': 'interpersonalRelationships',
      'empathy': 'empathy',
      'social responsibility': 'socialResponsibility',
      'problem solving': 'problemSolving',
      'reality testing': 'realityTesting',
      'impulse control': 'impulseControl',
      'flexibility': 'flexibility',
      'stress tolerance': 'stressTolerance',
      'optimism': 'optimism',
      'self perception': 'selfPerceptionComposite',
      'self expression': 'selfExpressionComposite',
      'decision making': 'decisionMakingComposite',
      'stress management': 'stressManagementComposite',
      'total ei': 'totalEI',
      'total emotional intelligence': 'totalEI',
      'well being': 'wellBeingIndicator',
      'well being indicator': 'wellBeingIndicator',
      'happiness': 'wellBeingIndicator',
    };
    for (const [key, field] of Object.entries(map)) {
      if (l.includes(key)) return field;
    }
    return null;
  }

  private findScoreNearLabel(text: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (!match) continue;

      const pos = match.index + match[0].length;
      // Search within 200 chars after the label for a number
      const window = text.slice(pos, pos + 200);

      // Pattern A: number on its own or after whitespace/punctuation
      const numMatch = window.match(/[\s:.\-–—]*(\d{2,3})\b/);
      if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        if (val >= 40 && val <= 160) return val; // loose range for extraction, strict in validation
      }
    }
    return null;
  }

  private findSection(text: string, marker: RegExp): string | null {
    const match = marker.exec(text);
    if (!match) return null;
    return text.slice(match.index, match.index + 3000);
  }

  private emptyScores(): EqiScores {
    return {
      selfRegard: null, selfActualization: null, emotionalSelfAwareness: null,
      emotionalExpression: null, assertiveness: null, independence: null,
      interpersonalRelationships: null, empathy: null, socialResponsibility: null,
      problemSolving: null, realityTesting: null, impulseControl: null,
      flexibility: null, stressTolerance: null, optimism: null,
      selfPerceptionComposite: null, selfExpressionComposite: null,
      interpersonalComposite: null, decisionMakingComposite: null,
      stressManagementComposite: null,
      totalEI: null, wellBeingIndicator: null,
    };
  }

  private failResult(reason: string): ParseResult {
    return {
      success: false,
      reportType: 'UNKNOWN',
      scores: this.emptyScores(),
      metadata: { assessmentYear: null, normGroup: null, reportVersion: null },
      validation: {
        allScoresPresent: false, allScoresInRange: false,
        missingFields: ALL_SCORE_FIELDS.map((f) => f.key),
        outOfRangeFields: [],
        requiresManualReview: true,
        reviewReasons: [reason],
      },
      rawTextPreview: '',
    };
  }
}

export const eqiParser = new EqiPdfParser();
