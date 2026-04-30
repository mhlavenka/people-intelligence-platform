import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';
import { DialogCloseButtonComponent } from '../../../shared/dialog-close-button/dialog-close-button.component';

interface GlobalTemplateRow {
  _id: string;
  title: string;
  moduleType: string;
  instrumentId?: string;
  instrumentVersion?: string;
  isActive: boolean;
}

interface InstrumentsResponse {
  allGlobal: GlobalTemplateRow[];
  enabled: string[] | null;     // null ⇒ implicit-allow
}

@Component({
  selector: 'app-org-instruments-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatCheckboxModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    MatDividerModule, TranslateModule, DialogCloseButtonComponent,
  ],
  template: `
    <app-dialog-close-btn (closed)="dialogRef.close()" />
    <h2 mat-dialog-title>
      <mat-icon>tune</mat-icon>
      {{ 'SYSADMIN.instrumentsDialogTitle' | translate }} — {{ data.orgName }}
    </h2>

    <mat-dialog-content>
      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="32"/></div>
      } @else {
        <div class="status-banner" [class.implicit]="isImplicitAllow()">
          <mat-icon>{{ isImplicitAllow() ? 'all_inclusive' : 'check_circle' }}</mat-icon>
          <div>
            @if (isImplicitAllow()) {
              <strong>{{ 'SYSADMIN.instrumentsImplicitAllow' | translate }}</strong>
              <p>{{ 'SYSADMIN.instrumentsImplicitAllowHelp' | translate }}</p>
            } @else {
              <strong>{{ 'SYSADMIN.instrumentsAllowlist' | translate:{ count: enabledIds().size } }}</strong>
              <p>{{ 'SYSADMIN.instrumentsAllowlistHelp' | translate }}</p>
            }
          </div>
        </div>

        @for (group of groups(); track group.moduleType) {
          <div class="module-group">
            <div class="module-header">
              <h3>
                <mat-icon>{{ moduleIcon(group.moduleType) }}</mat-icon>
                {{ moduleLabel(group.moduleType) }}
                <span class="count">{{ groupEnabledCount(group.moduleType) }} / {{ group.templates.length }}</span>
              </h3>
              <div class="bulk-actions">
                <button mat-button (click)="enableAllInGroup(group.moduleType)">
                  {{ 'SYSADMIN.instrumentsEnableAll' | translate }}
                </button>
                <button mat-button (click)="disableAllInGroup(group.moduleType)">
                  {{ 'SYSADMIN.instrumentsDisableAll' | translate }}
                </button>
              </div>
            </div>

            <div class="template-list">
              @for (t of group.templates; track t._id) {
                <label class="template-row">
                  <mat-checkbox
                    [checked]="enabledIds().has(t._id)"
                    (change)="toggle(t._id, $event.checked)" />
                  <div class="template-meta">
                    <span class="title">{{ t.title }}</span>
                    <span class="sub">
                      @if (t.instrumentId) {
                        <code>{{ t.instrumentId }}</code>
                        @if (t.instrumentVersion) { <span>· v{{ t.instrumentVersion }}</span> }
                      }
                      @if (!t.isActive) {
                        <span class="inactive">{{ 'SYSADMIN.instrumentsInactive' | translate }}</span>
                      }
                    </span>
                  </div>
                </label>
              }
            </div>
          </div>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="revertToImplicitAllow()" [disabled]="saving() || isImplicitAllow()"
              [matTooltip]="'SYSADMIN.instrumentsRevertHelp' | translate">
        <mat-icon>all_inclusive</mat-icon>
        {{ 'SYSADMIN.instrumentsRevert' | translate }}
      </button>
      <span class="spacer"></span>
      <button mat-button mat-dialog-close [disabled]="saving()">{{ 'COMMON.cancel' | translate }}</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="saving() || loading()">
        @if (saving()) { <mat-spinner diameter="18"/> }
        @else { <mat-icon>save</mat-icon> }
        {{ 'COMMON.save' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 8px; color: var(--artes-primary);
      mat-icon { color: var(--artes-accent); } }
    mat-dialog-content { min-width: 600px; max-width: 720px; max-height: 70vh; padding-top: 8px !important; }
    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .status-banner {
      display: flex; align-items: flex-start; gap: 12px;
      background: rgba(58,159,214,0.08); border: 1px solid rgba(58,159,214,0.25);
      padding: 12px 14px; border-radius: 8px; margin-bottom: 20px;
      mat-icon { color: var(--artes-accent); flex-shrink: 0; margin-top: 2px; }
      strong { color: var(--artes-primary); display: block; }
      p { margin: 4px 0 0; font-size: 13px; color: #5a6a7e; }
    }
    .status-banner.implicit {
      background: rgba(240,165,0,0.08); border-color: rgba(240,165,0,0.3);
      mat-icon { color: #c87f00; }
    }

    .module-group { margin-bottom: 20px; }
    .module-header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 6px; border-bottom: 1px solid #eef2f7; margin-bottom: 8px;
    }
    .module-header h3 {
      display: flex; align-items: center; gap: 8px;
      margin: 0; font-size: 14px; font-weight: 700;
      color: var(--artes-primary); text-transform: uppercase; letter-spacing: 0.5px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--artes-accent); }
      .count { font-size: 11px; color: #9aa5b4; font-weight: 500; letter-spacing: 0; text-transform: none; }
    }
    .bulk-actions button { font-size: 12px; padding: 0 8px; min-width: auto; line-height: 28px; }

    .template-list { display: flex; flex-direction: column; gap: 2px; }
    .template-row {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 8px 10px; border-radius: 6px; cursor: pointer;
      &:hover { background: #f8fbff; }
    }
    .template-meta { display: flex; flex-direction: column; gap: 2px; }
    .title { font-size: 14px; color: #2c3e50; }
    .sub {
      font-size: 11px; color: #9aa5b4;
      code { font-size: 11px; background: #eef2f7; padding: 1px 5px; border-radius: 3px; }
      .inactive { color: #c53030; margin-left: 6px; }
    }

    mat-dialog-actions { padding: 12px 24px; }
    .spacer { flex: 1; }
  `],
})
export class OrgInstrumentsDialogComponent implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  dialogRef = inject(MatDialogRef<OrgInstrumentsDialogComponent>);
  data = inject<{ orgId: string; orgName: string }>(MAT_DIALOG_DATA);

  loading = signal(true);
  saving = signal(false);
  enabledIds = signal<Set<string>>(new Set());
  allGlobal = signal<GlobalTemplateRow[]>([]);
  /** True when the org has no allowlist field set (legacy implicit-allow). */
  isImplicitAllow = signal(false);

  /** Templates grouped by moduleType (sorted by module then title). */
  groups = computed(() => {
    const byMod = new Map<string, GlobalTemplateRow[]>();
    for (const t of this.allGlobal()) {
      if (!byMod.has(t.moduleType)) byMod.set(t.moduleType, []);
      byMod.get(t.moduleType)!.push(t);
    }
    const order = ['conflict', 'neuroinclusion', 'succession', 'coaching'];
    return Array.from(byMod.entries())
      .sort(([a], [b]) => {
        const ai = order.indexOf(a); const bi = order.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .map(([moduleType, templates]) => ({ moduleType, templates }));
  });

  ngOnInit() {
    this.api.get<InstrumentsResponse>(`/system-admin/organizations/${this.data.orgId}/instruments`)
      .subscribe({
        next: (r) => {
          this.allGlobal.set(r.allGlobal);
          // null = legacy implicit-allow → treat all as enabled in the UI but
          // remember the original mode so we can offer "Revert" later.
          if (r.enabled === null) {
            this.isImplicitAllow.set(true);
            this.enabledIds.set(new Set(r.allGlobal.map((t) => t._id)));
          } else {
            this.isImplicitAllow.set(false);
            this.enabledIds.set(new Set(r.enabled));
          }
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snack.open(this.translate.instant('SYSADMIN.instrumentsLoadFailed'),
            this.translate.instant('COMMON.close'), { duration: 3000 });
        },
      });
  }

  toggle(id: string, on: boolean) {
    const next = new Set(this.enabledIds());
    if (on) next.add(id); else next.delete(id);
    this.enabledIds.set(next);
    // Any toggle pulls the org out of implicit-allow.
    this.isImplicitAllow.set(false);
  }

  enableAllInGroup(moduleType: string) {
    const next = new Set(this.enabledIds());
    for (const t of this.allGlobal()) if (t.moduleType === moduleType) next.add(t._id);
    this.enabledIds.set(next);
    this.isImplicitAllow.set(false);
  }

  disableAllInGroup(moduleType: string) {
    const next = new Set(this.enabledIds());
    for (const t of this.allGlobal()) if (t.moduleType === moduleType) next.delete(t._id);
    this.enabledIds.set(next);
    this.isImplicitAllow.set(false);
  }

  groupEnabledCount(moduleType: string): number {
    let n = 0;
    for (const t of this.allGlobal()) if (t.moduleType === moduleType && this.enabledIds().has(t._id)) n++;
    return n;
  }

  /** Send `enabled: null` to the backend, which $unsets the allowlist. */
  revertToImplicitAllow() {
    this.saving.set(true);
    this.api.put(`/system-admin/organizations/${this.data.orgId}/instruments`, { enabled: null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open(this.translate.instant('SYSADMIN.instrumentsRevertedToImplicitAllow'),
            this.translate.instant('COMMON.close'), { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving.set(false);
          this.snack.open(this.translate.instant('SYSADMIN.instrumentsSaveFailed'),
            this.translate.instant('COMMON.close'), { duration: 3000 });
        },
      });
  }

  save() {
    this.saving.set(true);
    this.api.put(`/system-admin/organizations/${this.data.orgId}/instruments`,
                 { enabled: Array.from(this.enabledIds()) })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open(this.translate.instant('SYSADMIN.instrumentsSaved'),
            this.translate.instant('COMMON.close'), { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving.set(false);
          this.snack.open(this.translate.instant('SYSADMIN.instrumentsSaveFailed'),
            this.translate.instant('COMMON.close'), { duration: 3000 });
        },
      });
  }

  moduleIcon(m: string): string {
    const map: Record<string, string> = {
      conflict: 'warning_amber', neuroinclusion: 'psychology',
      succession: 'trending_up', coaching: 'psychology_alt',
    };
    return map[m] ?? 'extension';
  }

  moduleLabel(m: string): string {
    const map: Record<string, string> = {
      conflict: 'Conflict', neuroinclusion: 'Neuro-Inclusion',
      succession: 'Succession', coaching: 'Coaching',
    };
    return map[m] ?? m;
  }
}
