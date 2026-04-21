import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonBadge,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubblesOutline,
  calendarOutline,
  clipboardOutline,
  trophyOutline,
  notificationsOutline,
  personCircleOutline,
} from 'ionicons/icons';
import { OfflineBannerComponent } from '../shared/components/offline-banner.component';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { OfflineService } from '../core/offline.service';
import { ConnectivityService } from '../core/connectivity.service';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge, OfflineBannerComponent],
  template: `
    <app-offline-banner />
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="sessions">
          <ion-icon name="chatbubbles-outline"></ion-icon>
          <ion-label>Sessions</ion-label>
        </ion-tab-button>

        @if (isCoach()) {
          <ion-tab-button tab="bookings">
            <ion-icon name="calendar-outline"></ion-icon>
            <ion-label>Bookings</ion-label>
          </ion-tab-button>
        }

        <ion-tab-button tab="surveys">
          <ion-icon name="clipboard-outline"></ion-icon>
          <ion-label>Surveys</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="idp">
          <ion-icon name="trophy-outline"></ion-icon>
          <ion-label>My IDP</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="notifications">
          <ion-icon name="notifications-outline"></ion-icon>
          <ion-label>Alerts</ion-label>
          @if (unreadCount() > 0) {
            <ion-badge color="danger">{{ unreadCount() }}</ion-badge>
          }
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [
    `
      ion-tab-bar {
        --background: #ffffff;
        --border: 1px solid #e0e0e0;
      }
      ion-tab-button {
        --color-selected: #3a9fd6;
      }
    `,
  ],
})
export class TabsPage implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private offline = inject(OfflineService);
  private connectivity = inject(ConnectivityService);
  private router = inject(Router);

  unreadCount = signal(0);
  isCoach = computed(() => this.auth.currentUser()?.role === 'coach');

  constructor() {
    addIcons({
      chatbubblesOutline,
      calendarOutline,
      clipboardOutline,
      trophyOutline,
      notificationsOutline,
      personCircleOutline,
    });
  }

  ngOnInit() {
    this.loadUnreadCount();
    this.offline.syncQueue();

    // Re-sync queued mutations when coming back online
    const checkOnline = setInterval(() => {
      if (this.connectivity.isOnline()) {
        this.offline.syncQueue();
      }
    }, 30_000);
  }

  private loadUnreadCount() {
    this.api.get<{ unreadCount: number }>('/hub/unread-count').subscribe({
      next: (res) => this.unreadCount.set(res.unreadCount),
    });
  }
}
