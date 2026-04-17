import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-risk-badge',
  standalone: true,
  template: `<span class="badge" [class]="level">{{ label || level }}</span>`,
  styles: [`
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 999px;
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
      &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
      &.critical { background: rgba(229,62,62,0.15);  color: #c53030; }
    }
  `],
})
export class RiskBadgeComponent {
  @Input() level = '';
  @Input() label = '';
}
