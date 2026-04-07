import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth.service';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule],
  template: `
    <div class="callback-page">
      @if (error()) {
        <div class="callback-card error-card">
          <mat-icon>error_outline</mat-icon>
          <h2>Authentication Failed</h2>
          <p>{{ error() }}</p>
          <a href="/auth/login">Back to login</a>
        </div>
      } @else {
        <div class="callback-card">
          <mat-spinner diameter="36" />
          <p>Completing sign-in...</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .callback-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #1B2A47 0%, #2a3f6b 50%, #3A9FD6 100%);
    }
    .callback-card {
      background: white; border-radius: 16px; padding: 48px;
      text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      p { color: #5a6a7e; margin: 0; }
      a { color: #3A9FD6; font-weight: 600; text-decoration: none; }
    }
    .error-card {
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #e53e3e; }
      h2 { color: #1B2A47; margin: 0; }
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
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const code = params['code'];
    const state = params['state']; // provider name
    const errorParam = params['error'];

    if (errorParam) {
      this.error.set(params['error_description'] || 'OAuth authentication was cancelled or failed.');
      return;
    }

    if (!code || !state) {
      this.error.set('Missing authorization code. Please try again.');
      return;
    }

    this.api.post<any>(`/auth/oauth/${state}`, { code }).subscribe({
      next: (res) => {
        this.authService.handleOAuthResponse(res);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Authentication failed. Please try again.');
      },
    });
  }
}
