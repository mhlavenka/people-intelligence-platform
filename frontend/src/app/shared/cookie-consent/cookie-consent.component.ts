import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

const CONSENT_KEY = 'artes_cookie_consent';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, TranslateModule],
  template: `
    @if (visible()) {
      <div class="cookie-banner" [class.hiding]="hiding()">
        <mat-icon class="cookie-icon">cookie</mat-icon>
        <div class="cookie-text" [innerHTML]="'COMMON.cookieMessage' | translate"></div>
        <div class="cookie-actions">
          <button mat-flat-button color="primary" (click)="accept()">{{ 'COMMON.accept' | translate }}</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .cookie-banner {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 10000;
      display: flex; align-items: center; gap: 16px;
      padding: 16px 32px;
      background: var(--artes-primary); color: rgba(255,255,255,0.9);
      box-shadow: 0 -4px 24px rgba(0,0,0,0.15);
      animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .cookie-banner.hiding {
      animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideDown {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(100%); opacity: 0; }
    }
    .cookie-icon { color: #e67e22; font-size: 28px; width: 28px; height: 28px; flex-shrink: 0; }
    .cookie-text {
      flex: 1; font-size: 14px; line-height: 1.5;
      a { color: var(--artes-accent); text-decoration: none; margin-left: 4px; &:hover { text-decoration: underline; } }
    }
    .cookie-actions { flex-shrink: 0; }
    @media (max-width: 640px) {
      .cookie-banner { flex-direction: column; gap: 10px; padding: 14px 16px; text-align: center; }
    }
  `],
})
export class CookieConsentComponent {
  visible = signal(!localStorage.getItem(CONSENT_KEY));
  hiding = signal(false);

  accept(): void {
    this.hiding.set(true);
    setTimeout(() => {
      localStorage.setItem(CONSENT_KEY, 'true');
      this.visible.set(false);
    }, 300);
  }
}
