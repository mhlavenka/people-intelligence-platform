import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface CoachPick {
  _id: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  bio: string;
  publicSlug: string;
}

@Component({
  selector: 'app-coach-picker-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Choose a coach</h2>
    <mat-dialog-content>
      <p class="intro">Select the coach you'd like to book a session with.</p>
      <ul class="coach-list">
        @for (c of data.coaches; track c._id) {
          <li class="coach-row" (click)="select(c)">
            @if (c.profilePicture) {
              <img [src]="c.profilePicture" [alt]="c.firstName" class="avatar" />
            } @else {
              <div class="avatar-fallback">
                {{ (c.firstName[0] || '') + (c.lastName[0] || '') }}
              </div>
            }
            <div class="coach-body">
              <div class="coach-name">{{ c.firstName }} {{ c.lastName }}</div>
              @if (c.bio) {
                <div class="coach-bio">{{ c.bio }}</div>
              }
            </div>
            <mat-icon class="chevron">chevron_right</mat-icon>
          </li>
        }
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .intro { margin: 0 0 12px; color: #6b7c93; font-size: 14px; }
    .coach-list { list-style: none; padding: 0; margin: 0; }
    .coach-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border: 1px solid #eef2f7; border-radius: 10px;
      margin-bottom: 8px; cursor: pointer;
      transition: background 0.1s, border-color 0.1s;
      &:hover { background: #f7fbff; border-color: #3A9FD6; }
    }
    .avatar, .avatar-fallback {
      width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
    }
    .avatar { object-fit: cover; }
    .avatar-fallback {
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      color: #fff; font-weight: 600; font-size: 16px;
    }
    .coach-body { flex: 1; min-width: 0; }
    .coach-name { font-weight: 600; color: #1B2A47; font-size: 15px; }
    .coach-bio {
      margin-top: 2px; color: #6b7c93; font-size: 13px; line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .chevron { color: #c8d3df; flex-shrink: 0; }
  `],
})
export class CoachPickerDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { coaches: CoachPick[] },
    private dialogRef: MatDialogRef<CoachPickerDialogComponent, CoachPick | null>,
  ) {}

  select(c: CoachPick): void { this.dialogRef.close(c); }
  cancel(): void { this.dialogRef.close(null); }
}
