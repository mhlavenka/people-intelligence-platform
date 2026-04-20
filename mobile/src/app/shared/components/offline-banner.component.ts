import { Component, inject } from '@angular/core';
import { IonIcon, IonText } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline } from 'ionicons/icons';
import { ConnectivityService } from '../../core/connectivity.service';

@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [IonIcon, IonText],
  template: `
    @if (!connectivity.isOnline()) {
      <div class="offline-banner">
        <ion-icon name="cloud-offline-outline"></ion-icon>
        <ion-text>You're offline. Changes will sync when connected.</ion-text>
      </div>
    }
  `,
  styles: [
    `
      .offline-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: #f59e0b;
        color: #ffffff;
        font-size: 13px;
        font-weight: 500;
      }
      ion-icon {
        font-size: 18px;
      }
    `,
  ],
})
export class OfflineBannerComponent {
  connectivity = inject(ConnectivityService);

  constructor() {
    addIcons({ cloudOfflineOutline });
  }
}
