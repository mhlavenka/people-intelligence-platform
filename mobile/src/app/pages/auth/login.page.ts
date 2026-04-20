import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonInput,
  IonButton,
  IonSpinner,
  IonText,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { fingerPrintOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { PushService } from '../../core/push.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    IonContent,
    IonInput,
    IonButton,
    IonSpinner,
    IonText,
    IonIcon,
    TranslateModule,
  ],
  template: `
    <ion-content class="login-content" [fullscreen]="true">
      <div class="login-container">
        <div class="logo-section">
          <h1 class="app-title">ARTES</h1>
          <p class="app-subtitle">{{ 'LOGIN.SUBTITLE' | translate }}</p>
        </div>

        @if (!showTwoFactor()) {
          <div class="form-section">
            <ion-input
              [(ngModel)]="email"
              type="email"
              label="Email"
              labelPlacement="floating"
              fill="outline"
              [disabled]="loading()"
            ></ion-input>

            <ion-input
              [(ngModel)]="password"
              type="password"
              label="Password"
              labelPlacement="floating"
              fill="outline"
              [disabled]="loading()"
            ></ion-input>

            @if (error()) {
              <ion-text color="danger">
                <p class="error-text">{{ error() }}</p>
              </ion-text>
            }

            <ion-button
              expand="block"
              (click)="login()"
              [disabled]="loading() || !email || !password"
            >
              @if (loading()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                {{ 'LOGIN.SIGN_IN' | translate }}
              }
            </ion-button>

            @if (biometricAvailable()) {
              <ion-button
                expand="block"
                fill="outline"
                (click)="biometricLogin()"
                [disabled]="loading()"
              >
                <ion-icon name="finger-print-outline" slot="start"></ion-icon>
                {{ 'LOGIN.BIOMETRIC' | translate }}
              </ion-button>
            }
          </div>
        } @else {
          <div class="form-section">
            <ion-input
              [(ngModel)]="otpCode"
              type="text"
              label="2FA Code"
              labelPlacement="floating"
              fill="outline"
              maxlength="6"
              [disabled]="loading()"
            ></ion-input>

            <ion-button
              expand="block"
              (click)="verify2fa()"
              [disabled]="loading() || !otpCode"
            >
              @if (loading()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                {{ 'LOGIN.VERIFY' | translate }}
              }
            </ion-button>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [
    `
      .login-content {
        --background: #1b2a47;
      }
      .login-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 100%;
        padding: 24px;
      }
      .logo-section {
        text-align: center;
        margin-bottom: 48px;
      }
      .app-title {
        color: #ffffff;
        font-size: 36px;
        font-weight: 700;
        margin: 0;
      }
      .app-subtitle {
        color: #8fa4c0;
        font-size: 14px;
        margin-top: 8px;
      }
      .form-section {
        width: 100%;
        max-width: 360px;
      }
      ion-input {
        margin-bottom: 16px;
        --background: #ffffff;
        --border-radius: 8px;
      }
      ion-button {
        margin-top: 8px;
        --border-radius: 8px;
      }
      .error-text {
        font-size: 13px;
        text-align: center;
        margin: 8px 0;
      }
    `,
  ],
})
export class LoginPage implements OnInit {
  private auth = inject(AuthService);
  private push = inject(PushService);
  private router = inject(Router);

  email = '';
  password = '';
  otpCode = '';

  loading = signal(false);
  error = signal('');
  showTwoFactor = signal(false);
  biometricAvailable = signal(false);

  private tempToken = '';

  constructor() {
    addIcons({ fingerPrintOutline });
  }

  async ngOnInit() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/tabs']);
      return;
    }

    const success = await this.auth.tryBiometricLogin();
    if (success) {
      await this.onLoginSuccess();
    } else {
      this.biometricAvailable.set(true);
    }
  }

  login() {
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.requiresTwoFactor) {
          this.tempToken = res.tempToken!;
          this.showTwoFactor.set(true);
        } else {
          this.onLoginSuccess();
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Login failed');
      },
    });
  }

  verify2fa() {
    this.loading.set(true);
    this.error.set('');

    this.auth.verify2fa(this.tempToken, this.otpCode).subscribe({
      next: () => {
        this.loading.set(false);
        this.onLoginSuccess();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Invalid code');
      },
    });
  }

  async biometricLogin() {
    this.loading.set(true);
    const success = await this.auth.tryBiometricLogin();
    this.loading.set(false);

    if (success) {
      await this.onLoginSuccess();
    } else {
      this.error.set('Biometric login failed. Please sign in manually.');
    }
  }

  private async onLoginSuccess() {
    // Push registration disabled until google-services.json is configured
    // await this.push.register();
    this.router.navigate(['/tabs']);
  }
}
