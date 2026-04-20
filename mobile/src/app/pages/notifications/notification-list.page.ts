import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonButtons,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonNote,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkDoneOutline } from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';

interface Notification {
  _id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [
    DatePipe,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonButtons,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonNote,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ 'NOTIFICATIONS.TITLE' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="markAllRead()">
            <ion-icon name="checkmark-done-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading()) {
        <ion-list>
          @for (i of [1, 2, 3, 4]; track i) {
            <ion-item>
              <ion-label>
                <ion-skeleton-text [animated]="true" style="width: 70%"></ion-skeleton-text>
                <ion-skeleton-text [animated]="true" style="width: 90%"></ion-skeleton-text>
              </ion-label>
            </ion-item>
          }
        </ion-list>
      } @else if (notifications().length === 0) {
        <div class="empty-state">
          <p>{{ 'NOTIFICATIONS.EMPTY' | translate }}</p>
        </div>
      } @else {
        <ion-list>
          @for (n of notifications(); track n._id) {
            <ion-item
              [button]="!!n.link"
              (click)="openNotification(n)"
              [class.unread]="!n.isRead"
            >
              <ion-label>
                <h2>{{ n.title }}</h2>
                <p>{{ n.body }}</p>
                <ion-note>{{ n.createdAt | date: 'short' }}</ion-note>
              </ion-label>
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [
    `
      .unread {
        --background: #ebf5fb;
      }
      .empty-state {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 50%;
        color: var(--ion-color-medium);
      }
    `,
  ],
})
export class NotificationListPage implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  notifications = signal<Notification[]>([]);
  loading = signal(true);

  constructor() {
    addIcons({ checkmarkDoneOutline });
  }

  ngOnInit() {
    this.loadNotifications();
  }

  refresh(event: any) {
    this.loadNotifications(() => event.target.complete());
  }

  openNotification(n: Notification) {
    if (!n.isRead) {
      this.api.put(`/hub/notifications/${n._id}/read`).subscribe();
      n.isRead = true;
    }
    if (n.link) {
      this.router.navigateByUrl(n.link);
    }
  }

  markAllRead() {
    this.api.put('/hub/notifications/read-all').subscribe({
      next: () => {
        this.notifications.update((list) =>
          list.map((n) => ({ ...n, isRead: true }))
        );
      },
    });
  }

  private loadNotifications(onComplete?: () => void) {
    this.loading.set(true);
    this.api.get<Notification[]>('/hub/notifications').subscribe({
      next: (notifications) => {
        this.notifications.set(notifications);
        this.loading.set(false);
        onComplete?.();
      },
      error: () => {
        this.loading.set(false);
        onComplete?.();
      },
    });
  }
}
