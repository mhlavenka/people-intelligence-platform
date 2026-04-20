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
  IonBadge,
  IonButton,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonFab,
  IonFabButton,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  ActionSheetController,
} from '@ionic/angular/standalone';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline } from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';

interface Booking {
  _id: string;
  startTime: string;
  endTime: string;
  clientTimezone: string;
  topic?: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  coachId: { firstName: string; lastName: string };
  meetingLink?: string;
  googleMeetLink?: string;
}

@Component({
  selector: 'app-booking-list',
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
    IonBadge,
    IonButton,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonFab,
    IonFabButton,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ 'BOOKINGS.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading()) {
        <ion-list>
          @for (i of [1, 2, 3]; track i) {
            <ion-item>
              <ion-label>
                <ion-skeleton-text [animated]="true" style="width: 60%"></ion-skeleton-text>
                <ion-skeleton-text [animated]="true" style="width: 40%"></ion-skeleton-text>
              </ion-label>
            </ion-item>
          }
        </ion-list>
      } @else if (bookings().length === 0) {
        <div class="empty-state">
          <p>{{ 'BOOKINGS.EMPTY' | translate }}</p>
          <ion-button (click)="newBooking()">
            <ion-icon name="add-outline" slot="start"></ion-icon>
            Book a Session
          </ion-button>
        </div>
      } @else {
        <ion-list>
          @for (booking of bookings(); track booking._id) {
            <ion-item-sliding>
              <ion-item>
                <ion-label>
                  <h2>{{ booking.coachId.firstName }} {{ booking.coachId.lastName }}</h2>
                  <p>{{ booking.startTime | date: 'medium' }}</p>
                  @if (booking.topic) {
                    <p class="topic">{{ booking.topic }}</p>
                  }
                </ion-label>
                <ion-badge slot="end" [color]="booking.status === 'confirmed' ? 'success' : 'medium'">
                  {{ booking.status }}
                </ion-badge>
              </ion-item>
              @if (booking.status === 'confirmed') {
                <ion-item-options side="end">
                  <ion-item-option color="danger" (click)="cancelBooking(booking._id)">
                    <ion-icon name="close-outline" slot="icon-only"></ion-icon>
                  </ion-item-option>
                </ion-item-options>
              }
            </ion-item-sliding>
          }
        </ion-list>
      }

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button (click)="newBooking()">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 50%;
        color: var(--ion-color-medium);
      }
      .topic {
        font-style: italic;
        color: var(--ion-color-medium);
      }
    `,
  ],
})
export class BookingListPage implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private actionSheet = inject(ActionSheetController);

  bookings = signal<Booking[]>([]);
  loading = signal(true);

  constructor() {
    addIcons({ addOutline, closeOutline });
  }

  ngOnInit() {
    this.loadBookings();
  }

  refresh(event: any) {
    this.loadBookings(() => event.target.complete());
  }

  newBooking() {
    this.router.navigate(['/tabs/bookings/new']);
  }

  async cancelBooking(id: string) {
    const sheet = await this.actionSheet.create({
      header: 'Cancel this booking?',
      buttons: [
        {
          text: 'Cancel Booking',
          role: 'destructive',
          handler: () => {
            Haptics.impact({ style: ImpactStyle.Medium });
            this.api.delete(`/booking/bookings/${id}`).subscribe({
              next: () => this.loadBookings(),
            });
          },
        },
        { text: 'Keep Booking', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private loadBookings(onComplete?: () => void) {
    this.loading.set(true);
    this.api.get<{ bookings: Booking[] }>('/booking/bookings', { tab: 'upcoming' }).subscribe({
      next: (res) => {
        this.bookings.set(res.bookings || []);
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
