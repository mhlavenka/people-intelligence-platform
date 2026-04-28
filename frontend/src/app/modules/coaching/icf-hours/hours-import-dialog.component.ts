import { Component, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface ImportRowResult {
  rowNumber: number;
  raw: Record<string, string>;
  parsed?: {
    date?: string;
    hours?: number;
    category?: string;
    clientType?: string;
    paidStatus?: string;
    clientName?: string;
  };
  errors: string[];
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportRowResult[];
  committed: boolean;
}

@Component({
  selector: 'app-hours-import-dialog',
  standalone: true,
  imports: [
    CommonModule, DatePipe, DecimalPipe, MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>upload_file</mat-icon>
      {{ 'COACHING.icfImportTitle' | translate }}
    </h2>

    <mat-dialog-content class="dialog-body">
      @if (!preview()) {
        <p class="hint">{{ 'COACHING.icfImportHint' | translate }}</p>
        <ul class="format-list">
          <li><strong>date</strong>, <strong>hours</strong>, <strong>category</strong> {{ 'COACHING.icfImportRequired' | translate }}</li>
          <li>category: <code>session</code> | <code>mentor_coaching_received</code> | <code>cce</code></li>
          <li>client_type: <code>individual</code> | <code>team</code> | <code>group</code></li>
          <li>paid_status: <code>paid</code> | <code>pro_bono</code></li>
          <li>{{ 'COACHING.icfImportOptional' | translate }}: client_name, client_organization, client_email, mentor_coach_name, mentor_coach_icf_credential, cce_category, cce_provider, cce_certificate_url, notes</li>
        </ul>

        <div class="upload-zone" [class.has-file]="!!file()">
          @if (!file()) {
            <mat-icon>cloud_upload</mat-icon>
            <p>{{ 'COACHING.icfImportDropHint' | translate }}</p>
            <button mat-stroked-button (click)="fileInput.click()">
              {{ 'COACHING.icfImportChooseFile' | translate }}
            </button>
          } @else {
            <mat-icon>description</mat-icon>
            <p class="filename">{{ file()!.name }}</p>
            <p class="filesize">{{ (file()!.size / 1024) | number:'1.0-1' }} KB</p>
            <div class="file-actions">
              <button mat-stroked-button (click)="fileInput.click()">
                {{ 'COACHING.icfImportChangeFile' | translate }}
              </button>
              <button mat-flat-button color="primary" (click)="runDryRun()" [disabled]="uploading()">
                @if (uploading()) { <mat-icon>hourglass_empty</mat-icon> }
                {{ 'COACHING.icfImportPreview' | translate }}
              </button>
            </div>
          }
          <input #fileInput type="file" accept=".csv,text/csv" hidden (change)="onFileSelected($event)" />
        </div>
      } @else {
        <!-- Preview view -->
        <div class="preview-stats">
          <div class="stat valid">
            <mat-icon>check_circle</mat-icon>
            <span class="num">{{ preview()!.validRows }}</span>
            <span class="label">{{ 'COACHING.icfImportValid' | translate }}</span>
          </div>
          @if (preview()!.invalidRows > 0) {
            <div class="stat invalid">
              <mat-icon>error</mat-icon>
              <span class="num">{{ preview()!.invalidRows }}</span>
              <span class="label">{{ 'COACHING.icfImportInvalid' | translate }}</span>
            </div>
          }
          <div class="stat total">
            <mat-icon>list_alt</mat-icon>
            <span class="num">{{ preview()!.totalRows }}</span>
            <span class="label">{{ 'COACHING.icfImportTotal' | translate }}</span>
          </div>
        </div>

        @if (preview()!.committed) {
          <div class="success-banner">
            <mat-icon>verified</mat-icon>
            {{ 'COACHING.icfImportCommitted' | translate:{ count: preview()!.validRows } }}
          </div>
        }

        <div class="preview-table-wrap">
          <table class="preview-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ 'COACHING.date' | translate }}</th>
                <th>{{ 'COACHING.icfCategory' | translate }}</th>
                <th class="num">{{ 'COACHING.icfHoursValue' | translate }}</th>
                <th>{{ 'COACHING.icfClientName' | translate }}</th>
                <th>{{ 'COACHING.icfImportStatus' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of preview()!.rows; track row.rowNumber) {
                <tr [class.row-error]="row.errors.length > 0">
                  <td class="rownum">{{ row.rowNumber }}</td>
                  <td>{{ row.parsed?.date ? (row.parsed!.date | date:'mediumDate') : (row.raw['date'] || '—') }}</td>
                  <td>{{ row.parsed?.category || row.raw['category'] || '—' }}</td>
                  <td class="num">{{ row.parsed?.hours ?? '—' }}</td>
                  <td>{{ row.parsed?.clientName || row.raw['client_name'] || '—' }}</td>
                  <td>
                    @if (row.errors.length === 0) {
                      <span class="status ok"><mat-icon>check</mat-icon> {{ 'COACHING.icfImportRowOk' | translate }}</span>
                    } @else {
                      <ul class="error-list">
                        @for (err of row.errors; track err) {
                          <li>{{ err }}</li>
                        }
                      </ul>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (preview() && !preview()!.committed && preview()!.validRows > 0) {
        <button mat-button (click)="resetPreview()">{{ 'COACHING.icfImportBack' | translate }}</button>
        <button mat-flat-button color="primary" (click)="commit()" [disabled]="uploading()">
          @if (uploading()) { <mat-icon>hourglass_empty</mat-icon> }
          {{ 'COACHING.icfImportCommit' | translate:{ count: preview()!.validRows } }}
        </button>
      } @else {
        <button mat-button (click)="close()">
          {{ (preview()?.committed ? 'COMMON.close' : 'COMMON.cancel') | translate }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-body { min-width: 720px; max-height: 70vh; padding-top: 8px; }
    h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; }
    .hint { color: #5a6a7e; font-size: 14px; margin: 0 0 12px; }
    .format-list {
      background: #f8fafc; border: 1px solid #e6ecf2; border-radius: 6px;
      padding: 12px 16px 12px 32px; font-size: 12px; color: #5a6a7e; margin: 0 0 16px;
    }
    .format-list li { margin: 3px 0; }
    .format-list code { background: #fff; padding: 1px 4px; border: 1px solid #e6ecf2; border-radius: 3px; font-size: 11px; }

    .upload-zone {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 32px; border: 2px dashed #cad5e0; border-radius: 8px;
      background: #fafbfd; transition: border-color 0.2s, background 0.2s;
    }
    .upload-zone.has-file { border-color: #27C4A0; background: #f0fdf6; }
    .upload-zone mat-icon { font-size: 36px; width: 36px; height: 36px; color: #9aa5b4; }
    .upload-zone.has-file mat-icon { color: #27C4A0; }
    .upload-zone p { margin: 0; color: #5a6a7e; }
    .filename { font-weight: 600; color: #1B2A47; }
    .filesize { font-size: 11px; color: #9aa5b4; }
    .file-actions { display: flex; gap: 8px; margin-top: 8px; }

    .preview-stats { display: flex; gap: 12px; margin-bottom: 12px; }
    .preview-stats .stat {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 6px; font-size: 13px;
    }
    .stat.valid    { background: #e0f7ed; color: #1a9678; }
    .stat.invalid  { background: #ffe6e6; color: #c43a3a; }
    .stat.total    { background: #f4f7fb; color: #5a6a7e; }
    .stat .num { font-weight: 700; font-size: 16px; }
    .stat mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .success-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px; background: #e0f7ed; color: #1a9678;
      border-radius: 6px; margin-bottom: 12px; font-size: 14px; font-weight: 500;
    }

    .preview-table-wrap { max-height: 360px; overflow: auto; border: 1px solid #e6ecf2; border-radius: 6px; }
    .preview-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .preview-table th, .preview-table td {
      padding: 8px 10px; text-align: left; border-bottom: 1px solid #f0f3f7;
    }
    .preview-table th { background: #f8fafc; font-weight: 600; color: #5a6a7e; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; position: sticky; top: 0; }
    .preview-table .num { text-align: right; font-variant-numeric: tabular-nums; }
    .preview-table tr.row-error { background: #fff5f5; }
    .preview-table .rownum { color: #9aa5b4; font-variant-numeric: tabular-nums; width: 30px; }

    .status.ok { color: #1a9678; display: inline-flex; align-items: center; gap: 4px; }
    .status.ok mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .error-list { margin: 0; padding-left: 16px; color: #c43a3a; }
    .error-list li { font-size: 11px; }
  `],
})
export class HoursImportDialogComponent {
  file = signal<File | null>(null);
  preview = signal<ImportPreview | null>(null);
  uploading = signal(false);

  constructor(
    private dialogRef: MatDialogRef<HoursImportDialogComponent, boolean>,
    private http: HttpClient,
    private snack: MatSnackBar,
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) {
      this.file.set(f);
      this.preview.set(null);
    }
  }

  runDryRun(): void { this.upload(true); }
  commit(): void { this.upload(false); }

  resetPreview(): void {
    this.preview.set(null);
  }

  private upload(dryRun: boolean): void {
    const f = this.file();
    if (!f) return;
    this.uploading.set(true);

    const fd = new FormData();
    fd.append('file', f);
    fd.append('dryRun', String(dryRun));

    this.http.post<ImportPreview>(`${environment.apiUrl}/coaching/hours/import`, fd).subscribe({
      next: (res) => {
        this.preview.set(res);
        this.uploading.set(false);
        if (res.committed) {
          this.snack.open(`Imported ${res.validRows} rows`, 'Dismiss', { duration: 2500 });
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.snack.open(err?.error?.error || 'Upload failed', 'Dismiss', { duration: 4000 });
      },
    });
  }

  close(): void { this.dialogRef.close(this.preview()?.committed === true); }
}
