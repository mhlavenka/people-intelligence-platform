import { Component, Inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';

interface DialogData {
  engagementId: string;
  contractFilename?: string;
}

@Component({
  selector: 'app-contract-accept-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatCheckboxModule, MatProgressSpinnerModule, TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>description</mat-icon>
      {{ 'COACHING.contractAcceptTitle' | translate }}
    </h2>

    <mat-dialog-content class="dialog-body">
      <div class="contract-meta">
        <mat-icon>picture_as_pdf</mat-icon>
        <div>
          <span class="filename">{{ data.contractFilename || 'contract.pdf' }}</span>
          @if (signedUrl()) {
            <a [href]="signedUrl()!" target="_blank" rel="noopener" class="open-link">
              <mat-icon>open_in_new</mat-icon> {{ 'COACHING.contractOpenInTab' | translate }}
            </a>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="frame-loading"><mat-spinner diameter="32" /></div>
      } @else if (frameSrc()) {
        <iframe class="pdf-frame" [src]="frameSrc()!"></iframe>
      } @else {
        <div class="frame-error">
          <mat-icon>error_outline</mat-icon>
          <span>{{ 'COACHING.contractLoadError' | translate }}</span>
        </div>
      }

      <div class="ack-block">
        <label class="ack-row">
          <mat-checkbox [(ngModel)]="acknowledged" color="primary" />
          <span class="ack-text">{{ 'COACHING.contractAcceptAck' | translate }}</span>
        </label>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">{{ 'COMMON.cancel' | translate }}</button>
      <button mat-flat-button color="primary"
              (click)="accept()"
              [disabled]="!acknowledged || saving()">
        @if (saving()) { <mat-icon>hourglass_empty</mat-icon> }
        {{ 'COACHING.contractAcceptAction' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-body { min-width: 640px; max-height: 70vh; padding-top: 18px !important; display: flex; flex-direction: column; gap: 12px; }
    h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }

    .contract-meta {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; background: #f8fafc; border: 1px solid #e6ecf2; border-radius: 8px;
      mat-icon { color: #c43a3a; font-size: 24px; width: 24px; height: 24px; }
      .filename { display: block; font-weight: 600; color: #1B2A47; font-size: 13px; }
      .open-link {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 12px; color: #3A9FD6; text-decoration: none; margin-top: 2px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; color: #3A9FD6; }
      }
      .open-link:hover { text-decoration: underline; }
    }

    .pdf-frame {
      width: 100%; height: 420px; border: 1px solid #d6dde6; border-radius: 6px;
      background: #fafbfd;
    }
    .frame-loading, .frame-error {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; height: 420px;
      background: #fafbfd; border: 1px solid #d6dde6; border-radius: 6px;
      color: #5a6a7e;
    }
    .frame-error mat-icon { color: #c43a3a; }

    .ack-block {
      padding: 14px 16px; background: #fff8f0; border: 1px solid #f0d4a0; border-radius: 8px;
    }
    .ack-row {
      display: flex; align-items: flex-start; gap: 10px; cursor: pointer;
      .ack-text { font-size: 13px; color: #1B2A47; line-height: 1.45; }
    }
  `],
})
export class ContractAcceptDialogComponent implements OnInit {
  acknowledged = false;
  saving = signal(false);
  loading = signal(true);
  signedUrl = signal<string | null>(null);
  frameSrc = signal<SafeResourceUrl | null>(null);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private dialogRef: MatDialogRef<ContractAcceptDialogComponent, boolean>,
    private api: ApiService,
    private snack: MatSnackBar,
    private translate: TranslateService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    // Signed URLs expire in 5 minutes — comfortable for one viewing session.
    this.api.get<{ url: string; expiresAt: string }>(
      `/coaching/engagements/${this.data.engagementId}/contract/url`,
    ).subscribe({
      next: (res) => {
        this.signedUrl.set(res.url);
        // bypassSecurityTrustResourceUrl is required because Angular blocks
        // arbitrary URLs in iframe[src]. Source is our own backend's signed
        // S3 URL, which we trust.
        this.frameSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(res.url));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  accept(): void {
    if (!this.acknowledged || this.saving()) return;
    this.saving.set(true);
    this.api.post(`/coaching/engagements/${this.data.engagementId}/contract/accept`, {}).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open(
          this.translate.instant('COACHING.contractAcceptSuccess'),
          this.translate.instant('COMMON.ok'),
          { duration: 3000 },
        );
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.snack.open(
          err?.error?.error || this.translate.instant('COACHING.contractAcceptError'),
          this.translate.instant('COMMON.dismiss'),
          { duration: 4000 },
        );
      },
    });
  }

  close(): void { this.dialogRef.close(false); }
}
