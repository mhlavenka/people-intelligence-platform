import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-passkey-label-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, TranslateModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>fingerprint</mat-icon> {{ 'PROFILE.namePasskey' | translate }}
    </h2>
    <mat-dialog-content>
      <p class="desc">{{ 'PROFILE.namePasskeyDesc' | translate }}</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ 'PROFILE.passkeyName' | translate }}</mat-label>
        <input matInput [(ngModel)]="label" placeholder='e.g. "MacBook Touch ID", "YubiKey"' autofocus />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'COMMON.cancel' | translate }}</button>
      <button mat-raised-button color="primary" [disabled]="!label.trim()" (click)="save()">
        <mat-icon>check</mat-icon> {{ 'COMMON.save' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 8px; color: var(--artes-primary); mat-icon { color: #7c5cbf; } }
    mat-dialog-content { min-width: 380px; }
    .desc { font-size: 13px; color: #5a6a7e; margin: 0 0 16px; }
    .full-width { width: 100%; }
  `],
})
export class PasskeyLabelDialogComponent {
  label = 'Passkey';
  constructor(private dialogRef: MatDialogRef<PasskeyLabelDialogComponent>) {}
  save(): void { this.dialogRef.close(this.label.trim()); }
}
