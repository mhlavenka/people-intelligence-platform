import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-mini-gauge',
  standalone: true,
  template: `
    <svg [attr.viewBox]="'0 0 ' + vw + ' ' + vh" class="mini-gauge-svg">
      <path [attr.d]="bgArc" fill="none" stroke="#e8edf4" [attr.stroke-width]="sw" stroke-linecap="round"/>
      <path [attr.d]="valueArc" fill="none" [attr.stroke]="color" [attr.stroke-width]="sw" stroke-linecap="round"/>
      <text [attr.x]="vw / 2" [attr.y]="ty" text-anchor="middle" class="score-text"
            [attr.font-size]="fontSize" font-weight="700" [attr.fill]="score > 0 ? color : '#b0bec5'">
        {{ score > 0 ? score : '--' }}
      </text>
    </svg>
  `,
  styles: [`
    :host { display: inline-block; }
    :host(.size-sm) { width: 72px; }
    :host(.size-md) { width: 80px; }
    .mini-gauge-svg { width: 100%; height: auto; display: block; }
  `],
  host: { '[class.size-sm]': "size === 'sm'", '[class.size-md]': "size === 'md'" },
})
export class MiniGaugeComponent {
  @Input() score = 0;
  @Input() riskLevel = '';
  @Input() size: 'sm' | 'md' = 'md';

  private static COLORS: Record<string, string> = {
    low: '#27C4A0', medium: '#f0a500', high: '#e86c3a', critical: '#e53e3e',
  };

  get color(): string { return MiniGaugeComponent.COLORS[this.riskLevel] ?? '#9aa5b4'; }
  get vw(): number { return this.size === 'sm' ? 80 : 100; }
  get vh(): number { return this.size === 'sm' ? 52 : 60; }
  get r(): number { return this.size === 'sm' ? 30 : 40; }
  get cx(): number { return this.vw / 2; }
  get cy(): number { return this.vh - (this.size === 'sm' ? 8 : 8); }
  get sw(): number { return this.size === 'sm' ? 8 : 10; }
  get ty(): number { return this.cy - 4; }
  get fontSize(): number { return this.size === 'sm' ? 13 : 18; }

  get bgArc(): string {
    return `M ${this.cx - this.r} ${this.cy} A ${this.r} ${this.r} 0 0 1 ${this.cx + this.r} ${this.cy}`;
  }

  get valueArc(): string {
    if (this.score <= 0) return '';
    const angle = (this.score / 100) * Math.PI;
    const x = this.cx - this.r * Math.cos(angle);
    const y = this.cy - this.r * Math.sin(angle);
    return `M ${this.cx - this.r} ${this.cy} A ${this.r} ${this.r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
}
