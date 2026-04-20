import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PushService {
  private api = inject(ApiService);
  private router = inject(Router);
  private registered = false;

  async register(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (this.registered) return;

    // Push notifications require google-services.json to be configured.
    // Skip registration until Firebase project is set up.
    // TODO: Remove this guard once google-services.json is added to android/app/
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') return;

      await PushNotifications.register();
      this.registered = true;

      PushNotifications.addListener('registration', (token) => {
        this.api
          .post('/push/register', {
            token: token.value,
            platform: Capacitor.getPlatform(),
          })
          .subscribe();
      });

      PushNotifications.addListener('registrationError', () => {});

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        const route = notification.notification.data?.['route'];
        if (route) {
          this.router.navigateByUrl(route);
        }
      });
    } catch {
      // Firebase not configured — push notifications disabled
    }
  }

  async unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      this.api.delete('/push/unregister').subscribe();
    } catch {}
  }
}
