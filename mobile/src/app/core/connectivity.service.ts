import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  isOnline = signal(true);

  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.isOnline.set(navigator.onLine);
      window.addEventListener('online', () => this.isOnline.set(true));
      window.addEventListener('offline', () => this.isOnline.set(false));
      return;
    }

    const status = await Network.getStatus();
    this.isOnline.set(status.connected);

    Network.addListener('networkStatusChange', (status) => {
      this.isOnline.set(status.connected);
    });
  }
}
