import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth.service';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule, TranslateModule],
  template: `
    <div class="callback-page">
      @if (error()) {
        <div class="callback-card error-card">
          <mat-icon>error_outline</mat-icon>
          <h2>{{ 'AUTH.authenticationFailed' | translate }}</h2>
          <p>{{ error() }}</p>
          <a href="/auth/login">{{ 'AUTH.backToLogin' | translate }}</a>
        </div>
      } @else {
        <div class="callback-card">
          <mat-spinner diameter="36" />
          <p>{{ 'AUTH.completingSignIn' | translate }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .callback-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, var(--artes-primary) 0%, #2a3f6b 50%, var(--artes-accent) 100%);
    }
    .callback-card {
      background: white; border-radius: 16px; padding: 48px;
      text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      p { color: #5a6a7e; margin: 0; }
      a { color: var(--artes-accent); font-weight: 600; text-decoration: none; }
    }
    .error-card {
      > mat-icon { font-size: 36px; width: 36px; height: 36px; color: #e53e3e; }
      h2 { color: var(--artes-primary); margin: 0; }
    }
  `],
})
export class OAuthCallbackComponent implements OnInit {
  error = signal('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private api: ApiService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const code = params['code'];
    const state = params['state']; // provider name
    const errorParam = params['error'];

    if (errorParam) {
      this.error.set(params['error_description'] || this.translate.instant('AUTH.oauthCancelledOrFailed'));
      return;
    }

    if (!code || !state) {
      this.error.set(this.translate.instant('AUTH.missingAuthCode'));
      return;
    }

    this.api.post<any>(`/auth/oauth/${state}`, { code }).subscribe({
      next: (res) => {
        this.authService.handleOAuthResponse(res);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error.set(err.error?.error || this.translate.instant('AUTH.authFailed'));
      },
    });
  }
}
