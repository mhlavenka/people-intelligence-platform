import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  /** 'warn' for destructive actions, 'primary' for neutral. Defaults to 'warn'. */
  confirmColor?: 'warn' | 'primary';
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, TranslateModule],
  template: `
    <div class="confirm-dialog">
      <div class="dialog-icon" [class]="data.confirmColor ?? 'warn'">
        <mat-icon>{{ data.icon ?? (isDestructive ? 'delete_forever' : 'help_outline') }}</mat-icon>
      </div>

      <h2>{{ data.title }}</h2>
      <p>{{ data.message }}</p>

      <div class="dialog-actions">
        <button mat-stroked-button (click)="dialogRef.close(false)">{{ 'COMMON.cancel' | translate }}</button>
        <button mat-raised-button
                [color]="data.confirmColor ?? 'warn'"
                (click)="dialogRef.close(true)">
          {{ data.confirmLabel ?? ('COMMON.confirm' | translate) }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 32px 28px 24px;
    }

    .dialog-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;

      mat-icon { font-size: 30px; width: 30px; height: 30px; }

      &.warn    { background: rgba(229,62,62,0.1);  color: #c53030; }
      &.primary { background: rgba(58,159,214,0.1); color: #2080b0; }
    }

    h2 {
      font-size: 18px;
      font-weight: 700;
      color: var(--artes-primary);
      margin: 0 0 10px;
    }

    p {
      font-size: 14px;
      color: #5a6a7e;
      margin: 0 0 28px;
      line-height: 1.5;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
      width: 100%;
      justify-content: center;

      button { min-width: 110px; }
    }
  `],
})
export class ConfirmDialogComponent {
  get isDestructive(): boolean {
    return (this.data.confirmColor ?? 'warn') === 'warn';
  }

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
  ) {}
}
