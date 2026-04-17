import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="stat-card" [style.border-left-color]="color">
      @if (icon) {
        <mat-icon class="stat-icon" [style.color]="color">{{ icon }}</mat-icon>
      }
      <div class="stat-value">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  `,
  styles: [`
    .stat-card {
      background: white; border-radius: 12px; padding: 16px 20px;
      border-left: 4px solid var(--artes-accent); box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      display: flex; flex-direction: column; gap: 2px; min-width: 0;
    }
    .stat-icon { font-size: 20px; width: 20px; height: 20px; margin-bottom: 4px; }
    .stat-value { font-size: 24px; font-weight: 700; color: var(--artes-primary); line-height: 1.2; }
    .stat-label { font-size: 12px; color: #6b7c93; font-weight: 500; }
  `],
})
export class StatCardComponent {
  @Input() value: string | number = 0;
  @Input() label = '';
  @Input() icon = '';
  @Input() color = '#3A9FD6';
}
