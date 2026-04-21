import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonChip, IonLabel, IonSkeletonText, IonIcon, IonButton,
  IonDatetime, IonSpinner, IonList, IonItem, IonRadioGroup, IonRadio,
  ActionSheetController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  timeOutline, personOutline, documentTextOutline, createOutline,
  checkmarkCircleOutline, closeCircleOutline, calendarOutline,
} from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';

interface SessionDetail {
  _id: string;
  date: string;
  duration: number;
  format: string;
  status: string;
  topics: string[];
  sharedNotes?: string;
  coachId: { _id: string; firstName: string; lastName: string };
  growFocus?: string[];
  preSessionRating?: number;
  postSessionRating?: number;
  preSessionIntakeTemplateId?: { _id: string; title: string } | string;
  postSessionIntakeTemplateId?: { _id: string; title: string } | string;
  preSessionIntakeCompleted?: boolean;
  postSessionIntakeCompleted?: boolean;
  bookingId?: string | { _id: string };
}

interface AvailableSlot {
  startUtc: string;
  endUtc: string;
  label: string;
}

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [
    FormsModule, DatePipe, TitleCasePipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonChip, IonLabel, IonSkeletonText, IonIcon, IonButton,
    IonDatetime, IonSpinner, IonList, IonItem, IonRadioGroup, IonRadio,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/sessions"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'SESSIONS.DETAIL' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (loading()) {
        <ion-card>
          <ion-card-content>
            <ion-skeleton-text [animated]="true" style="width: 80%"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true" style="width: 60%"></ion-skeleton-text>
          </ion-card-content>
        </ion-card>
      } @else if (session()) {
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              {{ session()!.coachId.firstName }} {{ session()!.coachId.lastName }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p>
              <ion-icon name="time-outline"></ion-icon>
              {{ session()!.date | date: 'full' }} ({{ session()!.duration }} min)
            </p>
            <p>
              <ion-icon name="person-outline"></ion-icon>
              {{ session()!.format | titlecase }}
            </p>

            @if (session()!.topics.length) {
              <div class="topics">
                @for (topic of session()!.topics; track topic) {
                  <ion-chip>
                    <ion-label>{{ topic }}</ion-label>
                  </ion-chip>
                }
              </div>
            }

            @if (session()!.growFocus?.length) {
              <div class="grow-focus">
                <h3>GROW Focus</h3>
                @for (focus of session()!.growFocus; track focus) {
                  <ion-chip color="secondary">
                    <ion-label>{{ focus | titlecase }}</ion-label>
                  </ion-chip>
                }
              </div>
            }
          </ion-card-content>
        </ion-card>

        <!-- Cancel / Reschedule actions for scheduled sessions with a booking -->
        @if (session()!.status === 'scheduled' && bookingId()) {
          @if (rescheduleStep() === 'idle') {
            <div class="action-buttons">
              <ion-button expand="block" color="tertiary" (click)="startReschedule()">
                <ion-icon name="calendar-outline" slot="start"></ion-icon>
                {{ 'SESSIONS.RESCHEDULE' | translate }}
              </ion-button>
              <ion-button expand="block" color="danger" fill="outline" (click)="cancelSession()">
                <ion-icon name="close-circle-outline" slot="start"></ion-icon>
                {{ 'SESSIONS.CANCEL' | translate }}
              </ion-button>
            </div>
          }

          @if (rescheduleStep() === 'date') {
            <ion-card>
              <ion-card-header>
                <ion-card-title>{{ 'SESSIONS.RESCHEDULE_PICK_DATE' | translate }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-datetime
                  presentation="date"
                  [min]="minDate"
                  (ionChange)="onRescheduleDate($event)"
                ></ion-datetime>
                <ion-button fill="clear" (click)="rescheduleStep.set('idle')">
                  {{ 'SESSIONS.CANCEL_ACTION' | translate }}
                </ion-button>
              </ion-card-content>
            </ion-card>
          }

          @if (rescheduleStep() === 'slot') {
            <ion-card>
              <ion-card-header>
                <ion-card-title>{{ 'SESSIONS.RESCHEDULE_PICK_TIME' | translate }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                @if (loadingSlots()) {
                  <div class="spinner-center"><ion-spinner></ion-spinner></div>
                } @else if (rescheduleSlots().length === 0) {
                  <p>{{ 'BOOKINGS.NO_SLOTS' | translate }}</p>
                  <ion-button fill="outline" (click)="rescheduleStep.set('date')">
                    {{ 'SESSIONS.PICK_ANOTHER_DATE' | translate }}
                  </ion-button>
                } @else {
                  <ion-list>
                    <ion-radio-group [(ngModel)]="selectedSlot">
                      @for (slot of rescheduleSlots(); track slot.startUtc) {
                        <ion-item>
                          <ion-icon name="time-outline" slot="start" color="medium"></ion-icon>
                          <ion-radio [value]="slot">{{ slot.label }}</ion-radio>
                        </ion-item>
                      }
                    </ion-radio-group>
                  </ion-list>
                  <ion-button expand="block" [disabled]="!selectedSlot || submitting()" (click)="confirmReschedule()">
                    @if (submitting()) {
                      <ion-spinner name="crescent"></ion-spinner>
                    } @else {
                      {{ 'SESSIONS.CONFIRM_RESCHEDULE' | translate }}
                    }
                  </ion-button>
                  <ion-button fill="clear" expand="block" (click)="rescheduleStep.set('idle')">
                    {{ 'SESSIONS.CANCEL_ACTION' | translate }}
                  </ion-button>
                }
              </ion-card-content>
            </ion-card>
          }
        }

        @if (hasPreIntake()) {
          <ion-button
            expand="block"
            [fill]="session()!.preSessionIntakeCompleted ? 'outline' : 'solid'"
            [color]="session()!.preSessionIntakeCompleted ? 'medium' : 'primary'"
            (click)="openIntake('pre')"
          >
            <ion-icon [name]="session()!.preSessionIntakeCompleted ? 'checkmark-circle-outline' : 'create-outline'" slot="start"></ion-icon>
            {{ (session()!.preSessionIntakeCompleted ? 'SESSIONS.PRE_FORM_DONE' : 'SESSIONS.PRE_FORM') | translate }}
          </ion-button>
        }

        @if (hasPostIntake()) {
          <ion-button
            expand="block"
            [fill]="session()!.postSessionIntakeCompleted ? 'outline' : 'solid'"
            [color]="session()!.postSessionIntakeCompleted ? 'medium' : 'secondary'"
            (click)="openIntake('post')"
          >
            <ion-icon [name]="session()!.postSessionIntakeCompleted ? 'checkmark-circle-outline' : 'create-outline'" slot="start"></ion-icon>
            {{ (session()!.postSessionIntakeCompleted ? 'SESSIONS.POST_FORM_DONE' : 'SESSIONS.POST_FORM') | translate }}
          </ion-button>
        }

        @if (session()!.sharedNotes) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon name="document-text-outline"></ion-icon>
                {{ 'SESSIONS.SHARED_NOTES' | translate }}
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p class="notes-text">{{ session()!.sharedNotes }}</p>
            </ion-card-content>
          </ion-card>
        }
      }
    </ion-content>
  `,
  styles: [`
    .topics, .grow-focus { margin-top: 12px; }
    .grow-focus h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
    .notes-text { white-space: pre-wrap; line-height: 1.5; }
    ion-icon { vertical-align: middle; margin-right: 4px; }
    .action-buttons { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
    .action-buttons ion-button { margin: 0; }
    .spinner-center { display: flex; justify-content: center; padding: 32px; }
  `],
})
export class SessionDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private actionSheet = inject(ActionSheetController);
  private translate = inject(TranslateService);

  session = signal<SessionDetail | null>(null);
  loading = signal(true);

  rescheduleStep = signal<'idle' | 'date' | 'slot'>('idle');
  rescheduleSlots = signal<AvailableSlot[]>([]);
  loadingSlots = signal(false);
  submitting = signal(false);
  selectedSlot: AvailableSlot | null = null;
  minDate = new Date().toISOString();
  private rescheduleDate = '';

  constructor() {
    addIcons({
      timeOutline, personOutline, documentTextOutline, createOutline,
      checkmarkCircleOutline, closeCircleOutline, calendarOutline,
    });
  }

  bookingId(): string | null {
    const s = this.session();
    if (!s?.bookingId) return null;
    return typeof s.bookingId === 'string' ? s.bookingId : s.bookingId._id;
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api.get<SessionDetail>(`/coaching/sessions/${id}`).subscribe({
        next: (s) => { this.session.set(s); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    }
  }

  hasPreIntake(): boolean {
    return !!this.session()?.preSessionIntakeTemplateId;
  }

  hasPostIntake(): boolean {
    return !!this.session()?.postSessionIntakeTemplateId;
  }

  openIntake(type: 'pre' | 'post') {
    const s = this.session();
    if (!s) return;
    const templateRef = type === 'pre' ? s.preSessionIntakeTemplateId : s.postSessionIntakeTemplateId;
    const templateId = typeof templateRef === 'string' ? templateRef : templateRef?._id;
    if (!templateId) return;
    this.router.navigate(['/tabs/sessions', s._id, 'intake', templateId], {
      queryParams: { type },
    });
  }

  async cancelSession() {
    const bid = this.bookingId();
    if (!bid) return;

    const sheet = await this.actionSheet.create({
      header: this.translate.instant('SESSIONS.CANCEL_CONFIRM'),
      buttons: [
        {
          text: this.translate.instant('SESSIONS.CANCEL_YES'),
          role: 'destructive',
          handler: () => {
            Haptics.impact({ style: ImpactStyle.Medium });
            this.api.delete(`/booking/bookings/${bid}`).subscribe({
              next: () => {
                Haptics.notification({ type: NotificationType.Success });
                this.router.navigate(['/tabs/sessions']);
              },
            });
          },
        },
        { text: this.translate.instant('SESSIONS.CANCEL_NO'), role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  startReschedule() {
    this.rescheduleStep.set('date');
    this.selectedSlot = null;
    this.rescheduleSlots.set([]);
  }

  onRescheduleDate(event: any) {
    this.rescheduleDate = event.detail.value?.split('T')[0] || event.detail.value;
    this.rescheduleStep.set('slot');
    this.loadRescheduleSlots();
  }

  confirmReschedule() {
    const bid = this.bookingId();
    if (!bid || !this.selectedSlot) return;

    this.submitting.set(true);
    this.api.patch(`/booking/bookings/${bid}/reschedule`, {
      newStartTime: this.selectedSlot.startUtc,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        Haptics.notification({ type: NotificationType.Success });
        this.rescheduleStep.set('idle');
        this.reloadSession();
      },
      error: () => this.submitting.set(false),
    });
  }

  private loadRescheduleSlots() {
    const bid = this.bookingId();
    if (!bid || !this.rescheduleDate) return;

    this.loadingSlots.set(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.api.get<AvailableSlot[]>(`/booking/bookings/${bid}/slots`, {
      from: this.rescheduleDate,
      to: this.rescheduleDate,
      tz,
    }).subscribe({
      next: (slots) => { this.rescheduleSlots.set(slots); this.loadingSlots.set(false); },
      error: () => this.loadingSlots.set(false),
    });
  }

  private reloadSession() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.api.get<SessionDetail>(`/coaching/sessions/${id}`).subscribe({
      next: (s) => this.session.set(s),
    });
  }
}
