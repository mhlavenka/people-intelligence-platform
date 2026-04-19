import { Injectable, NgZone } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

declare const grecaptcha: {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

@Injectable({ providedIn: 'root' })
export class RecaptchaService {
  private loaded = false;
  private loading: Promise<void> | null = null;

  constructor(private zone: NgZone) {}

  private loadScript(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (this.loading) return this.loading;

    this.loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${environment.recaptchaSiteKey}`;
      script.async = true;
      script.onload = () => { this.loaded = true; resolve(); };
      script.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
      document.head.appendChild(script);
    });
    return this.loading;
  }

  execute(action: string): Observable<string> {
    if (!environment.recaptchaSiteKey) return of('');

    return new Observable<string>((subscriber) => {
      this.loadScript()
        .then(() => {
          grecaptcha.ready(() => {
            grecaptcha
              .execute(environment.recaptchaSiteKey, { action })
              .then((token) => {
                this.zone.run(() => {
                  subscriber.next(token);
                  subscriber.complete();
                });
              })
              .catch((err) => this.zone.run(() => subscriber.error(err)));
          });
        })
        .catch((err) => this.zone.run(() => subscriber.error(err)));
    });
  }
}
