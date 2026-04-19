import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule,
    TranslateModule,
  ],
  template: `
    <div class="legal-page">
      <header class="legal-header">
        <a routerLink="/" class="logo-link">
          <img src="assets/artes-logo-full-white.png" alt="ARTES" class="logo" onerror="this.style.display='none'" />
          <span class="logo-text">ARTES</span>
        </a>
        <nav>
          <a routerLink="/privacystatement" class="nav-link">{{ "LEGAL.privacyLink" | translate }}</a>
          <a routerLink="/login" mat-stroked-button class="nav-btn">{{ "LEGAL.signIn" | translate }}</a>
        </nav>
      </header>

      <main class="legal-content">
        <div class="hero">
          <mat-icon class="hero-icon">gavel</mat-icon>
          <h1>{{ "LEGAL.termsTitle" | translate }}</h1>
          <p class="subtitle">{{ "LEGAL.lastUpdated" | translate }}</p>
        </div>

        <article class="document">

          <section>
            <h2>{{ "LEGAL.terms.s1Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s1p1" | translate }}</p>
            <p [innerHTML]="'LEGAL.terms.s1p2' | translate"></p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s2Title" | translate }}</h2>
            <ul>
              <li [innerHTML]="'LEGAL.terms.s2li1' | translate"></li>
              <li [innerHTML]="'LEGAL.terms.s2li2' | translate"></li>
              <li [innerHTML]="'LEGAL.terms.s2li3' | translate"></li>
              <li [innerHTML]="'LEGAL.terms.s2li4' | translate"></li>
            </ul>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s3Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s3p1" | translate }}</p>
            <p>{{ "LEGAL.terms.s3p2" | translate }}</p>
            <p>{{ "LEGAL.terms.s3p3" | translate }}</p>
            <p>{{ "LEGAL.terms.s3p4" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s4Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s4p1" | translate }}</p>
            <ul>
              <li>{{ "LEGAL.terms.s4li1" | translate }}</li>
              <li>{{ "LEGAL.terms.s4li2" | translate }}</li>
              <li>{{ "LEGAL.terms.s4li3" | translate }}</li>
              <li>{{ "LEGAL.terms.s4li4" | translate }}</li>
              <li>{{ "LEGAL.terms.s4li5" | translate }}</li>
              <li>{{ "LEGAL.terms.s4li6" | translate }}</li>
            </ul>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s5Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s5p1" | translate }}</p>
            <p>{{ "LEGAL.terms.s5p2" | translate }}</p>
            <p>{{ "LEGAL.terms.s5p3" | translate }}</p>
            <p>{{ "LEGAL.terms.s5p4" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s6Title" | translate }}</h2>
            <p [innerHTML]="'LEGAL.terms.s6p1' | translate"></p>
            <p [innerHTML]="'LEGAL.terms.s6p2' | translate"></p>
            <p [innerHTML]="'LEGAL.terms.s6p3' | translate"></p>
            <p [innerHTML]="'LEGAL.terms.s6p4' | translate"></p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s7Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s7p1" | translate }}</p>
            <p>{{ "LEGAL.terms.s7p2" | translate }}</p>
            <p>{{ "LEGAL.terms.s7p3" | translate }}</p>
            <p>{{ "LEGAL.terms.s7p4" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s8Title" | translate }}</h2>
            <p [innerHTML]="'LEGAL.terms.s8p1' | translate"></p>
            <p>{{ "LEGAL.terms.s8p2" | translate }}</p>
            <p>{{ "LEGAL.terms.s8p3" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s9Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s9p1" | translate }}</p>
            <p>{{ "LEGAL.terms.s9p2" | translate }}</p>
            <p>{{ "LEGAL.terms.s9p3" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s10Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s10p1" | translate }}</p>
            <p>{{ "LEGAL.terms.s10p2" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s11Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s11p1" | translate }}</p>
            <p>{{ "LEGAL.terms.s11p2" | translate }}</p>
            <p>{{ "LEGAL.terms.s11p3" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s12Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s12p1" | translate }}</p>
            <p>{{ "LEGAL.terms.s12p2" | translate }}</p>
            <p>{{ "LEGAL.terms.s12p3" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s13Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s13p1" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s14Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s14p1" | translate }}</p>
          </section>

          <section>
            <h2>{{ "LEGAL.terms.s15Title" | translate }}</h2>
            <p>{{ "LEGAL.terms.s15p1" | translate }}</p>
            <div class="contact-card">
              <p><strong>{{ "LEGAL.terms.s15company" | translate }}</strong></p>
              <p>{{ "LEGAL.terms.s15email" | translate }} <a href="mailto:legal@helenacoaching.com">legal&#64;helenacoaching.com</a></p>
              <p>{{ "LEGAL.terms.s15platform" | translate }} <a href="https://artes.helenacoaching.com">artes.helenacoaching.com</a></p>
            </div>
          </section>

        </article>
      </main>

      <footer class="legal-footer">
        <div class="footer-inner">
          <span>&copy; 2026 HeadSoft Technology &times; Helena Coaching. All rights reserved.</span>
          <div class="footer-links">
            <a routerLink="/termsofservice">{{ "LEGAL.footerTerms" | translate }}</a>
            <a routerLink="/privacystatement">{{ "LEGAL.footerPrivacy" | translate }}</a>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #f8fafb; }

    .legal-page { display: flex; flex-direction: column; min-height: 100vh; }

    .legal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 40px; background: #1B2A47;
    }
    .logo-link {
      display: flex; align-items: center; gap: 10px;
      text-decoration: none; color: #fff;
    }
    .logo { height: 32px; }
    .logo-text { font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #fff; }
    .legal-header nav { display: flex; align-items: center; gap: 16px; }
    .nav-link { color: rgba(255,255,255,0.8); text-decoration: none; font-size: 14px; &:hover { color: #fff; } }
    .nav-btn { color: #fff !important; border-color: rgba(255,255,255,0.4) !important; font-size: 14px !important; }

    .legal-content { flex: 1; max-width: 800px; width: 100%; margin: 0 auto; padding: 0 24px 60px; }

    .hero {
      text-align: center; padding: 48px 0 32px;
    }
    .hero-icon { font-size: 48px; width: 48px; height: 48px; color: #3A9FD6; margin-bottom: 12px; }
    .hero h1 { font-size: 36px; color: #1B2A47; margin: 0 0 8px; font-weight: 700; }
    .subtitle { color: #6b7c93; font-size: 14px; margin: 0; }

    .document { background: #fff; border-radius: 16px; padding: 48px; box-shadow: 0 2px 16px rgba(0,0,0,0.04); }

    section { margin-bottom: 32px; &:last-child { margin-bottom: 0; } }

    h2 {
      font-size: 18px; color: #1B2A47; font-weight: 600; margin: 0 0 12px;
      padding-bottom: 8px; border-bottom: 1px solid #eef2f6;
    }

    p { font-size: 15px; line-height: 1.7; color: #3d4f63; margin: 0 0 10px; }

    ul { padding-left: 20px; margin: 8px 0 12px; }
    li { font-size: 15px; line-height: 1.7; color: #3d4f63; margin-bottom: 6px; }

    a { color: #3A9FD6; text-decoration: none; &:hover { text-decoration: underline; } }

    .contact-card {
      background: #f4f7fa; border-radius: 10px; padding: 16px 20px; margin-top: 12px;
      p { margin: 0 0 4px; &:last-child { margin: 0; } }
    }

    .legal-footer {
      background: #1B2A47; color: rgba(255,255,255,0.7); padding: 20px 40px;
    }
    .footer-inner {
      max-width: 800px; margin: 0 auto;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 13px;
    }
    .footer-links { display: flex; gap: 20px; }
    .footer-links a { color: rgba(255,255,255,0.7); text-decoration: none; &:hover { color: #fff; } }

    @media (max-width: 640px) {
      .legal-header { padding: 12px 16px; }
      .legal-content { padding: 0 12px 40px; }
      .document { padding: 24px 20px; }
      .hero h1 { font-size: 28px; }
      .footer-inner { flex-direction: column; gap: 8px; text-align: center; }
    }
  `],
})
export class TermsOfServiceComponent {}
