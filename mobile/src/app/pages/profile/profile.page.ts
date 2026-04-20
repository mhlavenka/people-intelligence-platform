import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonButton,
  IonIcon,
  IonAvatar,
  IonNote,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline, personCircleOutline } from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PushService } from '../../core/push.service';

interface NotificationPreferences {
  sessionScheduled: boolean;
  sessionReminders: boolean;
  sessionForms: boolean;
  bookingConfirmed: boolean;
  bookingCancelled: boolean;
  bookingRescheduled: boolean;
  engagementCreated: boolean;
  directMessages: boolean;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonList,
    IonItem,
    IonLabel,
    IonToggle,
    IonButton,
    IonIcon,
    IonAvatar,
    IonNote,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/sessions"></ion-back-button>
        </ion-buttons>
        <ion-title>Profile & Settings</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="profile-header">
        <ion-avatar>
          <ion-icon name="person-circle-outline" class="avatar-icon"></ion-icon>
        </ion-avatar>
        <h2>{{ user()?.firstName }} {{ user()?.lastName }}</h2>
        <ion-note>{{ user()?.email }}</ion-note>
      </div>

      <h3>Language</h3>
      <ion-list>
        <ion-item>
          <ion-label>App Language</ion-label>
          <select (change)="changeLanguage($event)">
            <option value="en" [selected]="currentLang() === 'en'">English</option>
            <option value="fr" [selected]="currentLang() === 'fr'">Français</option>
            <option value="es" [selected]="currentLang() === 'es'">Español</option>
          </select>
        </ion-item>
      </ion-list>

      <h3>Push Notifications</h3>
      @if (prefs()) {
        <ion-list>
          <ion-item>
            <ion-toggle
              [(ngModel)]="prefs()!.sessionScheduled"
              (ionChange)="savePrefs()"
            >Session Scheduled</ion-toggle>
          </ion-item>
          <ion-item>
            <ion-toggle
              [(ngModel)]="prefs()!.sessionReminders"
              (ionChange)="savePrefs()"
            >Session Reminders</ion-toggle>
          </ion-item>
          <ion-item>
            <ion-toggle
              [(ngModel)]="prefs()!.sessionForms"
              (ionChange)="savePrefs()"
            >Session Forms</ion-toggle>
          </ion-item>
          <ion-item>
            <ion-toggle
              [(ngModel)]="prefs()!.bookingConfirmed"
              (ionChange)="savePrefs()"
            >Booking Confirmed</ion-toggle>
          </ion-item>
          <ion-item>
            <ion-toggle
              [(ngModel)]="prefs()!.bookingCancelled"
              (ionChange)="savePrefs()"
            >Booking Cancelled</ion-toggle>
          </ion-item>
          <ion-item>
            <ion-toggle
              [(ngModel)]="prefs()!.bookingRescheduled"
              (ionChange)="savePrefs()"
            >Booking Rescheduled</ion-toggle>
          </ion-item>
          <ion-item>
            <ion-toggle
              [(ngModel)]="prefs()!.directMessages"
              (ionChange)="savePrefs()"
            >Direct Messages</ion-toggle>
          </ion-item>
        </ion-list>
      }

      <ion-button expand="block" color="danger" fill="outline" (click)="logout()">
        <ion-icon name="log-out-outline" slot="start"></ion-icon>
        Sign Out
      </ion-button>
    </ion-content>
  `,
  styles: [
    `
      .profile-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 24px 0;
      }
      .avatar-icon {
        font-size: 64px;
        color: var(--ion-color-primary);
      }
      ion-avatar {
        width: 64px;
        height: 64px;
      }
      h2 {
        margin: 12px 0 4px;
        font-weight: 600;
      }
      h3 {
        margin: 24px 0 8px;
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--ion-color-medium);
        padding-left: 16px;
      }
      ion-button {
        margin-top: 32px;
      }
      select {
        padding: 8px;
        border-radius: 8px;
        border: 1px solid var(--ion-color-medium);
      }
    `,
  ],
})
export class ProfilePage implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private push = inject(PushService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  user = this.auth.currentUser;
  prefs = signal<NotificationPreferences | null>(null);
  currentLang = signal('en');

  constructor() {
    addIcons({ logOutOutline, personCircleOutline });
  }

  ngOnInit() {
    this.currentLang.set(this.translate.currentLang || 'en');
    this.api.get<NotificationPreferences>('/users/me/notification-preferences').subscribe({
      next: (p) => this.prefs.set(p),
    });
  }

  savePrefs() {
    const p = this.prefs();
    if (p) {
      this.api.put('/users/me/notification-preferences', p).subscribe();
    }
  }

  changeLanguage(event: Event) {
    const lang = (event.target as HTMLSelectElement).value;
    this.translate.use(lang);
    this.currentLang.set(lang);
  }

  async logout() {
    await this.push.unregister();
    this.auth.logout();
  }
}
