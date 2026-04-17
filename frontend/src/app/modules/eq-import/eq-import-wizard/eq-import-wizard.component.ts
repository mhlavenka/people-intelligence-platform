import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/api.service';

interface ParseResult {
  success: boolean;
  reportType: string;
  scores: Record<string, number | null>;
  metadata: { assessmentYear: number | null; normGroup: string | null; reportVersion: string | null };
  validation: {
    allScoresPresent: boolean; allScoresInRange: boolean;
    missingFields: string[]; outOfRangeFields: string[];
    requiresManualReview: boolean; reviewReasons: string[];
  };
}

interface ImportResult {
  success: boolean;
  importId: string;
  scoreId?: string;
  normRecordId?: string;
  privacyMode: string;
  validationPassed: boolean;
  requiresManualReview: boolean;
  reviewReasons: string[];
  errors: string[];
}

const INDUSTRY_OPTIONS = [
  'Transportation & Logistics', 'Financial Services', 'Healthcare', 'Technology',
  'Professional Services', 'Manufacturing', 'Education', 'Government / Public Sector',
  'Not-for-Profit', 'Retail', 'Energy', 'Construction', 'Legal', 'Other',
];

const ROLE_LEVELS = [
  { value: 'individual_contributor', label: 'Individual Contributor' },
  { value: 'manager',               label: 'Manager' },
  { value: 'senior_leader',         label: 'Senior Leader' },
  { value: 'executive',             label: 'Executive' },
  { value: 'c_suite',               label: 'C-Suite' },
  { value: 'board',                 label: 'Board' },
];

const NORM_GROUPS = [
  'General Population', 'Professional Global', 'Healthcare', 'Education', 'Financial Services', 'Other',
];

const SUBSCALE_LABELS: Record<string, string> = {
  selfRegard: 'Self-Regard', selfActualization: 'Self-Actualization',
  emotionalSelfAwareness: 'Emotional Self-Awareness', emotionalExpression: 'Emotional Expression',
  assertiveness: 'Assertiveness', independence: 'Independence',
  interpersonalRelationships: 'Interpersonal Relationships', empathy: 'Empathy',
  socialResponsibility: 'Social Responsibility', problemSolving: 'Problem Solving',
  realityTesting: 'Reality Testing', impulseControl: 'Impulse Control',
  flexibility: 'Flexibility', stressTolerance: 'Stress Tolerance', optimism: 'Optimism',
  selfPerceptionComposite: 'Self-Perception (C)', selfExpressionComposite: 'Self-Expression (C)',
  interpersonalComposite: 'Interpersonal (C)', decisionMakingComposite: 'Decision Making (C)',
  stressManagementComposite: 'Stress Management (C)',
  totalEI: 'Total EI', wellBeingIndicator: 'Well-Being',
};

@Component({
  selector: 'app-eq-import-wizard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatStepperModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatCheckboxModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatDividerModule, MatChipsModule, MatDatepickerModule,
    MatNativeDateModule, MatSnackBarModule,
  ],
  template: `
    <div class="import-page">
      <div class="page-header">
        <div>
          <h1>Import EQi 2.0 Assessment</h1>
          <p>Import MHS EQi 2.0 PDF reports with full privacy controls</p>
        </div>
      </div>

      <mat-stepper [linear]="true" #stepper>

        <!-- Step 1: Privacy Mode -->
        <mat-step [completed]="!!privacyMode()">
          <ng-template matStepLabel>Privacy Mode</ng-template>
          <div class="step-content">
            <p class="step-desc">Select how client data should be stored. This cannot be changed after import.</p>

            <div class="mode-cards">
              <div class="mode-card" [class.selected]="privacyMode() === 'ANONYMIZED'" [class.green]="true"
                   (click)="privacyMode.set('ANONYMIZED')">
                <mat-icon>shield</mat-icon>
                <h3>Anonymized</h3>
                <span class="mode-default">Default — Recommended</span>
                <p>Scores + context only. Zero identifying information. Contributes to norm database.</p>
              </div>
              <div class="mode-card" [class.selected]="privacyMode() === 'PSEUDONYMIZED'" [class.amber]="true"
                   (click)="privacyMode.set('PSEUDONYMIZED')">
                <mat-icon>badge</mat-icon>
                <h3>Pseudonymized</h3>
                <p>Coded profile. You hold the offline mapping key. Suitable for recent clients.</p>
              </div>
              <div class="mode-card" [class.selected]="privacyMode() === 'IDENTIFIED'" [class.blue]="true"
                   (click)="privacyMode.set('IDENTIFIED')">
                <mat-icon>person</mat-icon>
                <h3>Identified</h3>
                <p>Full client profile stored. Requires explicit written consent.</p>
              </div>
            </div>

            <!-- Mode-specific fields -->
            @if (privacyMode() === 'IDENTIFIED') {
              <div class="mode-fields">
                <div class="form-row">
                  <mat-form-field appearance="outline"><mat-label>Client Name</mat-label>
                    <input matInput [(ngModel)]="clientName" required /></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Client Email</mat-label>
                    <input matInput [(ngModel)]="clientEmail" type="email" required /></mat-form-field>
                </div>
                <div class="form-row">
                  <mat-form-field appearance="outline"><mat-label>Role / Title</mat-label>
                    <input matInput [(ngModel)]="clientRole" /></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Organization</mat-label>
                    <input matInput [(ngModel)]="clientOrg" /></mat-form-field>
                </div>
                <div class="consent-box">
                  <mat-checkbox [(ngModel)]="consentObtained" color="warn">
                    I confirm that <strong>{{ clientName || 'the client' }}</strong> has given explicit written consent
                    for their EQi assessment data to be stored in this platform.
                  </mat-checkbox>
                  <div class="form-row" style="margin-top: 8px">
                    <mat-form-field appearance="outline"><mat-label>Consent Date</mat-label>
                      <input matInput [matDatepicker]="consentPicker" [(ngModel)]="consentDate" />
                      <mat-datepicker-toggle matIconSuffix [for]="consentPicker" /><mat-datepicker #consentPicker />
                    </mat-form-field>
                    <mat-form-field appearance="outline"><mat-label>Consent Method</mat-label>
                      <mat-select [(ngModel)]="consentMethod">
                        <mat-option value="written">Written</mat-option>
                        <mat-option value="verbal">Verbal</mat-option>
                        <mat-option value="email">Email</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>
                </div>
              </div>
            }

            @if (privacyMode() === 'PSEUDONYMIZED') {
              <div class="mode-fields">
                <div class="code-display">
                  <mat-icon>badge</mat-icon>
                  <span>Client Code: <strong>{{ clientCode }}</strong></span>
                </div>
                <mat-checkbox [(ngModel)]="offlineMappingConfirmed" color="primary">
                  I have recorded the mapping between this code and the real client in my secure offline records.
                </mat-checkbox>
              </div>
            }

            <!-- Shared fields -->
            <div class="shared-fields">
              <div class="form-row">
                <mat-form-field appearance="outline"><mat-label>Industry Sector</mat-label>
                  <mat-select [(ngModel)]="industrySector">
                    @for (ind of industries; track ind) { <mat-option [value]="ind">{{ ind }}</mat-option> }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Role Level</mat-label>
                  <mat-select [(ngModel)]="roleLevel">
                    @for (r of roleLevels; track r.value) { <mat-option [value]="r.value">{{ r.label }}</mat-option> }
                  </mat-select>
                </mat-form-field>
              </div>
            </div>

            <div class="step-actions">
              <button mat-raised-button color="primary" matStepperNext [disabled]="!canProceedStep1()">
                Next <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </div>
        </mat-step>

        <!-- Step 2: Upload & Parse -->
        <mat-step [completed]="!!parseResult()">
          <ng-template matStepLabel>Upload PDF</ng-template>
          <div class="step-content">
            <div class="upload-zone" (dragover)="$event.preventDefault()" (drop)="onFileDrop($event)"
                 (click)="fileInput.click()">
              <input #fileInput type="file" accept="application/pdf" (change)="onFileSelect($event)" style="display:none" />
              <mat-icon class="upload-icon">cloud_upload</mat-icon>
              <p>Drag & drop a PDF here, or click to browse</p>
              <span>MHS EQi 2.0 reports only · Max 10 MB</span>
            </div>

            @if (parsing()) {
              <div class="parse-status"><mat-spinner diameter="28" /><span>Reading assessment report...</span></div>
            }

            @if (parseResult()) {
              <div class="parse-card" [class.success]="parseResult()!.success" [class.warning]="parseResult()!.validation.requiresManualReview && parseResult()!.success" [class.error]="!parseResult()!.success">
                <div class="parse-header">
                  <mat-icon>{{ parseResult()!.success ? (parseResult()!.validation.requiresManualReview ? 'warning_amber' : 'check_circle') : 'error' }}</mat-icon>
                  <span>{{ parseResult()!.success ? (parseResult()!.validation.requiresManualReview ? 'Review required' : 'Report parsed successfully') : 'Could not read report' }}</span>
                </div>
                <div class="parse-meta">
                  <span>Type: <strong>{{ parseResult()!.reportType }}</strong></span>
                  <span>Year: <strong>{{ parseResult()!.metadata.assessmentYear || 'Not detected' }}</strong></span>
                  <span>Total EI: <strong>{{ parseResult()!.scores['totalEI'] ?? '—' }}</strong></span>
                  <span>Subscales: <strong>{{ detectedCount() }} / 15</strong></span>
                </div>
                @if (parseResult()!.validation.reviewReasons.length) {
                  <div class="parse-issues">
                    @for (r of parseResult()!.validation.reviewReasons; track r) {
                      <div class="issue-item"><mat-icon>info</mat-icon>{{ r }}</div>
                    }
                  </div>
                }
                <!-- Score table -->
                <div class="score-table">
                  @for (entry of scoreEntries(); track entry[0]) {
                    <div class="score-row" [class.missing]="entry[1] === null">
                      <span class="score-label">{{ subscaleLabel(entry[0]) }}</span>
                      <span class="score-value">{{ entry[1] ?? '— Not detected' }}</span>
                    </div>
                  }
                </div>

                @if (!parseResult()!.metadata.assessmentYear) {
                  <mat-form-field appearance="outline" class="year-override">
                    <mat-label>Assessment Year (required)</mat-label>
                    <input matInput type="number" [(ngModel)]="yearOverride" min="2000" max="2030" />
                  </mat-form-field>
                }
              </div>
            }

            <div class="step-actions">
              <button mat-button matStepperPrevious>Back</button>
              <button mat-raised-button color="primary" matStepperNext
                      [disabled]="!parseResult()?.success">
                Next <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </div>
        </mat-step>

        <!-- Step 3: Confirm & Import -->
        <mat-step>
          <ng-template matStepLabel>Confirm</ng-template>
          <div class="step-content">
            @if (!importResult()) {
              <div class="confirm-card">
                <h3>Import Summary</h3>
                <div class="confirm-row"><span>Privacy Mode</span><strong>{{ privacyMode() }}</strong></div>
                <div class="confirm-row"><span>Report Type</span><strong>{{ parseResult()?.reportType }}</strong></div>
                <div class="confirm-row"><span>Total EI</span><strong>{{ parseResult()?.scores?.['totalEI'] ?? '—' }}</strong></div>
                <div class="confirm-row"><span>Year</span><strong>{{ parseResult()?.metadata?.assessmentYear || yearOverride || '—' }}</strong></div>
                <div class="confirm-row"><span>Industry</span><strong>{{ industrySector || '—' }}</strong></div>
                <div class="confirm-row"><span>Norm Database</span><strong>{{ privacyMode() === 'ANONYMIZED' ? 'Will contribute' : 'Optional' }}</strong></div>

                <mat-divider style="margin: 16px 0" />

                <div class="step-actions">
                  <button mat-button matStepperPrevious>Back</button>
                  <button mat-raised-button color="primary" (click)="doImport()" [disabled]="importing()">
                    @if (importing()) { <mat-spinner diameter="18" /> }
                    @else { <mat-icon>file_download</mat-icon> }
                    Import Assessment
                  </button>
                </div>
              </div>
            } @else {
              <!-- Result -->
              <div class="result-card" [class.success]="importResult()!.success" [class.error]="!importResult()!.success">
                <mat-icon class="result-icon">{{ importResult()!.success ? 'check_circle' : 'error' }}</mat-icon>
                <h3>{{ importResult()!.success ? 'Assessment imported successfully' : 'Import failed' }}</h3>
                @if (importResult()!.success) {
                  <p>Import ID: <code>{{ importResult()!.importId }}</code></p>
                }
                @if (importResult()!.errors.length) {
                  @for (err of importResult()!.errors; track err) {
                    <div class="result-error">{{ err }}</div>
                  }
                }
                <div class="step-actions">
                  <button mat-raised-button color="primary" (click)="reset()">
                    <mat-icon>add</mat-icon> Import Another
                  </button>
                </div>
              </div>
            }
          </div>
        </mat-step>

      </mat-stepper>
    </div>
  `,
  styles: [`
    .import-page { padding: 32px; max-width: 900px; }
    .step-content { padding: 20px 0; }
    .step-desc { font-size: 14px; color: #5a6a7e; margin: 0 0 20px; }
    .step-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

    .mode-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
    .mode-card {
      padding: 20px; border-radius: 14px; border: 2px solid #e8edf4; cursor: pointer;
      text-align: center; transition: all 0.15s;
      mat-icon { font-size: 32px; width: 32px; height: 32px; margin-bottom: 8px; }
      h3 { font-size: 15px; margin: 0 0 4px; color: var(--artes-primary); }
      p { font-size: 12px; color: #5a6a7e; margin: 0; line-height: 1.4; }
      .mode-default { font-size: 10px; color: #27C4A0; font-weight: 700; text-transform: uppercase; }
      &.selected { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
      &.green.selected { border-color: #27C4A0; background: #f0fdf4; mat-icon { color: #27C4A0; } }
      &.amber.selected { border-color: #f0a500; background: #FFFBEB; mat-icon { color: #f0a500; } }
      &.blue.selected  { border-color: var(--artes-accent); background: var(--artes-bg); mat-icon { color: var(--artes-accent); } }
      &:hover { border-color: #c5d0db; }
    }

    .mode-fields, .shared-fields { margin-top: 16px; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; mat-form-field { flex: 1; min-width: 200px; } }
    .consent-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px; margin-top: 12px; }
    .code-display {
      display: flex; align-items: center; gap: 8px; padding: 12px 16px;
      background: #FFFBEB; border-radius: 8px; margin-bottom: 12px; font-size: 14px;
      mat-icon { color: #f0a500; }
    }

    .upload-zone {
      border: 2px dashed #c5d0db; border-radius: 14px; padding: 48px; text-align: center;
      cursor: pointer; transition: border-color 0.15s;
      &:hover { border-color: var(--artes-accent); }
      .upload-icon { font-size: 48px; width: 48px; height: 48px; color: #c5d0db; }
      p { color: #5a6a7e; margin: 8px 0 4px; }
      span { font-size: 12px; color: #9aa5b4; }
    }

    .parse-status { display: flex; align-items: center; gap: 12px; padding: 20px; justify-content: center; color: #5a6a7e; }

    .parse-card {
      border-radius: 12px; padding: 20px; margin-top: 16px; border: 1px solid #e8edf4;
      &.success { border-color: #27C4A0; .parse-header mat-icon { color: #27C4A0; } }
      &.warning { border-color: #f0a500; .parse-header mat-icon { color: #f0a500; } }
      &.error   { border-color: #e53e3e; .parse-header mat-icon { color: #e53e3e; } }
    }
    .parse-header { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--artes-primary); margin-bottom: 12px; }
    .parse-meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: #5a6a7e; margin-bottom: 12px; }
    .parse-issues { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .issue-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #b07800; mat-icon { font-size: 16px; width: 16px; height: 16px; color: #f0a500; } }

    .score-table { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .score-row { display: flex; justify-content: space-between; padding: 4px 8px; border-radius: 4px; font-size: 12px; &.missing { background: #FFF8E6; } }
    .score-label { color: #5a6a7e; }
    .score-value { font-weight: 600; color: var(--artes-primary); .missing & { color: #f0a500; } }
    .year-override { margin-top: 12px; width: 200px; }

    .confirm-card { background: white; border-radius: 14px; padding: 24px; border: 1px solid #e8edf4; }
    .confirm-card h3 { font-size: 16px; color: var(--artes-primary); margin: 0 0 16px; }
    .confirm-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f4f8; font-size: 14px; span { color: #5a6a7e; } strong { color: var(--artes-primary); } }

    .result-card { text-align: center; padding: 48px; border-radius: 14px; border: 1px solid #e8edf4; }
    .result-icon { font-size: 56px; width: 56px; height: 56px; margin-bottom: 16px; }
    .result-card.success { .result-icon { color: #27C4A0; } }
    .result-card.error { .result-icon { color: #e53e3e; } }
    .result-card h3 { font-size: 20px; color: var(--artes-primary); margin: 0 0 8px; }
    .result-card code { background: #f0f4f8; padding: 4px 10px; border-radius: 4px; font-size: 12px; }
    .result-error { color: #e53e3e; font-size: 13px; margin-top: 8px; }

    @media (max-width: 768px) {
      .mode-cards { grid-template-columns: 1fr; }
      .score-table { grid-template-columns: 1fr; }
    }
  `],
})
export class EqImportWizardComponent {
  privacyMode = signal<string | null>(null);
  parseResult = signal<ParseResult | null>(null);
  importResult = signal<ImportResult | null>(null);
  parsing = signal(false);
  importing = signal(false);

  // Mode A fields
  clientName = '';
  clientEmail = '';
  clientRole = '';
  clientOrg = '';
  consentObtained = false;
  consentDate: Date | null = null;
  consentMethod = 'written';

  // Mode B fields
  clientCode = `CLIENT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
  offlineMappingConfirmed = false;

  // Shared fields
  industrySector = '';
  roleLevel = '';
  yearOverride: number | null = null;

  industries = INDUSTRY_OPTIONS;
  roleLevels = ROLE_LEVELS;
  normGroups = NORM_GROUPS;

  private selectedFile: File | null = null;

  constructor(private api: ApiService, private snack: MatSnackBar) {}

  canProceedStep1(): boolean {
    if (!this.privacyMode()) return false;
    if (this.privacyMode() === 'IDENTIFIED') return !!this.clientName && !!this.clientEmail && this.consentObtained;
    if (this.privacyMode() === 'PSEUDONYMIZED') return this.offlineMappingConfirmed;
    return true;
  }

  detectedCount(): number {
    if (!this.parseResult()) return 0;
    const scores = this.parseResult()!.scores;
    const subscaleKeys = ['selfRegard','selfActualization','emotionalSelfAwareness','emotionalExpression',
      'assertiveness','independence','interpersonalRelationships','empathy','socialResponsibility',
      'problemSolving','realityTesting','impulseControl','flexibility','stressTolerance','optimism'];
    return subscaleKeys.filter((k) => scores[k] !== null).length;
  }

  scoreEntries(): [string, number | null][] {
    if (!this.parseResult()) return [];
    return Object.entries(this.parseResult()!.scores);
  }

  subscaleLabel(key: string): string { return SUBSCALE_LABELS[key] || key; }

  onFileSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadAndParse(file);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadAndParse(file);
  }

  private uploadAndParse(file: File): void {
    if (file.type !== 'application/pdf') { this.snack.open('Only PDF files accepted', 'OK', { duration: 3000 }); return; }
    if (file.size > 10 * 1024 * 1024) { this.snack.open('File too large (max 10 MB)', 'OK', { duration: 3000 }); return; }

    this.selectedFile = file;
    this.parsing.set(true);
    this.parseResult.set(null);

    const formData = new FormData();
    formData.append('pdf', file);

    this.api.post<ParseResult>('/eq/import/parse', formData).subscribe({
      next: (result) => { this.parseResult.set(result); this.parsing.set(false); },
      error: () => { this.parsing.set(false); this.snack.open('Failed to parse PDF', 'Dismiss', { duration: 4000 }); },
    });
  }

  doImport(): void {
    if (!this.selectedFile || !this.parseResult()) return;
    this.importing.set(true);

    const options: Record<string, unknown> = {
      privacyMode: this.privacyMode(),
      industrySector: this.industrySector,
      roleLevel: this.roleLevel,
      assessmentYear: this.parseResult()!.metadata.assessmentYear || this.yearOverride,
      addToNormDatabase: this.privacyMode() === 'ANONYMIZED',
    };

    if (this.privacyMode() === 'IDENTIFIED') {
      Object.assign(options, {
        clientName: this.clientName, clientEmail: this.clientEmail,
        clientRole: this.clientRole, clientOrganization: this.clientOrg,
        consentObtained: this.consentObtained, consentDate: this.consentDate,
        consentMethod: this.consentMethod,
      });
    }
    if (this.privacyMode() === 'PSEUDONYMIZED') {
      options['clientCode'] = this.clientCode;
    }

    const formData = new FormData();
    formData.append('pdf', this.selectedFile);
    formData.append('options', JSON.stringify(options));

    this.api.post<ImportResult>('/eq/import/single', formData).subscribe({
      next: (result) => { this.importResult.set(result); this.importing.set(false); },
      error: (err) => {
        this.importing.set(false);
        this.snack.open(err.error?.error || 'Import failed', 'Dismiss', { duration: 4000 });
      },
    });
  }

  reset(): void {
    this.privacyMode.set(null);
    this.parseResult.set(null);
    this.importResult.set(null);
    this.selectedFile = null;
    this.clientName = ''; this.clientEmail = ''; this.clientRole = ''; this.clientOrg = '';
    this.consentObtained = false; this.consentDate = null;
    this.clientCode = `CLIENT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
    this.offlineMappingConfirmed = false;
    this.industrySector = ''; this.roleLevel = ''; this.yearOverride = null;
  }
}
