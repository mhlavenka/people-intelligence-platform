import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { SessionDialogComponent } from '../session-dialog/session-dialog.component';
import { CoachPickerDialogComponent, CoachPick } from '../coach-picker-dialog/coach-picker-dialog.component';
import { CoachLandingComponent } from '../../booking/coach-landing/coach-landing.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { JournalService, SessionNote } from '../../journal/journal.service';
import { RescheduleDialogComponent, RescheduleDialogResult } from '../../booking/reschedule-dialog/reschedule-dialog.component';
import { CancelDialogComponent, CancelDialogResult } from '../../booking/cancel-dialog/cancel-dialog.component';
import { BookingService, BookingRecord } from '../../booking/booking.service';
import { SurveyResponsesDialogComponent, SurveyTemplate as IntakeTemplate } from '../../survey/survey-responses-dialog/survey-responses-dialog.component';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
interface Session {
  _id: string;
  date: string;
  duration: number;
  format: string;
  growFocus: string[];
  frameworks: string[];
  coachNotes: string;
  sharedNotes: string;
  preSessionRating?: number;
  postSessionRating?: number;
  topics: string[];
  status: string;
  isChemistryCall?: boolean;
  googleMeetLink?: string;
  createdAt: string;
  createdVia?: 'coach' | 'coachee_booking';
  bookingId?: string;
  preSessionIntakeTemplateId?: { _id: string; title: string; moduleType?: string } | string | null;
  preSessionIntakeCompleted?: boolean;
  preSessionIntakeSentAt?: string;
  postSessionIntakeTemplateId?: { _id: string; title: string } | string | null;
  postSessionIntakeSentAt?: string;
  postSessionIntakeCompleted?: boolean;
}

@Component({
  selector: 'app-engagement-detail',
  standalone: true,
  imports: [
    CommonModule, DatePipe, CurrencyPipe, RouterLink, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatDividerModule, MatSnackBarModule, MatTooltipModule,
    TranslateModule,
  ],
  template: `
    <div class="detail-page">
      <div class="page-header">
        @if (canManage()) {
          <a routerLink="/coaching" class="back-link"><mat-icon>arrow_back</mat-icon> {{ 'COACHING.coaching' | translate }}</a>
        }
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (engagement()) {
        <!-- Lifecycle prompt: completed chemistry call → suggest advancing to 'contracted' -->
        @if (canManage() && shouldAdvanceFromProspect()) {
          <div class="lifecycle-banner">
            <mat-icon>handshake</mat-icon>
            <div class="banner-text">
              <strong>{{ 'COACHING.advanceToContractedTitle' | translate }}</strong>
              <span>{{ 'COACHING.advanceToContractedDesc' | translate }}</span>
            </div>
            <button mat-flat-button color="primary"
                    (click)="advanceToContracted()"
                    [disabled]="advancing()">
              @if (advancing()) { <mat-spinner diameter="14" /> }
              {{ 'COACHING.advanceToContractedAction' | translate }}
            </button>
          </div>
        }
        <div class="detail-layout">

          <!-- Sidebar -->
          <div class="sidebar-col">
          <div class="info-card">
            <div class="coachee-block">
              @if (engagement()!.coacheeId?.profilePicture) {
                <img class="avatar avatar-img" [src]="engagement()!.coacheeId.profilePicture" alt="" />
              } @else {
                <div class="avatar">{{ initials() }}</div>
              }
              <h2>{{ coacheeName() }}</h2>
              <span class="status-chip" [style.background]="statusColor() + '18'" [style.color]="statusColor()">
                {{ translateStatus(engagement()!.status) }}
              </span>
            </div>
            <mat-divider />
            <div class="info-list">
              <div class="info-item"><span class="info-label">{{ 'COACHING.sessions' | translate }}</span><span>{{ engagement()!.sessionsUsed }} / {{ engagement()!.sessionsPurchased }}</span></div>
              @if (engagement()!.cadence) { <div class="info-item"><span class="info-label">{{ 'COACHING.cadence' | translate }}</span><span>{{ translateCadence(engagement()!.cadence) }}</span></div> }
              @if (engagement()!.startDate) { <div class="info-item"><span class="info-label">{{ 'COACHING.started' | translate }}</span><span>{{ engagement()!.startDate | date:'MMM d, y' }}</span></div> }
              @if (engagement()!.sponsorId?.name) {
                <div class="info-item">
                  <span class="info-label">{{ 'COACHING.sponsor' | translate }}</span>
                  <span>{{ engagement()!.sponsorId.name }}</span>
                </div>
              }
            </div>
            @if (engagement()!.goals?.length) {
              <mat-divider />
              <div class="goals-block">
                <span class="info-label">{{ 'COACHING.goals' | translate }}</span>
                @for (g of engagement()!.goals; track g) {
                  <span class="goal-chip">{{ g }}</span>
                }
              </div>
            }
            @if (engagement()!.notes && canManage()) {
              <mat-divider />
              <div class="notes-block">
                <span class="info-label">{{ 'COACHING.privatNotes' | translate }}</span>
                <p>{{ engagement()!.notes }}</p>
              </div>
            }
            @if (canManage()) {
              <mat-divider />
              <div class="billing-block">
                <span class="info-label">{{ 'COACHING.billing' | translate }}</span>
                <div class="billing-row">
                  <mat-icon>receipt_long</mat-icon>
                  @if (engagement()!.billingMode === 'sponsor' && engagement()!.sponsorId?._id) {
                    <span>{{ 'COACHING.sponsorPays' | translate }}</span>
                  } @else {
                    <span>{{ 'COACHING.coveredBySubscription' | translate }}</span>
                  }
                </div>
                @if (engagement()!.billingMode === 'sponsor' && engagementHourlyRate()) {
                  <div class="billing-rate">{{ engagementHourlyRate() | currency:'CAD':'symbol':'1.2-2' }} {{ 'COACHING.perHour' | translate }}</div>
                }
                @if (engagement()!.billingMode === 'sponsor' && engagement()!.sponsorId?._id) {
                  <a class="billing-link" [routerLink]="['/billing/sponsors', engagement()!.sponsorId._id]">
                    <mat-icon>open_in_new</mat-icon> {{ 'COACHING.sponsorBilling' | translate }}
                  </a>
                }
              </div>
            }
            @if (canManage()) {
              <mat-divider />
              <div class="journal-block">
                <a class="journal-link" [routerLink]="'/journal/engagement/' + engagement()!._id">
                  <mat-icon>auto_stories</mat-icon> {{ 'COACHING.sessionJournal' | translate }}
                </a>
              </div>
            }
            @if (!canManage() && engagement()!.coachId) {
              <mat-divider />
              <div class="info-list">
                <div class="info-item"><span class="info-label">{{ 'COACHING.coach' | translate }}</span><span>{{ coachFullName() }}</span></div>
              </div>
            }
          </div>

          <!-- Coachee: mini calendar (Book a Session moved into the session list as a + tile) -->
          @if (!canManage()) {
            <div class="coachee-calendar">
              <div class="cal-card">
                <div class="cal-header-row">
                  <button mat-icon-button (click)="prevMonth()"><mat-icon>chevron_left</mat-icon></button>
                  <span class="cal-month-label">{{ calMonthLabel() }}</span>
                  <button mat-icon-button (click)="nextMonth()"><mat-icon>chevron_right</mat-icon></button>
                </div>
                <div class="cal-grid">
                  @for (d of dayHeaders; track d) { <div class="cal-day-hdr">{{ d }}</div> }
                  @for (day of calendarDays(); track day.date.toISOString()) {
                    <div class="cal-cell" [class.other]="!day.isCurrentMonth" [class.today]="day.isToday">
                      <span class="cal-num">{{ day.date.getDate() }}</span>
                      @for (s of day.sessions; track s._id) {
                        <span class="cal-dot" [class]="s.status" [matTooltip]="(s.date | date:'h:mm a') || ''"></span>
                      }
                    </div>
                  }
                </div>
                @if (upcomingSessions().length > 0) {
                  <div class="cal-upcoming">
                    <h4>{{ 'COACHING.upcoming' | translate }}</h4>
                    @for (s of upcomingSessions(); track s._id) {
                      <div class="upcoming-row">
                        <span class="upcoming-date">{{ s.date | date:'MMM d' }}</span>
                        <span class="upcoming-time">{{ s.date | date:'h:mm a' }}</span>
                        <span class="upcoming-dur">{{ s.duration }}m · {{ translateFormat(s.format) }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
          </div>

          <!-- Sessions timeline -->
          <div class="sessions-col">
            <h3>
              {{ 'COACHING.sessions' | translate }}
              <span class="session-count">{{ filteredSessions().length }}</span>
              @if (filteredSessions().length !== sessions().length) {
                <span class="session-count-muted">{{ 'COACHING.ofTotal' | translate }} {{ sessions().length }}</span>
              }
            </h3>

            @if (sessions().length > 0) {
              <div class="session-filter-pills">
                @for (p of statusPills; track p.key) {
                  <button type="button" class="pill"
                          [class.active]="isStatusActive(p.key)"
                          (click)="toggleStatus(p.key)">
                    <mat-icon>{{ p.icon }}</mat-icon>
                    {{ p.labelKey | translate }}
                    <span class="pill-count">{{ statusCount(p.key) }}</span>
                  </button>
                }
                @if (hasFilterChanges()) {
                  <button type="button" class="pill pill-reset" (click)="resetStatusFilter()">
                    <mat-icon>close</mat-icon> {{ 'COACHING.reset' | translate }}
                  </button>
                }
              </div>
            }

            @if (sessions().length === 0) {
              <div class="empty-sessions">
                <mat-icon>event_note</mat-icon>
                <p>{{ 'COACHING.noSessionsRecorded' | translate }}</p>
              </div>
            } @else if (filteredSessions().length === 0) {
              <div class="empty-sessions">
                <mat-icon>filter_alt_off</mat-icon>
                <p>{{ 'COACHING.noSessionsMatchFilter' | translate }}</p>
              </div>
            }

            @for (s of filteredSessions(); track s._id) {
              <div class="session-card" [class]="'status-' + s.status">
                <div class="session-layout">
                  <!-- Left: session details -->
                  <div class="session-left">
                    <div class="session-header">
                      <div class="session-date">
                        <mat-icon>event</mat-icon>
                        <strong>{{ s.date | date:'MMM d, y — h:mm a' }}</strong>
                      </div>
                      <span class="session-duration">{{ s.duration }} {{ 'COACHING.min' | translate }} · {{ translateFormat(s.format) }}</span>
                      <span class="session-status" [class]="s.status">{{ translateSessionStatus(s.status) }}</span>
                      @if (s.isChemistryCall) {
                        <span class="chem-chip"
                              [matTooltip]="'COACHING.chemistryCallTooltip' | translate">
                          <mat-icon>coffee</mat-icon> {{ 'COACHING.chemistryCall' | translate }}
                        </span>
                      }
                      @if (s.createdVia === 'coachee_booking') {
                        <span class="source-chip booked"
                              [matTooltip]="'COACHING.coacheeBookedTooltip' | translate">
                          <mat-icon>person</mat-icon> {{ 'COACHING.coacheeBooked' | translate }}
                        </span>
                      } @else {
                        <span class="source-chip scheduled"
                              [matTooltip]="'COACHING.coachScheduledTooltip' | translate">
                          <mat-icon>edit_calendar</mat-icon> {{ 'COACHING.coachScheduled' | translate }}
                        </span>
                      }
                      @if (canManage()) {
                        @if (s.status === 'scheduled') {
                          <button mat-stroked-button class="mark-complete-btn"
                                  [matTooltip]="'COACHING.markCompleteTooltip' | translate"
                                  (click)="markSessionComplete(s)"
                                  [disabled]="markingCompleteFor() === s._id">
                            @if (markingCompleteFor() === s._id) {
                              <mat-spinner diameter="14" />
                            } @else {
                              <mat-icon>task_alt</mat-icon>
                            }
                            {{ 'COACHING.markSessionComplete' | translate }}
                          </button>
                        }
                        <button mat-icon-button [matTooltip]="'COACHING.editTooltip' | translate" (click)="editSession(s)"><mat-icon>edit</mat-icon></button>
                        @if (s.status === 'scheduled' && s.bookingId) {
                          <button mat-icon-button [matTooltip]="'COACHING.cancelSession' | translate" class="del-btn"
                                  (click)="coachCancelSession(s)">
                            <mat-icon>event_busy</mat-icon>
                          </button>
                        }
                        <button mat-icon-button [matTooltip]="'COACHING.deleteTooltip' | translate" class="del-btn" (click)="deleteSession(s)"><mat-icon>delete_outline</mat-icon></button>
                      }
                      @if (canCoacheeManage(s)) {
                        @if (canCoacheeReschedule(s)) {
                          <button mat-icon-button [matTooltip]="'COACHING.rescheduleTooltip' | translate"
                                  (click)="coacheeReschedule(s)">
                            <mat-icon>event_repeat</mat-icon>
                          </button>
                        }
                        <button mat-icon-button
                                [matTooltip]="isLateCancellation(s) ? ('COACHING.cancelCountsAsUsed' | translate) : ('COACHING.cancel' | translate)"
                                class="del-btn"
                                (click)="coacheeCancel(s)">
                          <mat-icon>event_busy</mat-icon>
                        </button>
                      }
                    </div>

                    @if (s.googleMeetLink) {
                      <a class="meet-link" [href]="s.googleMeetLink" target="_blank" rel="noopener">
                        <mat-icon>videocam</mat-icon> {{ 'COACHING.joinGoogleMeet' | translate }}
                      </a>
                    }

                    @if (s.topics.length) {
                      <div class="session-topics">
                        @for (t of s.topics; track t) { <span class="topic-chip">{{ t }}</span> }
                      </div>
                    }

                    @if (s.growFocus.length) {
                      <div class="grow-tags">
                        @for (g of s.growFocus; track g) {
                          <span class="grow-tag" [class]="g">{{ g | titlecase }}</span>
                        }
                      </div>
                    }

                    @if (s.sharedNotes) {
                      <div class="notes-section shared">
                        <span class="notes-label"><mat-icon>visibility</mat-icon> {{ 'COACHING.sharedNotesLabel' | translate }}</span>
                        <p>{{ s.sharedNotes }}</p>
                      </div>
                    }

                    @if (preSessionIntakeTitle(s); as intakeTitle) {
                      @if (!canManage() && !s.preSessionIntakeCompleted && s.status === 'scheduled') {
                        @if (isIntakeAccessible(s)) {
                          <a class="intake-card coachee-action"
                             [routerLink]="['/intake', preSessionIntakeTemplateId(s)]"
                             [queryParams]="{ sessionId: s._id }">
                            <mat-icon>assignment</mat-icon>
                            <div class="intake-body">
                              <div class="intake-title">{{ 'COACHING.completePreReflection' | translate }}</div>
                              <div class="intake-sub">{{ intakeTitle }}</div>
                            </div>
                            <mat-icon class="chev">chevron_right</mat-icon>
                          </a>
                        } @else {
                          <div class="intake-card locked">
                            <mat-icon>lock_clock</mat-icon>
                            <div class="intake-body">
                              <div class="intake-title">{{ 'COACHING.preSessionForm' | translate }}</div>
                              <div class="intake-sub">{{ 'COACHING.preSessionFormLocked' | translate }}</div>
                            </div>
                          </div>
                        }
                      } @else {
                        <div class="intake-card status"
                             [class.completed]="s.preSessionIntakeCompleted">
                          <mat-icon>{{ s.preSessionIntakeCompleted ? 'check_circle' : 'schedule' }}</mat-icon>
                          <div class="intake-body">
                            <div class="intake-title">
                              {{ s.preSessionIntakeCompleted
                                ? ('COACHING.preSessionAssessmentCompleted' | translate)
                                : ('COACHING.preSessionAssessmentPending' | translate) }}
                            </div>
                            <div class="intake-sub">{{ intakeTitle }}</div>
                          </div>
                          @if (s.preSessionIntakeCompleted && canManage()) {
                            <button mat-stroked-button class="intake-view-btn"
                                    (click)="viewIntakeResponse(s)">
                              <mat-icon>visibility</mat-icon> {{ 'COACHING.viewResults' | translate }}
                            </button>
                          }
                        </div>
                      }
                    }

                    <!-- Post-session form -->
                    @if (s.status === 'completed' || s.status === 'no_show') {
                      @if (s.postSessionIntakeTemplateId) {
                        @if (!canManage() && !s.postSessionIntakeCompleted) {
                          <a class="intake-card coachee-action post"
                             [routerLink]="['/intake', postSessionIntakeTemplateId(s)]"
                             [queryParams]="{ sessionId: s._id }">
                            <mat-icon>rate_review</mat-icon>
                            <div class="intake-body">
                              <div class="intake-title">{{ 'COACHING.completePostReflection' | translate }}</div>
                              <div class="intake-sub">{{ 'COACHING.postReflectionCapture' | translate }}</div>
                            </div>
                            <mat-icon class="chev">chevron_right</mat-icon>
                          </a>
                        } @else {
                          <div class="intake-card status"
                               [class.completed]="s.postSessionIntakeCompleted">
                            <mat-icon>{{ s.postSessionIntakeCompleted ? 'check_circle' : 'schedule' }}</mat-icon>
                            <div class="intake-body">
                              <div class="intake-title">
                                {{ s.postSessionIntakeCompleted
                                    ? ('COACHING.postReflectionCompleted' | translate)
                                    : ('COACHING.postReflectionSent' | translate) }}
                              </div>
                              <div class="intake-sub">{{ s.postSessionIntakeSentAt | date:'MMM d, y' }}</div>
                            </div>
                            @if (s.postSessionIntakeCompleted && canManage()) {
                              <button mat-stroked-button class="intake-view-btn"
                                      (click)="viewPostIntakeResponse(s)">
                                <mat-icon>visibility</mat-icon> {{ 'COACHING.viewResults' | translate }}
                              </button>
                            }
                          </div>
                        }
                      } @else if (canManage()) {
                        <div class="intake-card generate-post" (click)="generatePostSessionForm(s)">
                          <mat-icon>auto_awesome</mat-icon>
                          <div class="intake-body">
                            <div class="intake-title">{{ 'COACHING.sendPostReflection' | translate }}</div>
                            <div class="intake-sub">
                              {{ (s.topics.length || s.sharedNotes || s.coachNotes)
                                  ? ('COACHING.generateFromNotes' | translate)
                                  : ('COACHING.provideTopicSummary' | translate) }}
                            </div>
                          </div>
                          @if (generatingPostFor() === s._id) {
                            <mat-spinner diameter="18" />
                          } @else {
                            <mat-icon class="chev">send</mat-icon>
                          }
                        </div>
                      }
                    }

                    @if (s.coachNotes && canManage()) {
                      <div class="notes-section private">
                        <span class="notes-label"><mat-icon>lock</mat-icon> {{ 'COACHING.privateNotesLabel' | translate }}</span>
                        <p>{{ s.coachNotes }}</p>
                      </div>
                    }

                    <div class="session-footer">
                      @if (s.preSessionRating) {
                        <span class="rating">
                          <span class="rating-label">{{ 'COACHING.mood' | translate }}</span>
                          @for (i of [1,2,3,4,5,6,7,8,9,10]; track i) {
                            <mat-icon class="star-sm" [class.filled]="i <= s.preSessionRating!">{{ i <= s.preSessionRating! ? 'star' : 'star_border' }}</mat-icon>
                          }
                        </span>
                      }
                      @if (s.postSessionRating) {
                        <span class="rating">
                          <span class="rating-label">{{ 'COACHING.rating' | translate }}</span>
                          @for (i of [1,2,3,4,5]; track i) {
                            <mat-icon class="star-sm" [class.filled]="i <= s.postSessionRating!">{{ i <= s.postSessionRating! ? 'star' : 'star_border' }}</mat-icon>
                          }
                        </span>
                      }
                    </div>
                  </div>

                  <!-- Right: journal note (coach + coachee variants) -->
                  <div class="session-right">
                    @if (noteFor(s._id); as note) {
                      <div class="journal-panel">
                        <div class="journal-header">
                          <mat-icon>auto_stories</mat-icon>
                          <span class="journal-label">{{ 'COACHING.noteLabel' | translate:{ number: note.sessionNumber } }}</span>
                          <span class="journal-status" [class]="note.status">{{ translateJournalStatus(note.status) }}</span>
                          @if (canManage()) {
                            <button mat-icon-button (click)="openJournalNote(note._id)" [matTooltip]="'COACHING.openJournalNote' | translate" class="journal-open-btn">
                              <mat-icon>open_in_new</mat-icon>
                            </button>
                          } @else {
                            <a mat-icon-button [routerLink]="'/my-journal/engagement/' + engId"
                               [queryParams]="{ sessionId: s._id }"
                               [matTooltip]="'COACHING.openSessionJournal' | translate" class="journal-open-btn">
                              <mat-icon>open_in_new</mat-icon>
                            </a>
                          }
                        </div>

                        @if (canManage()) {
                          @if (note.preSession?.agenda) {
                            <div class="journal-field">
                              <span class="journal-field-label">{{ 'COACHING.agenda' | translate }}</span>
                              <p>{{ note.preSession!.agenda! | slice:0:120 }}{{ note.preSession!.agenda!.length > 120 ? '...' : '' }}</p>
                            </div>
                          } @else if (note.coacheePre?.mainTopic) {
                            <div class="journal-field">
                              <span class="journal-field-label">{{ 'COACHING.mainTopicLabel' | translate }}</span>
                              <p>{{ note.coacheePre!.mainTopic! | slice:0:120 }}{{ note.coacheePre!.mainTopic!.length > 120 ? '...' : '' }}</p>
                            </div>
                          }
                          @if (note.inSession?.observations) {
                            <div class="journal-field">
                              <span class="journal-field-label">{{ 'COACHING.observations' | translate }}</span>
                              <p>{{ note.inSession!.observations! | slice:0:150 }}{{ note.inSession!.observations!.length > 150 ? '...' : '' }}</p>
                            </div>
                          }
                          @if (note.postSession?.coachReflection) {
                            <div class="journal-field">
                              <span class="journal-field-label">{{ 'COACHING.reflection' | translate }}</span>
                              <p>{{ note.postSession!.coachReflection! | slice:0:120 }}{{ note.postSession!.coachReflection!.length > 120 ? '...' : '' }}</p>
                            </div>
                          } @else if (note.coacheePost?.biggestInsight) {
                            <div class="journal-field">
                              <span class="journal-field-label">{{ 'COACHING.myBiggestInsight' | translate }}</span>
                              <p>{{ note.coacheePost!.biggestInsight! | slice:0:120 }}{{ note.coacheePost!.biggestInsight!.length > 120 ? '...' : '' }}</p>
                            </div>
                          }
                          @if (!note.preSession?.agenda && !note.coacheePre?.mainTopic && !note.inSession?.observations && !note.postSession?.coachReflection && !note.coacheePost?.biggestInsight) {
                            <p class="journal-empty-hint">{{ 'COACHING.noContentYetCoach' | translate }}</p>
                          }
                        } @else {
                          @if (note.coacheePre?.mainTopic) {
                            <div class="journal-field">
                              <span class="journal-field-label">{{ 'COACHING.mainTopicLabel' | translate }}</span>
                              <p>{{ note.coacheePre!.mainTopic! | slice:0:120 }}{{ note.coacheePre!.mainTopic!.length > 120 ? '...' : '' }}</p>
                            </div>
                          }
                          @if (note.inSession?.observations) {
                            <div class="journal-field">
                              <span class="journal-field-label">{{ 'COACHING.fromYourCoach' | translate }}</span>
                              <p>{{ note.inSession!.observations! | slice:0:150 }}{{ note.inSession!.observations!.length > 150 ? '...' : '' }}</p>
                            </div>
                          }
                          @if (note.coacheePost?.biggestInsight) {
                            <div class="journal-field">
                              <span class="journal-field-label">{{ 'COACHING.myBiggestInsight' | translate }}</span>
                              <p>{{ note.coacheePost!.biggestInsight! | slice:0:120 }}{{ note.coacheePost!.biggestInsight!.length > 120 ? '...' : '' }}</p>
                            </div>
                          }
                          @if (!note.coacheePre?.mainTopic && !note.inSession?.observations && !note.coacheePost?.biggestInsight) {
                            <p class="journal-empty-hint">{{ 'COACHING.noContentYetCoachee' | translate }}</p>
                          }
                        }
                      </div>
                    } @else {
                      <div class="journal-panel journal-empty">
                        <mat-icon>auto_stories</mat-icon>
                        <span>{{ 'COACHING.noJournalNote' | translate }}</span>
                        @if (canManage()) {
                          <button class="add-journal-link" type="button" (click)="openJournalNoteNew(s._id)">
                            <mat-icon>add</mat-icon> {{ 'COACHING.addNote' | translate }}
                          </button>
                        } @else {
                          <a class="add-journal-link" [routerLink]="'/my-journal/engagement/' + engId"
                             [queryParams]="{ sessionId: s._id }">
                            <mat-icon>add</mat-icon> {{ 'COACHING.openJournal' | translate }}
                          </a>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>
            }

            <!-- Coach: 'New Session' as an empty + tile -->
            @if (canManage()) {
              <button class="session-card add-session-card" type="button" (click)="addSession()">
                <mat-icon class="add-icon">add</mat-icon>
                <span class="add-label">{{ 'COACHING.newSession' | translate }}</span>
              </button>
            }
            <!-- Coachee: 'Book a Session' as an empty + tile -->
            @if (!canManage()) {
              <button class="session-card add-session-card" type="button" (click)="bookSession()">
                <mat-icon class="add-icon">add</mat-icon>
                <span class="add-label">{{ 'COACHING.bookASession' | translate }}</span>
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-page { padding: 32px; }
    .back-link { display: flex; align-items: center; gap: 4px; color: var(--artes-accent); text-decoration: none; font-size: 14px; font-weight: 500; }

    .detail-layout { display: grid; grid-template-columns: 280px 1fr; gap: 24px; align-items: start; }

    .lifecycle-banner {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 18px; margin-bottom: 16px;
      background: #fff8f0; border: 1px solid #f0d4a0; border-radius: 10px;
      mat-icon { color: #b27300; font-size: 24px; width: 24px; height: 24px; flex-shrink: 0; }
      .banner-text { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .banner-text strong { color: #1B2A47; font-size: 14px; }
      .banner-text span { color: #5a6a7e; font-size: 12px; }
    }

    .info-card {
      background: white; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .coachee-block { padding: 24px; text-align: center; }
    .avatar {
      width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 12px;
      background: linear-gradient(135deg, var(--artes-accent), #27C4A0);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 700; color: white;
    }
    .avatar-img { object-fit: cover; background: none; }
    .coachee-block h2 { font-size: 18px; color: var(--artes-primary); margin: 0 0 8px; }
    .status-chip { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }

    .info-list, .goals-block, .notes-block, .billing-block { padding: 16px 20px; }
    .info-item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #374151; }
    .info-label { font-size: 11px; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.4px; display: block; margin-bottom: 4px; }
    .goal-chip { display: inline-block; font-size: 11px; background: var(--artes-bg); color: var(--artes-accent); padding: 2px 8px; border-radius: 4px; margin: 2px; }
    .notes-block p { font-size: 13px; color: #5a6a7e; margin: 0; line-height: 1.5; }

    .billing-row {
      display: flex; align-items: center; gap: 6px; font-size: 13px; color: #374151;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #7c5cbf; }
    }
    .billing-badge {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      background: rgba(124,92,191,0.12); color: #7c5cbf; padding: 2px 8px; border-radius: 999px;
    }
    .billing-rate { font-size: 13px; color: var(--artes-primary); font-weight: 600; margin-top: 6px; }
    .billing-link {
      display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--artes-accent);
      cursor: pointer; margin-top: 8px; text-decoration: none;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &:hover { text-decoration: underline; }
    }

    .session-layout { display: flex; }
    .session-left { flex: 1; padding: 18px; min-width: 0; }
    .session-right { width: 450px; flex-shrink: 0; border-left: 1px solid #f0f4f8; background: beige; }

    .journal-panel {
      padding: 14px; height: 100%; display: flex; flex-direction: column;
      > mat-icon { color: #7c5cbf; }
    }
    .journal-header {
      display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
      mat-icon { color: #7c5cbf; font-size: 18px; width: 18px; height: 18px; }
    }
    .journal-label { font-size: 13px; font-weight: 600; color: var(--artes-primary); }
    .journal-status {
      font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 999px;
      &.complete { background: #e8faf4; color: #1a9678; }
      &.draft { background: #f0f4f8; color: #9aa5b4; }
    }
    .journal-open-btn { margin-left: auto; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .journal-field {
      margin-bottom: 8px;
      .journal-field-label { font-size: 10px; font-weight: 700; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.3px; }
      p { font-size: 12px; color: #5a6a7e; line-height: 1.5; margin: 2px 0 0; }
    }
    .journal-empty-hint { font-size: 12px; color: #9aa5b4; font-style: italic; margin: 0; }
    .journal-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      color: #9aa5b4; font-size: 13px;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .add-journal-link {
      display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;
      font-size: 12px; color: #7c5cbf; text-decoration: none; font-weight: 600;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &:hover { text-decoration: underline; }
    }

    .journal-block { padding: 16px; }
    .journal-link {
      display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #7c5cbf;
      text-decoration: none;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { text-decoration: underline; }
    }

    .sessions-col h3 {
      font-size: 16px; color: var(--artes-primary); margin: 0 0 16px; display: flex; align-items: center; gap: 8px;
      .session-count { font-size: 12px; background: #f0f4f8; color: #5a6a7e; padding: 2px 8px; border-radius: 999px; }
    }

    .empty-sessions { text-align: center; padding: 48px; color: #9aa5b4; mat-icon { font-size: 40px; width: 40px; height: 40px; display: block; margin: 0 auto 8px; } p { margin: 0; } }

    .session-card {
      background: white; border-radius: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 12px;
      border-left: 4px solid #e8edf4; overflow: hidden;
      &.status-completed { border-left-color: #27C4A0; }
      &.status-scheduled { border-left-color: var(--artes-accent); }
      &.status-cancelled { border-left-color: #9aa5b4; opacity: 0.7; }
      &.status-no_show { border-left-color: #e53e3e; opacity: 0.7; }
    }
    .add-session-card {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; min-height: 96px;
      background: transparent; border: 2px dashed #c8d3df; border-left: 2px dashed #c8d3df;
      color: #6b7c93; cursor: pointer; padding: 16px;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      box-shadow: none;
      &:hover {
        border-color: var(--artes-accent); color: var(--artes-accent);
        background: rgba(58,159,214,0.04);
      }
      .add-icon { font-size: 28px; width: 28px; height: 28px; }
      .add-label { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    }

    .session-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .session-date { display: flex; align-items: center; gap: 4px; font-size: 14px; color: var(--artes-primary); mat-icon { font-size: 16px; color: var(--artes-accent); } }
    .session-duration { font-size: 12px; color: #9aa5b4; margin-left: auto; }
    .session-status {
      font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 999px;
      &.completed { background: #e8faf4; color: #1a9678; }
      &.scheduled { background: var(--artes-bg); color: var(--artes-accent); }
      &.cancelled { background: #f0f4f8; color: #9aa5b4; }
      &.no_show { background: #fef2f2; color: #e53e3e; }
    }
    .del-btn { color: #c5d0db; &:hover { color: #e53e3e; } }
    .mark-complete-btn {
      margin-left: auto !important;
      background: rgba(39,196,160,0.08) !important;
      border-color: rgba(39,196,160,0.4) !important;
      color: #1a9678 !important;
      font-size: 12px !important;
      height: 30px !important;
      line-height: 28px !important;
      padding: 0 12px !important;
      transition: background 0.15s !important;
      mat-icon { color: #27C4A0; font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
      mat-spinner { display: inline-block; margin-right: 6px; }
      &:hover:not([disabled]) { background: rgba(39,196,160,0.16) !important; }
      &[disabled] { opacity: 0.6; }
    }

    .source-chip {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.4px; padding: 2px 8px 2px 6px; border-radius: 999px;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
      &.booked   { background: #f3eafc; color: #6b3aa0; }
      &.scheduled { background: #fef6e6; color: #b87e08; }
    }

    .chem-chip {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.4px; padding: 2px 8px 2px 6px; border-radius: 999px;
      background: #fff8f0; color: #b27300; border: 1px solid #f0d4a0;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
    }

    .session-topics { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
    .topic-chip { font-size: 11px; background: #f0f4f8; color: #5a6a7e; padding: 2px 8px; border-radius: 4px; }

    .grow-tags { display: flex; gap: 4px; margin-bottom: 8px; }
    .grow-tag {
      font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;
      &.goal { background: #f0fdf4; color: #1a9678; }
      &.reality { background: #eff6ff; color: #2080b0; }
      &.options { background: #fefce8; color: #b07800; }
      &.will { background: #fdf2f8; color: #9b2c5b; }
    }

    .notes-section {
      padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;
      &.shared { background: #f0f9ff; border-left: 3px solid var(--artes-accent); }
      &.private { background: #fff8f0; border-left: 3px solid #f0a500; }
      .notes-label { font-size: 11px; font-weight: 600; color: #9aa5b4; display: flex; align-items: center; gap: 4px; margin-bottom: 4px; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
      p { font-size: 13px; color: #374151; margin: 0; line-height: 1.6; white-space: pre-wrap; }
    }

    .session-footer { display: flex; gap: 12px; }
    .rating { font-size: 12px; color: #5a6a7e; display: flex; align-items: center; gap: 1px; }
    .rating-label { font-size: 11px; font-weight: 600; color: #9aa5b4; margin-right: 4px; }
    .star-sm { font-size: 14px; width: 14px; height: 14px; color: #d1d5db; &.filled { color: #f59e0b; } }

    .meet-link {
      display: inline-flex; align-items: center; gap: 4px; margin: 6px 0;
      font-size: 12px; font-weight: 600; color: white; text-decoration: none;
      background: #1a73e8; padding: 4px 12px; border-radius: 6px;
      transition: background 0.15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #1557b0; }
    }

    .sidebar-col { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
    .book-btn { width: 100%; margin-bottom: 4px; }

    .coachee-calendar .cal-card {
      background: white; border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); padding: 12px;
    }
    .cal-header-row {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;
      .cal-month-label { font-size: 14px; font-weight: 600; color: var(--artes-primary); }
    }
    .cal-grid {
      display: grid; grid-template-columns: repeat(7, 1fr);
      border: 1px solid #f0f4f8; border-radius: 8px; overflow: hidden;
    }
    .cal-day-hdr {
      text-align: center; font-size: 9px; font-weight: 600; color: #9aa5b4;
      padding: 4px 0; background: #f8fafc; border-bottom: 1px solid #f0f4f8;
    }
    .cal-cell {
      min-height: 36px; padding: 2px; border-right: 1px solid #f0f4f8; border-bottom: 1px solid #f0f4f8;
      display: flex; flex-direction: column; align-items: center; gap: 1px;
      &:nth-child(7n) { border-right: none; }
      &.other { background: #fafbfc; .cal-num { color: #d1d5db; } }
      &.today { background: #f0f9ff; .cal-num { background: var(--artes-accent); color: white; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; } }
    }
    .cal-num { font-size: 10px; color: #5a6a7e; }
    .cal-dot {
      width: 6px; height: 6px; border-radius: 50%;
      &.completed { background: #27C4A0; }
      &.scheduled { background: var(--artes-accent); }
      &.cancelled { background: #9aa5b4; }
      &.no_show { background: #e53e3e; }
    }
    .cal-upcoming {
      margin-top: 10px; border-top: 1px solid #f0f4f8; padding-top: 10px;
      h4 { font-size: 12px; font-weight: 600; color: var(--artes-primary); margin: 0 0 6px; }
    }
    .upcoming-row {
      display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 12px;
      .upcoming-date { font-weight: 600; color: var(--artes-primary); min-width: 48px; }
      .upcoming-time { color: var(--artes-accent); min-width: 56px; }
      .upcoming-dur { color: #9aa5b4; font-size: 11px; }
    }

    .session-count-muted {
      font-size: 12px; font-weight: 500; color: #9aa5b4; margin-left: 2px;
    }
    .session-filter-pills {
      display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 16px;
      .pill {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 5px 10px 5px 8px; border-radius: 999px;
        border: 1px solid #e8edf4; background: #ffffff;
        color: #5a6a7e; font-size: 12px; font-weight: 600;
        cursor: pointer; transition: all 0.12s;
        mat-icon { font-size: 15px; width: 15px; height: 15px; }
        .pill-count {
          background: #f0f4f8; color: #5a6a7e; padding: 1px 7px;
          border-radius: 999px; font-size: 11px; font-weight: 700;
        }
        &:hover { border-color: var(--artes-accent); color: var(--artes-primary); }
        &.active {
          background: var(--artes-bg); border-color: var(--artes-accent); color: var(--artes-primary);
          mat-icon { color: var(--artes-accent); }
          .pill-count { background: var(--artes-accent); color: #ffffff; }
        }
      }
      .pill-reset {
        color: #9aa5b4; font-weight: 500;
        mat-icon { color: #9aa5b4; }
        &:hover { color: var(--artes-primary); border-color: #9aa5b4; mat-icon { color: var(--artes-primary); } }
      }
    }

    .intake-view-btn {
      flex-shrink: 0;
      font-size: 12px; font-weight: 600; line-height: 1;
      padding: 4px 12px; min-width: 0; border-radius: 999px;
      color: #5e3fa8; border-color: rgba(124,92,191,0.4);
      mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; color: #7c5cbf; }
      &:hover { background: rgba(124,92,191,0.08); }
    }

    .intake-card {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 10px;
      margin: 8px 0;
      text-decoration: none;
      background: rgba(124,92,191,0.08);
      border: 1px solid rgba(124,92,191,0.22);
      color: #5e3fa8;
      mat-icon { color: #7c5cbf; }
      .intake-body { flex: 1; min-width: 0; }
      .intake-title { font-weight: 600; font-size: 14px; color: var(--artes-primary); }
      .intake-sub { font-size: 12px; color: #5a6a7e; margin-top: 2px; }
      .chev { color: #9aa5b4; }
      &.coachee-action {
        cursor: pointer;
        transition: all 0.15s;
        &:hover { background: rgba(124,92,191,0.14); border-color: #7c5cbf; }
      }
      &.locked {
        opacity: 0.6; cursor: default;
        mat-icon { color: #9aa5b4; }
      }
      &.post.coachee-action {
        border-color: rgba(39,196,160,0.3); background: rgba(39,196,160,0.05);
        &:hover { background: rgba(39,196,160,0.12); border-color: #27C4A0; }
      }
      &.generate-post {
        cursor: pointer; border-color: rgba(58,159,214,0.3); background: rgba(58,159,214,0.04);
        transition: all 0.15s;
        &:hover { background: rgba(58,159,214,0.10); border-color: var(--artes-accent); }
        mat-icon:first-child { color: var(--artes-accent); }
      }
      &.status {
        background: #fff8f0; border-color: #fde0c2; color: #b07800;
        mat-icon { color: #f0a500; }
        &.completed {
          background: #f0f9f4; border-color: #b9e6d0; color: #1a9678;
          mat-icon { color: #27C4A0; }
        }
      }
    }

    @media (max-width: 768px) { .detail-layout { grid-template-columns: 1fr; } .info-card { position: static; } .sidebar-col { position: static; } }
  `],
})
export class EngagementDetailComponent implements OnInit {
  engagement = signal<any>(null);
  sessions = signal<Session[]>([]);
  loading = signal(true);
  advancing = signal(false);
  currentMonth = signal(new Date());

  /** Banner shows when a prospect engagement has at least one completed
   *  chemistry call — coach can advance the engagement to 'contracted'. */
  shouldAdvanceFromProspect = computed(() => {
    const eng = this.engagement();
    if (!eng || eng.status !== 'prospect') return false;
    return this.sessions().some(
      (s) => s.isChemistryCall && s.status === 'completed',
    );
  });
  private notesBySession = new Map<string, SessionNote>();
  engId = '';

  dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  calMonthLabel = computed(() => this.currentMonth().toLocaleDateString(localStorage.getItem('artes_language') || 'en', { month: 'long', year: 'numeric' }));

  calendarDays = computed(() => {
    const month = this.currentMonth();
    const y = month.getFullYear(), m = month.getMonth();
    const today = new Date();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean; sessions: Session[] }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: new Date(y, m, -i), isCurrentMonth: false, isToday: false, sessions: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const daySessions = this.sessions().filter((s) => new Date(s.date).toDateString() === date.toDateString());
      days.push({ date, isCurrentMonth: true, isToday: date.toDateString() === today.toDateString(), sessions: daySessions });
    }
    while (days.length < 42) {
      days.push({ date: new Date(y, m + 1, days.length - daysInMonth - firstDay + 1), isCurrentMonth: false, isToday: false, sessions: [] });
    }
    return days;
  });

  // Session status filter pills. Default: hide completed + cancelled so
  // the coach sees an actionable list of upcoming / open sessions first.
  private readonly DEFAULT_STATUSES: ReadonlySet<string> = new Set(['scheduled', 'no_show']);
  activeStatuses = signal<Set<string>>(new Set(this.DEFAULT_STATUSES));

  readonly statusPills: { key: string; labelKey: string; icon: string }[] = [
    { key: 'scheduled', labelKey: 'COACHING.scheduled', icon: 'event' },
    { key: 'completed', labelKey: 'COACHING.completed', icon: 'check_circle' },
    { key: 'cancelled', labelKey: 'COACHING.cancelled', icon: 'event_busy' },
    { key: 'no_show',   labelKey: 'COACHING.noShow',   icon: 'report' },
  ];

  filteredSessions = computed(() => {
    const active = this.activeStatuses();
    return this.sessions().filter((s) => active.has(s.status));
  });

  isStatusActive = (key: string): boolean => this.activeStatuses().has(key);

  statusCount = (key: string): number =>
    this.sessions().filter((s) => s.status === key).length;

  toggleStatus(key: string): void {
    this.activeStatuses.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  resetStatusFilter(): void {
    this.activeStatuses.set(new Set(this.DEFAULT_STATUSES));
  }

  hasFilterChanges(): boolean {
    const active = this.activeStatuses();
    if (active.size !== this.DEFAULT_STATUSES.size) return true;
    for (const s of active) if (!this.DEFAULT_STATUSES.has(s)) return true;
    return false;
  }

  upcomingSessions = computed(() => {
    const now = new Date();
    return this.sessions()
      .filter((s) => s.status === 'scheduled' && new Date(s.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
    private journal: JournalService,
    private bookingSvc: BookingService,
    private translate: TranslateService,
  ) {}

  canManage = () => ['admin', 'hr_manager', 'coach'].includes(this.auth.currentUser()?.role ?? '');

  /** A coachee can reschedule/cancel a session only if it is still scheduled
   *  (not already cancelled or completed), has a paired Booking row, and
   *  the starting time is in the future. */
  private get deadlineHours(): number {
    return (this.engagement() as any)?.rescheduleDeadlineHours ?? 24;
  }

  private hoursUntilSession(s: Session): number {
    return (new Date(s.date).getTime() - Date.now()) / (60 * 60 * 1000);
  }

  canCoacheeManage(s: Session): boolean {
    const me = this.auth.currentUser();
    const isCoachee = me?.role === 'coachee' || me?.isCoachee === true;
    if (!isCoachee) return false;
    if (!s.bookingId) return false;
    if (s.status !== 'scheduled') return false;
    return new Date(s.date).getTime() > Date.now();
  }

  canCoacheeReschedule(s: Session): boolean {
    return this.hoursUntilSession(s) >= this.deadlineHours;
  }

  isLateCancellation(s: Session): boolean {
    return this.hoursUntilSession(s) < this.deadlineHours;
  }

  preSessionIntakeTitle(s: Session): string | null {
    const tpl = s.preSessionIntakeTemplateId;
    if (!tpl) return null;
    const fallback = this.translate.instant('COACHING.preSessionAssessmentDefault');
    return typeof tpl === 'string' ? fallback : (tpl.title || fallback);
  }

  preSessionIntakeTemplateId(s: Session): string | null {
    const tpl = s.preSessionIntakeTemplateId;
    if (!tpl) return null;
    return typeof tpl === 'string' ? tpl : tpl._id;
  }

  postSessionIntakeTemplateId(s: Session): string | null {
    const tpl = s.postSessionIntakeTemplateId;
    if (!tpl) return null;
    return typeof tpl === 'string' ? tpl : tpl._id;
  }

  generatingPostFor = signal<string | null>(null);
  markingCompleteFor = signal<string | null>(null);

  /** Opens an existing journal note in a dialog (instead of routing to a full
   *  page). Refreshes engagement state on close so any new content shows up. */
  openJournalNote(noteId: string): void {
    import('../../journal/session-note-editor/session-note-editor.component').then((m) => {
      const ref = this.dialog.open(m.SessionNoteEditorComponent, {
        width: '960px', maxWidth: '96vw', maxHeight: '92vh',
        panelClass: 'journal-note-dialog-panel',
        data: { noteId, engagementId: this.engId },
      });
      ref.afterClosed().subscribe(() => this.load());
    });
  }

  /** Opens the journal note editor in dialog mode for a new note bound to the
   *  given session. */
  openJournalNoteNew(sessionId: string): void {
    import('../../journal/session-note-editor/session-note-editor.component').then((m) => {
      const ref = this.dialog.open(m.SessionNoteEditorComponent, {
        width: '960px', maxWidth: '96vw', maxHeight: '92vh',
        panelClass: 'journal-note-dialog-panel',
        data: { engagementId: this.engId, sessionId },
      });
      ref.afterClosed().subscribe(() => this.load());
    });
  }

  advanceToContracted(): void {
    if (this.advancing() || !this.engId) return;
    this.advancing.set(true);
    this.api.put(`/coaching/engagements/${this.engId}`, { status: 'contracted' }).subscribe({
      next: () => {
        this.advancing.set(false);
        this.snack.open(
          this.translate.instant('COACHING.advanceToContractedSuccess'),
          this.translate.instant('COMMON.ok'),
          { duration: 3000 },
        );
        this.load();
      },
      error: (err) => {
        this.advancing.set(false);
        this.snack.open(
          err?.error?.error || this.translate.instant('COACHING.advanceToContractedError'),
          this.translate.instant('COMMON.dismiss'),
          { duration: 4000 },
        );
      },
    });
  }

  markSessionComplete(s: Session): void {
    if (this.markingCompleteFor()) return;

    const hasAssignedPost = !!s.postSessionIntakeTemplateId;
    const hasContext = (s.topics?.length ?? 0) > 0
      || !!(s.sharedNotes || '').trim()
      || !!(s.coachNotes || '').trim();
    const messageKey = hasAssignedPost
      ? 'COACHING.markCompleteConfirmAssigned'
      : (hasContext ? 'COACHING.markCompleteConfirmAi' : 'COACHING.markCompleteConfirmNoForm');

    this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      data: {
        title: this.translate.instant('COACHING.markCompleteConfirmTitle'),
        message: this.translate.instant(messageKey),
        confirmLabel: this.translate.instant('COACHING.markSessionComplete'),
        confirmColor: 'primary',
        icon: 'task_alt',
      },
    }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.markingCompleteFor.set(s._id);
      this.api.put(`/coaching/sessions/${s._id}`, { status: 'completed' }).subscribe({
        next: () => {
          this.markingCompleteFor.set(null);
          this.snack.open(
            this.translate.instant('COACHING.sessionMarkedCompleteSnack'),
            this.translate.instant('COMMON.ok'),
            { duration: 3000 },
          );
          this.load();
        },
        error: (err: any) => {
          this.markingCompleteFor.set(null);
          const msg = err?.error?.error || this.translate.instant('COACHING.failedSaveSession');
          this.snack.open(msg, this.translate.instant('COMMON.ok'), { duration: 4000 });
        },
      });
    });
  }

  generatePostSessionForm(s: Session): void {
    if (this.generatingPostFor()) return;
    const hasContext = (s.topics?.length ?? 0) > 0 || s.sharedNotes || s.coachNotes;
    if (!hasContext) {
      const summary = prompt('No session notes available. Enter a brief summary of the topics discussed:');
      if (!summary?.trim()) return;
      this.doGeneratePost(s._id, summary.trim());
    } else {
      this.doGeneratePost(s._id);
    }
  }

  private doGeneratePost(sessionId: string, summary?: string): void {
    this.generatingPostFor.set(sessionId);
    this.api.post(`/coaching/sessions/${sessionId}/post-session-form`, {
      ...(summary ? { summary } : {}),
    }).subscribe({
      next: () => {
        this.generatingPostFor.set(null);
        this.snack.open(this.translate.instant('COACHING.postReflectionSentSnack'), this.translate.instant('COMMON.ok'), { duration: 3000 });
        this.load();
      },
      error: (err: any) => {
        this.generatingPostFor.set(null);
        const msg = err?.error?.error || this.translate.instant('COACHING.failedGeneratePost');
        if (msg.includes('summary')) {
          const summary = prompt(msg);
          if (summary?.trim()) { this.doGeneratePost(sessionId, summary.trim()); return; }
        }
        this.snack.open(msg, this.translate.instant('COMMON.ok'), { duration: 4000 });
      },
    });
  }

  viewPostIntakeResponse(s: Session): void {
    const templateId = this.postSessionIntakeTemplateId(s);
    if (!templateId) return;
    this.api.get<any>(`/surveys/templates/${templateId}`).subscribe({
      next: (template: any) => {
        import('../../../shared/confirm-dialog/confirm-dialog.component').then(() => {
          import('../../survey/survey-responses-dialog/survey-responses-dialog.component').then((m) => {
            this.dialog.open(m.SurveyResponsesDialogComponent, {
              data: { template, sessionId: s._id },
              width: '720px', maxHeight: '92vh',
            });
          });
        });
      },
    });
  }

  isIntakeAccessible(s: Session): boolean {
    if (s.preSessionIntakeSentAt) return true;
    const hoursUntil = (new Date(s.date).getTime() - Date.now()) / (60 * 60 * 1000);
    return hoursUntil <= 24;
  }

  viewIntakeResponse(s: Session): void {
    const templateId = this.preSessionIntakeTemplateId(s);
    if (!templateId) return;

    // The session list endpoint only populates a lightweight summary; fetch
    // the full template (questions, intakeType) before opening the dialog.
    this.api.get<IntakeTemplate>(`/surveys/templates/${templateId}`).subscribe({
      next: (template) => {
        this.dialog.open(SurveyResponsesDialogComponent, {
          width: '760px',
          maxHeight: '90vh',
          data: { template, sessionId: s._id },
        });
      },
      error: () => this.snack.open(this.translate.instant('COACHING.failedLoadAssessment'), this.translate.instant('COMMON.close'), { duration: 3000 }),
    });
  }

  prevMonth(): void { const d = new Date(this.currentMonth()); d.setMonth(d.getMonth() - 1); this.currentMonth.set(d); }
  nextMonth(): void { const d = new Date(this.currentMonth()); d.setMonth(d.getMonth() + 1); this.currentMonth.set(d); }

  initials(): string {
    const c = this.engagement()?.coacheeId;
    return c && typeof c === 'object' ? `${c.firstName[0]}${c.lastName[0]}` : '?';
  }

  coacheeName(): string {
    const c = this.engagement()?.coacheeId;
    return c && typeof c === 'object' ? `${c.firstName} ${c.lastName}` : 'Unknown';
  }

  coachFullName(): string {
    const c = this.engagement()?.coachId;
    return c && typeof c === 'object' ? `${c.firstName} ${c.lastName}` : '';
  }

  coacheeId(): string {
    const c = this.engagement()?.coacheeId;
    return c && typeof c === 'object' ? c._id : c ?? '';
  }

  engagementHourlyRate(): number | null {
    return this.engagement()?.hourlyRate ?? null;
  }

  noteFor(sessionId: string): SessionNote | undefined {
    return this.notesBySession.get(sessionId);
  }

  statusColor(): string {
    const map: Record<string, string> = { prospect: '#9aa5b4', contracted: '#3A9FD6', active: '#27C4A0', paused: '#f0a500', completed: '#1a9678', alumni: '#7c5cbf' };
    return map[this.engagement()?.status] || '#9aa5b4';
  }

  private readonly statusKeyMap: Record<string, string> = {
    prospect: 'COACHING.prospect', contracted: 'COACHING.contracted', active: 'COACHING.active',
    paused: 'COACHING.paused', completed: 'COACHING.completed', alumni: 'COACHING.alumni',
  };
  translateStatus(status: string): string { return this.translate.instant(this.statusKeyMap[status] || status); }

  private readonly cadenceKeyMap: Record<string, string> = { weekly: 'COACHING.weekly', biweekly: 'COACHING.biweekly', monthly: 'COACHING.monthly' };
  translateCadence(cadence: string): string { return this.translate.instant(this.cadenceKeyMap[cadence] || cadence); }

  private readonly formatKeyMap: Record<string, string> = { video: 'COACHING.video', phone: 'COACHING.phone', in_person: 'COACHING.inPerson' };
  translateFormat(format: string): string { return this.translate.instant(this.formatKeyMap[format] || format); }

  private readonly sessionStatusKeyMap: Record<string, string> = {
    scheduled: 'COACHING.scheduled', completed: 'COACHING.completed', cancelled: 'COACHING.cancelled', no_show: 'COACHING.noShow',
  };
  translateSessionStatus(status: string): string { return this.translate.instant(this.sessionStatusKeyMap[status] || status); }

  private readonly journalStatusKeyMap: Record<string, string> = { complete: 'COACHING.journalComplete', draft: 'COACHING.journalDraft' };
  translateJournalStatus(status: string): string { return this.translate.instant(this.journalStatusKeyMap[status] || status); }

  ngOnInit(): void {
    // Subscribe to params (not snapshot) so navigating between engagements
    // via router-link reuses the same component instance but still reloads
    // for the new id. Otherwise the page keeps the prior engagement's
    // sessions while the URL changes underneath.
    this.route.params.subscribe((params) => {
      const id = params['id'];
      if (!id || id === this.engId) return;
      this.engId = id;
      this.load();
    });
  }

  load(): void {
    // Clear stale data so the calendar / list don't briefly show the
    // previous engagement's sessions while the new fetch is in-flight.
    this.sessions.set([]);
    this.engagement.set(null);
    this.notesBySession.clear();

    this.loading.set(true);
    const promises: [Promise<any>, Promise<Session[] | undefined>, Promise<SessionNote[] | undefined>] = [
      this.api.get(`/coaching/engagements/${this.engId}`).toPromise(),
      this.api.get<Session[]>(`/coaching/sessions?engagementId=${this.engId}`).toPromise(),
      // Both coaches and coachees load journal notes — coachees use them
      // to render their pre/post snippets in the per-session right panel.
      this.journal.getEngagementNotes(this.engId).toPromise()
        .catch(() => [] as SessionNote[]),
    ];
    Promise.all(promises).then(([eng, sessions, notes]) => {
      this.engagement.set(eng);
      this.sessions.set(sessions!);
      // Index journal notes by sessionId
      this.notesBySession.clear();
      (notes || []).forEach((n) => { if (n.sessionId) this.notesBySession.set(n.sessionId, n); });
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  bookSession(): void {
    this.api.get<CoachPick[]>('/users/coaches').subscribe({
      next: (coaches) => {
        const withSlug = coaches.filter((c) => !!c.publicSlug);
        if (!withSlug.length) {
          this.snack.open(this.translate.instant('COACHING.noCoachesAvailable'), this.translate.instant('COMMON.ok'), { duration: 3000 });
          return;
        }

        // When the coachee isn't allowed to choose, skip the picker and
        // route straight to their engagement's assigned coach.
        const me = this.auth.currentUser();
        const isCoachee = me?.role === 'coachee' || me?.isCoachee === true;
        const lockedToAssigned = isCoachee && me?.canChooseCoach === false;

        if (lockedToAssigned) {
          const engCoach = this.engagement()?.coachId;
          const engCoachId = engCoach && typeof engCoach === 'object' ? engCoach._id : engCoach;
          const assigned = withSlug.find((c) => c._id === engCoachId);
          if (assigned) {
            this.openLandingDialog(assigned.publicSlug);
          } else {
            this.snack.open(
              this.translate.instant('COACHING.coachNotAvailable'),
              this.translate.instant('COMMON.ok'), { duration: 4000 },
            );
          }
          return;
        }

        if (withSlug.length === 1) {
          this.openLandingDialog(withSlug[0].publicSlug);
          return;
        }
        const ref = this.dialog.open(CoachPickerDialogComponent, {
          data: { coaches: withSlug },
          width: '520px', maxHeight: '80vh',
        });
        ref.afterClosed().subscribe((picked: CoachPick | null) => {
          if (picked?.publicSlug) {
            this.openLandingDialog(picked.publicSlug);
          }
        });
      },
      error: () => this.snack.open(this.translate.instant('COACHING.failedLoadCoaches'), this.translate.instant('COMMON.ok'), { duration: 3000 }),
    });
  }

  private openLandingDialog(slug: string): void {
    const ref = this.dialog.open(CoachLandingComponent, {
      data: { slug },
      width: '880px', maxWidth: '95vw', maxHeight: '92vh',
      panelClass: 'coach-landing-dialog',
    });
    // Truthy result = a booking was completed in the dialog. Reload the
    // engagement so the newly paired session shows up in the list/calendar.
    ref.afterClosed().subscribe((result) => {
      if (result) this.load();
    });
  }

  addSession(): void {
    const eng = this.engagement();
    const coacheeId = (eng?.coacheeId && typeof eng.coacheeId === 'object')
      ? eng.coacheeId._id
      : eng?.coacheeId;
    if (!eng || !this.engId || !coacheeId) {
      this.snack.open(this.translate.instant('COACHING.engagementLoading'), this.translate.instant('COMMON.ok'), { duration: 3000 });
      return;
    }
    const ref = this.dialog.open(SessionDialogComponent, {
      data: { engagementId: this.engId, coacheeId, engagementStatus: eng.status },
      minWidth: '600px', maxHeight: '92vh',
    });
    ref.afterClosed().subscribe((r) => { if (r) this.load(); });
  }

  editSession(s: Session): void {
    const ref = this.dialog.open(SessionDialogComponent, {
      data: { ...s, engagementId: this.engId, coacheeId: this.engagement()?.coacheeId?._id, engagementStatus: this.engagement()?.status },
      minWidth: '600px', maxHeight: '92vh',
    });
    ref.afterClosed().subscribe((r) => { if (r) this.load(); });
  }

  deleteSession(s: Session): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px', data: { title: this.translate.instant('COACHING.deleteSessionTitle'), message: this.translate.instant('COACHING.deleteSessionConfirm'), confirmLabel: this.translate.instant('COACHING.delete'), confirmColor: 'warn', icon: 'delete_forever' },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.delete(`/coaching/sessions/${s._id}`).subscribe({ next: () => this.load() });
    });
  }

  coachCancelSession(s: Session): void {
    const coachee = this.engagement()?.coacheeId;
    const coacheeName = coachee && typeof coachee === 'object'
      ? `${coachee.firstName} ${coachee.lastName}`.trim() : '';
    const ref = this.dialog.open(CancelDialogComponent, {
      width: '480px',
      data: {
        title: this.translate.instant('COACHING.cancelSession'),
        startTime: s.date,
        coachName: coacheeName,
        noteLabel: this.translate.instant('COACHING.noteToCoachee'),
        notePlaceholder: this.translate.instant('COACHING.noteToCoacheePlaceholder'),
        confirmLabel: this.translate.instant('COACHING.cancelSession'),
      },
    });
    ref.afterClosed().subscribe((result: CancelDialogResult | null | undefined) => {
      if (!result) return;
      if (s.bookingId) {
        this.bookingSvc.cancelBooking(s.bookingId, result.reason).subscribe({
          next: () => {
            this.snack.open(this.translate.instant('COACHING.sessionCancelledCoacheeNotified'), this.translate.instant('COMMON.ok'), { duration: 3000 });
            this.load();
          },
          error: (err: any) => this.snack.open(err?.error?.error || this.translate.instant('COACHING.cancelFailed'), this.translate.instant('COMMON.ok'), { duration: 3000 }),
        });
      } else {
        this.api.put(`/coaching/sessions/${s._id}`, { status: 'cancelled' }).subscribe({
          next: () => {
            this.snack.open(this.translate.instant('COACHING.sessionCancelled'), this.translate.instant('COMMON.ok'), { duration: 3000 });
            this.load();
          },
          error: (err: any) => this.snack.open(err?.error?.error || this.translate.instant('COACHING.cancelFailed'), this.translate.instant('COMMON.ok'), { duration: 3000 }),
        });
      }
    });
  }

  /** Coachee → cancel the Booking (and, via propagation, the paired session). */
  coacheeCancel(s: Session): void {
    if (!s.bookingId) return;
    const late = this.isLateCancellation(s);
    const coach = this.engagement()?.coachId;
    const coachName = coach && typeof coach === 'object'
      ? `${coach.firstName} ${coach.lastName}`.trim() : '';
    const ref = this.dialog.open(CancelDialogComponent, {
      width: '480px',
      data: {
        title: late ? this.translate.instant('COACHING.lateCancellation') : this.translate.instant('COACHING.cancelSession'),
        startTime: s.date,
        coachName,
        confirmLabel: late ? this.translate.instant('COACHING.cancelAnyway') : this.translate.instant('COACHING.cancelSession'),
        warning: late
          ? this.translate.instant('COACHING.lateCancelWarning', { hours: this.deadlineHours })
          : undefined,
      },
    });
    ref.afterClosed().subscribe((result: CancelDialogResult | null | undefined) => {
      if (!result) return;
      this.bookingSvc.cancelBooking(s.bookingId!, result.reason).subscribe({
        next: () => {
          this.snack.open(this.translate.instant('COACHING.sessionCancelledCoachNotified'), this.translate.instant('COMMON.ok'), { duration: 3000 });
          this.load();
        },
        error: (err) => {
          const msg = err?.error?.error || this.translate.instant('COACHING.failedToCancel');
          this.snack.open(msg, this.translate.instant('COMMON.ok'), { duration: 4000 });
        },
      });
    });
  }

  /** Coachee → reschedule the Booking (paired session date follows). */
  coacheeReschedule(s: Session): void {
    if (!s.bookingId) return;
    // The reschedule dialog wants a BookingRecord — build a minimal shim
    // with just the fields it reads (clientName + startTime).
    const shim: BookingRecord = {
      _id: s.bookingId,
      coachId: '',
      clientName: 'this session',
      clientEmail: '',
      startTime: s.date,
      endTime: new Date(new Date(s.date).getTime() + (s.duration || 60) * 60000).toISOString(),
      clientTimezone: 'UTC',
      coachTimezone: 'UTC',
      status: 'confirmed',
      createdAt: '',
    };
    const ref = this.dialog.open(RescheduleDialogComponent, {
      width: '480px',
      data: { booking: shim, withNote: true },
    });
    ref.afterClosed().subscribe((result: RescheduleDialogResult | null | undefined) => {
      if (!result) return;
      this.bookingSvc.rescheduleBooking(s.bookingId!, result.newStartTime, result.note).subscribe({
        next: () => {
          this.snack.open(this.translate.instant('COACHING.sessionRescheduled'), this.translate.instant('COMMON.ok'), { duration: 3000 });
          this.load();
        },
        error: (err) => {
          const msg = err?.error?.error || this.translate.instant('COACHING.failedToReschedule');
          this.snack.open(msg, this.translate.instant('COMMON.ok'), { duration: 4000 });
        },
      });
    });
  }
}
