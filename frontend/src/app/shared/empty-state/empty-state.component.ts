import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="empty-wrap">
      <mat-icon>{{ icon }}</mat-icon>
      <h3>{{ title }}</h3>
      @if (message) { <p>{{ message }}</p> }
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .empty-wrap {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 48px 20px; text-align: center; color: #6b7c93;
      /* Direct-child only so the hero size doesn't cascade into mat-icons
         inside CTA buttons projected via <ng-content>. */
      > mat-icon { font-size: 36px; width: 36px; height: 36px; color: #c5d0db; margin-bottom: 12px; }
      h3 { font-size: 16px; font-weight: 600; color: var(--artes-primary); margin: 0 0 6px; }
      p { font-size: 14px; line-height: 1.5; margin: 0 0 16px; max-width: 400px; }
    }
  `],
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'No data yet';
  @Input() message = '';
}
