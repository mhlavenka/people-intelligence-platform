import { Component, Inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';
import { DialogCloseButtonComponent } from '../../../shared/dialog-close-button/dialog-close-button.component';

interface FieldOption { value: string; label: string; checks?: string[]; }
interface Field {
  key: string;
  label: string;
  type: 'text' | 'multiline' | 'number' | 'currency' | 'date' | 'select' | 'radio' | 'checkbox';
  autofill?: string;
  default?: string | number | boolean;
  required?: boolean;
  options?: FieldOption[];
  helpText?: string;
}
interface Section { id: string; label: string; helpText?: string; fields: Field[]; }
interface Manifest { version: number; title: string; sections: Section[]; }

interface DialogData { engagementId: string; }

@Component({
  selector: 'app-contract-generate-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatRadioModule, MatCheckboxModule,
    MatProgressSpinnerModule, TranslateModule, DialogCloseButtonComponent,
  ],
  template: `
    <app-dialog-close-btn (closed)="dialogRef.close()" />
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon>description</mat-icon>
      {{ 'COACHING.contractGenerateTitle' | translate }}
    </h2>

    <mat-dialog-content class="dialog-body">
      @if (loading()) {
        <div class="loading-state"><mat-spinner diameter="32" /></div>
      } @else if (manifest()) {
        <p class="dialog-intro">{{ 'COACHING.contractGenerateIntro' | translate }}</p>

        @for (section of manifest()!.sections; track section.id) {
          <section class="form-section">
            <header class="section-header">
              <h3>{{ section.label }}</h3>
              @if (section.helpText) {
                <p class="section-help">{{ section.helpText }}</p>
              }
            </header>

            <div class="fields-grid">
              @for (field of section.fields; track field.key) {
                <div class="field" [class.field-wide]="isWide(field)">
                  @switch (field.type) {
                    @case ('multiline') {
                      <mat-form-field appearance="outline">
                        <mat-label>{{ field.label }}{{ field.required ? ' *' : '' }}</mat-label>
                        <textarea matInput rows="4" [ngModel]="values()[field.key]"
                                  (ngModelChange)="setValue(field.key, $event)"></textarea>
                        @if (field.helpText) { <mat-hint>{{ field.helpText }}</mat-hint> }
                      </mat-form-field>
                    }
                    @case ('select') {
                      <mat-form-field appearance="outline">
                        <mat-label>{{ field.label }}{{ field.required ? ' *' : '' }}</mat-label>
                        <mat-select [ngModel]="values()[field.key]"
                                    (ngModelChange)="setValue(field.key, $event)">
                          @for (opt of field.options; track opt.value) {
                            <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
                          }
                        </mat-select>
                        @if (field.helpText) { <mat-hint>{{ field.helpText }}</mat-hint> }
                      </mat-form-field>
                    }
                    @case ('radio') {
                      <div class="radio-group">
                        <span class="radio-label">{{ field.label }}{{ field.required ? ' *' : '' }}</span>
                        <mat-radio-group [ngModel]="values()[field.key]"
                                         (ngModelChange)="setValue(field.key, $event)">
                          @for (opt of field.options; track opt.value) {
                            <mat-radio-button [value]="opt.value">{{ opt.label }}</mat-radio-button>
                          }
                        </mat-radio-group>
                        @if (field.helpText) { <small class="radio-help">{{ field.helpText }}</small> }
                      </div>
                    }
                    @case ('checkbox') {
                      <mat-checkbox [ngModel]="values()[field.key]"
                                    (ngModelChange)="setValue(field.key, $event)">
                        {{ field.label }}
                      </mat-checkbox>
                    }
                    @case ('number') {
                      <mat-form-field appearance="outline">
                        <mat-label>{{ field.label }}{{ field.required ? ' *' : '' }}</mat-label>
                        <input matInput type="number" [ngModel]="values()[field.key]"
                               (ngModelChange)="setValue(field.key, $event)" />
                        @if (field.helpText) { <mat-hint>{{ field.helpText }}</mat-hint> }
                      </mat-form-field>
                    }
                    @case ('currency') {
                      <mat-form-field appearance="outline">
                        <mat-label>{{ field.label }}{{ field.required ? ' *' : '' }}</mat-label>
                        <span matTextPrefix>$&nbsp;</span>
                        <input matInput type="number" step="0.01" [ngModel]="values()[field.key]"
                               (ngModelChange)="setValue(field.key, $event)" />
                        @if (field.helpText) { <mat-hint>{{ field.helpText }}</mat-hint> }
                      </mat-form-field>
                    }
                    @default {
                      <mat-form-field appearance="outline">
                        <mat-label>{{ field.label }}{{ field.required ? ' *' : '' }}</mat-label>
                        <input matInput [ngModel]="values()[field.key]"
                               (ngModelChange)="setValue(field.key, $event)" />
                        @if (field.helpText) { <mat-hint>{{ field.helpText }}</mat-hint> }
                      </mat-form-field>
                    }
                  }
                </div>
              }
            </div>
          </section>
        }

        @if (missingRequired().length) {
          <div class="missing-banner">
            <mat-icon>error_outline</mat-icon>
            <span>{{ 'COACHING.contractGenerateMissing' | translate }}: {{ missingRequired().join(', ') }}</span>
          </div>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="generating()">{{ 'COACHING.cancel' | translate }}</button>
      <button mat-flat-button color="primary"
              [disabled]="loading() || generating() || missingRequired().length > 0"
              (click)="generate()">
        @if (generating()) { <mat-spinner diameter="16" class="btn-spinner" /> }
        {{ 'COACHING.contractGenerateAction' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title { display: flex; align-items: center; gap: 8px; mat-icon { color: var(--artes-accent); } }
    .dialog-body { min-width: 720px; max-width: 860px; }
    .dialog-intro { color: #5a6a7e; font-size: 13px; margin: 0 0 16px; }
    .loading-state { display: flex; justify-content: center; padding: 48px 0; }
    .form-section { margin-bottom: 24px; }
    .section-header h3 { margin: 0 0 4px; font-size: 14px; color: var(--artes-primary); text-transform: uppercase; letter-spacing: 0.5px; }
    .section-help { margin: 0 0 12px; color: #7a8595; font-size: 12px; }
    .fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
    .field { display: flex; flex-direction: column; }
    .field-wide { grid-column: 1 / -1; }
    .field mat-form-field { width: 100%; }
    .radio-group { display: flex; flex-direction: column; gap: 6px; padding: 8px 0; }
    .radio-label { font-size: 12px; color: #5a6a7e; font-weight: 500; }
    .radio-help { color: #9aa5b4; font-size: 11px; }
    mat-radio-group { display: flex; gap: 16px; }
    .missing-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; background: #fff5f5; border: 1px solid #f5cdcd; border-radius: 8px;
      color: #c43a3a; font-size: 13px; margin-top: 12px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .btn-spinner { display: inline-block; margin-right: 6px; vertical-align: middle; }
  `],
})
export class ContractGenerateDialogComponent implements OnInit {
  manifest = signal<Manifest | null>(null);
  values = signal<Record<string, any>>({});
  loading = signal(true);
  generating = signal(false);

  /** Wide types span both grid columns. */
  isWide(f: Field): boolean {
    return f.type === 'multiline' || f.type === 'radio';
  }

  missingRequired = computed(() => {
    const m = this.manifest();
    if (!m) return [];
    const v = this.values();
    const missing: string[] = [];
    for (const s of m.sections) {
      for (const f of s.fields) {
        if (!f.required) continue;
        const val = v[f.key];
        if (val == null || val === '') missing.push(f.label);
      }
    }
    return missing;
  });

  constructor(
    public dialogRef: MatDialogRef<ContractGenerateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private api: ApiService,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.api.get<{ manifest: Manifest; autofill: Record<string, string> }>(
      `/coaching/engagements/${this.data.engagementId}/contract/template`,
    ).subscribe({
      next: ({ manifest, autofill }) => {
        this.manifest.set(manifest);
        // Seed each field with its autofill value, falling back to default.
        const seeded: Record<string, any> = {};
        for (const s of manifest.sections) {
          for (const f of s.fields) {
            const auto = autofill[f.key];
            if (auto !== undefined && auto !== '') {
              // Strip leading "$" for currency so the input shows just the number.
              seeded[f.key] = f.type === 'currency' && typeof auto === 'string'
                ? auto.replace(/^\$/, '')
                : auto;
            } else if (f.default !== undefined) {
              seeded[f.key] = f.default;
            }
          }
        }
        this.values.set(seeded);
        this.loading.set(false);
      },
      error: () => {
        this.snackBar.open(
          this.translate.instant('COACHING.contractGenerateLoadError'),
          this.translate.instant('common.dismiss'),
          { duration: 4000 },
        );
        this.dialogRef.close();
      },
    });
  }

  setValue(key: string, value: any): void {
    this.values.update(v => ({ ...v, [key]: value }));
  }

  generate(): void {
    if (this.generating() || this.missingRequired().length) return;
    this.generating.set(true);

    // Format currency values back into "$X.XX" string for the PDF text fields.
    const out: Record<string, any> = {};
    const m = this.manifest();
    for (const s of m?.sections || []) {
      for (const f of s.fields) {
        const val = this.values()[f.key];
        if (val == null || val === '') continue;
        out[f.key] = f.type === 'currency'
          ? `$${Number(val).toFixed(2)}`
          : val;
      }
    }

    this.api.post(`/coaching/engagements/${this.data.engagementId}/contract/generate`, { values: out })
      .subscribe({
        next: () => {
          this.generating.set(false);
          this.snackBar.open(
            this.translate.instant('COACHING.contractGenerateSuccess'),
            this.translate.instant('common.dismiss'),
            { duration: 3000 },
          );
          this.dialogRef.close({ generated: true });
        },
        error: (err: any) => {
          this.generating.set(false);
          this.snackBar.open(
            err?.error?.error || this.translate.instant('COACHING.contractGenerateError'),
            this.translate.instant('common.dismiss'),
            { duration: 5000 },
          );
        },
      });
  }
}
