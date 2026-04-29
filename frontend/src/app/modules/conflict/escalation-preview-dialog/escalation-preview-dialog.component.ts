import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { DialogCloseButtonComponent } from '../../../shared/dialog-close-button/dialog-close-button.component';

export interface EscalationPreviewDialogData {
  analysisName: string;
}

@Component({
  selector: 'app-escalation-preview-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, TranslateModule, DialogCloseButtonComponent,
  ],
  template: `
    <app-dialog-close-btn (closed)="dialogRef.close(false)" />

    <div class="dlg-hero">
      <div class="hero-icon-wrap">
        <mat-icon>auto_awesome</mat-icon>
        <span class="hero-pulse"></span>
      </div>
      <div class="hero-text">
        <span class="hero-eyebrow">{{ 'CONFLICT.escalationPreviewEyebrow' | translate }}</span>
        <h2 mat-dialog-title>{{ 'CONFLICT.escalationPreviewTitle' | translate }}</h2>
        <p class="hero-sub">{{ 'CONFLICT.escalationPreviewSubtitle' | translate }}</p>
      </div>
    </div>

    <mat-dialog-content class="dlg-content">
      <section class="why-section">
        <div class="why-label">
          <mat-icon>warning_amber</mat-icon>
          {{ 'CONFLICT.escalationPreviewWhyLabel' | translate }}
        </div>
        <p>{{ 'CONFLICT.escalationPreviewWhy' | translate }}</p>
      </section>

      <h3 class="steps-title">{{ 'CONFLICT.escalationPreviewWhatTitle' | translate }}</h3>

      <ol class="steps-list">
        <li class="step-row">
          <div class="step-num">1</div>
          <div class="step-body">
            <div class="step-title"><mat-icon>edit_note</mat-icon> {{ 'CONFLICT.escalationPreviewStep1Title' | translate }}</div>
            <p>{{ 'CONFLICT.escalationPreviewStep1Desc' | translate }}</p>
          </div>
        </li>
        <li class="step-row">
          <div class="step-num">2</div>
          <div class="step-body">
            <div class="step-title"><mat-icon>alt_route</mat-icon> {{ 'CONFLICT.escalationPreviewStep2Title' | translate }}</div>
            <p>{{ 'CONFLICT.escalationPreviewStep2Desc' | translate }}</p>
          </div>
        </li>
        <li class="step-row">
          <div class="step-num">3</div>
          <div class="step-body">
            <div class="step-title"><mat-icon>verified_user</mat-icon> {{ 'CONFLICT.escalationPreviewStep3Title' | translate }}</div>
            <p>{{ 'CONFLICT.escalationPreviewStep3Desc' | translate }}</p>
          </div>
        </li>
        <li class="step-row">
          <div class="step-num">4</div>
          <div class="step-body">
            <div class="step-title"><mat-icon>handshake</mat-icon> {{ 'CONFLICT.escalationPreviewStep4Title' | translate }}</div>
            <p>{{ 'CONFLICT.escalationPreviewStep4Desc' | translate }}</p>
          </div>
        </li>
      </ol>

      <section class="phases-section">
        <div class="why-label">
          <mat-icon>timeline</mat-icon>
          {{ 'CONFLICT.escalationPreviewPhasesLabel' | translate }}
        </div>
        <ul class="phases-list">
          <li><strong>{{ 'CONFLICT.escalationPreviewPhase1Name' | translate }}</strong> — {{ 'CONFLICT.escalationPreviewPhase1Desc' | translate }}</li>
          <li><strong>{{ 'CONFLICT.escalationPreviewPhase2Name' | translate }}</strong> — {{ 'CONFLICT.escalationPreviewPhase2Desc' | translate }}</li>
          <li><strong>{{ 'CONFLICT.escalationPreviewPhase3Name' | translate }}</strong> — {{ 'CONFLICT.escalationPreviewPhase3Desc' | translate }}</li>
        </ul>
      </section>

      <div class="current-note">
        <mat-icon>info</mat-icon>
        <span>{{ 'CONFLICT.escalationPreviewCurrentNote' | translate }}</span>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dlg-actions">
      <button mat-button (click)="dialogRef.close(false)" [disabled]="confirming()">
        {{ 'COMMON.cancel' | translate }}
      </button>
      <button mat-flat-button color="warn" (click)="confirm()" [disabled]="confirming()">
        @if (confirming()) { <mat-spinner diameter="18" /> }
        <mat-icon>escalator_warning</mat-icon>
        {{ 'CONFLICT.escalationPreviewConfirm' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; }

    .dlg-hero {
      display: flex; gap: 14px; align-items: flex-start;
      padding: 24px 28px 16px;
      background: linear-gradient(135deg, rgba(232,108,58,0.10) 0%, rgba(58,159,214,0.08) 100%);
      border-bottom: 1px solid rgba(232,108,58,0.2);
    }
    .hero-icon-wrap {
      position: relative; flex-shrink: 0;
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #e86c3a, #f0a500);
      box-shadow: 0 4px 14px -4px rgba(232,108,58,0.55);
      mat-icon { color: white; font-size: 24px; width: 24px; height: 24px; }
    }
    .hero-pulse {
      position: absolute; inset: -4px; border-radius: 14px;
      border: 2px solid rgba(232,108,58,0.35);
      animation: hero-pulse 2.4s ease-out infinite;
    }
    @keyframes hero-pulse {
      0%   { transform: scale(1);   opacity: 0.8; }
      100% { transform: scale(1.18); opacity: 0; }
    }
    .hero-text { flex: 1; min-width: 0; }
    .hero-eyebrow {
      display: inline-block;
      font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.7px;
      color: #c04a14; background: rgba(232,108,58,0.12);
      padding: 3px 10px; border-radius: 999px; margin-bottom: 4px;
    }
    h2 { margin: 0 !important; font-size: 19px; color: var(--artes-primary); font-weight: 700; line-height: 1.25; }
    .hero-sub { margin: 4px 0 0; font-size: 13px; color: #5a6a7e; line-height: 1.5; }

    .dlg-content {
      padding: 18px 28px 12px !important;
      max-width: 720px; min-width: 540px;
    }

    .why-section, .phases-section {
      background: #f8fafc; border: 1px solid #eef2f7; border-radius: 10px;
      padding: 12px 16px; margin-bottom: 16px;
      p { margin: 6px 0 0; font-size: 13px; color: #46546b; line-height: 1.55; }
    }
    .why-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
      color: #5a6a7e;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #e86c3a; }
    }

    .steps-title {
      font-size: 14px; font-weight: 700; color: var(--artes-primary);
      margin: 4px 0 12px;
    }

    .steps-list {
      list-style: none; padding: 0; margin: 0 0 16px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .step-row {
      display: flex; gap: 14px; align-items: flex-start;
      padding: 12px 14px;
      background: white; border: 1px solid #e8edf4; border-radius: 10px;
    }
    .step-num {
      flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      color: white; font-size: 13px; font-weight: 700;
    }
    .step-body { flex: 1; }
    .step-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 13.5px; font-weight: 600; color: var(--artes-primary);
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--artes-accent); }
    }
    .step-body p { margin: 4px 0 0; font-size: 12.5px; color: #5a6a7e; line-height: 1.5; }

    .phases-list {
      list-style: none; padding: 0; margin: 8px 0 0;
      display: flex; flex-direction: column; gap: 6px;
      li { font-size: 12.5px; color: #46546b; line-height: 1.5; }
      strong { color: var(--artes-primary); }
    }

    .current-note {
      display: flex; align-items: flex-start; gap: 8px;
      background: rgba(58,159,214,0.08); border: 1px solid rgba(58,159,214,0.20);
      border-radius: 8px; padding: 10px 14px;
      font-size: 12.5px; color: #2080b0; line-height: 1.5;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; color: var(--artes-accent); }
    }

    .dlg-actions {
      padding: 12px 24px !important; border-top: 1px solid #edf1f6;
    }
  `],
})
export class EscalationPreviewDialogComponent {
  dialogRef = inject(MatDialogRef<EscalationPreviewDialogComponent, boolean>);
  data = inject<EscalationPreviewDialogData>(MAT_DIALOG_DATA);

  confirming = signal(false);

  confirm(): void {
    this.confirming.set(true);
    this.dialogRef.close(true);
  }
}
