import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PushService {
  private api = inject(ApiService);
  private router = inject(Router);

  async register(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      this.api
        .post('/push/register', {
          token: token.value,
          platform: Capacitor.getPlatform(),
        })
        .subscribe();
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      const route = notification.notification.data?.['route'];
      if (route) {
        this.router.navigateByUrl(route);
      }
    });
  }

  async unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    this.api.delete('/push/unregister').subscribe();
  }
}
