import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { IdpGenerateDialogComponent } from '../idp-generate-dialog/idp-generate-dialog.component';

interface JournalEntry {
  _id: string;
  userId: { _id: string; firstName: string; lastName: string } | string;
  idpId?: { _id: string; goal: string } | string;
  prompt?: string;
  content: string;
  mood?: number;
  tags?: string[];
  createdAt: string;
}

interface Milestone {
  _id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

interface IDP {
  _id: string;
  coacheeId: { _id: string; firstName: string; lastName: string; email: string } | string;
  goal: string;
  currentReality: string;
  options: string[];
  willDoActions: string[];
  milestones: Milestone[];
  competencyGaps: string[];
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
}

@Component({
  selector: 'app-idp-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatTooltipModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="idp-page">
      <div class="page-header">
        <div>
          <h1>Leadership & Succession Hub™</h1>
          <p>Scalable succession planning and leadership coaching — from founders and family businesses to growing organizations</p>
        </div>
        @if (canManage()) {
          <button mat-raised-button color="primary" (click)="generateNew()">
            <mat-icon>auto_awesome</mat-icon> Generate IDP
          </button>
        }
      </div>

      <!-- Module description banner -->
      <div class="module-banner">
        <div class="banner-insight">
          <mat-icon class="banner-icon">emoji_events</mat-icon>
          <p><strong>Methodology:</strong> Transforms Helena's high-touch succession planning and leadership coaching into a scalable platform. Every IDP is structured around the proven GROW model (Goal → Reality → Options → Will Do) with EQi-informed competency mapping and AI-generated 90-day milestones.</p>
        </div>
        <div class="banner-features">
          <span class="feature-pill"><mat-icon>account_tree</mat-icon> Competency Gap Mapper</span>
          <span class="feature-pill"><mat-icon>auto_awesome</mat-icon> AI-Generated IDPs (GROW)</span>
          <span class="feature-pill"><mat-icon>leaderboard</mat-icon> Succession Scorecard</span>
          <span class="feature-pill"><mat-icon>book</mat-icon> Coaching Journal</span>
          <span class="feature-pill"><mat-icon>group</mat-icon> Stakeholder Alignment</span>
          <span class="feature-pill"><mat-icon>video_call</mat-icon> Helena Coaching Integration</span>
        </div>
      </div>

      <!-- Succession Readiness Scorecard -->
      <div class="section-card scorecard-section">
        <div class="section-header-row">
          <div class="section-header-left">
            <div class="section-icon blue"><mat-icon>leaderboard</mat-icon></div>
            <div>
              <h3>Succession Readiness Scorecard</h3>
              <p>Board-ready reporting on next-generation leadership bench strength. Share with executives and board members to demonstrate succession health at a glance.</p>
            </div>
          </div>
        </div>
        <div class="scorecard-grid">
          @for (metric of scorecardMetrics(idps()); track metric.label) {
            <div class="scorecard-metric">
              <div class="metric-value" [style.color]="metric.color">{{ metric.value }}</div>
              <div class="metric-label">{{ metric.label }}</div>
              @if (metric.sub) {
                <div class="metric-sub">{{ metric.sub }}</div>
              }
            </div>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner /></div>
      } @else if (idps().length === 0) {
        <div class="empty-state">
          <mat-icon>psychology_alt</mat-icon>
          <h3>No Development Plans Yet</h3>
          @if (canManage()) {
            <p>Generate your first AI-powered IDP using the GROW model.</p>
            <button mat-raised-button color="primary" (click)="generateNew()">
              <mat-icon>auto_awesome</mat-icon> Generate First IDP
            </button>
          } @else {
            <p>No development plan has been created for you yet. Contact your coach or HR manager.</p>
          }
        </div>
      } @else {
        <div class="idp-grid">
          @for (idp of idps(); track idp._id) {
            <div class="idp-card" [class]="'status-' + idp.status">
              <div class="idp-card-header">
                <div class="idp-status-badge" [class]="idp.status">{{ idp.status }}</div>
                @if (showCoacheeName() && isPopulatedCoachee(idp.coacheeId)) {
                  <span class="idp-coachee-name">
                    <mat-icon class="coachee-icon">person</mat-icon>
                    {{ idp.coacheeId.firstName }} {{ idp.coacheeId.lastName }}
                  </span>
                }
                <span class="idp-date">{{ idp.createdAt | date:'MMM d, y' }}</span>
                @if (canManage() && idp.status === 'draft') {
                  <button class="card-action-btn"
                          [matTooltip]="'Regenerate IDP'"
                          matTooltipPosition="above"
                          [disabled]="regeneratingId() === idp._id"
                          (click)="regenerate(idp)">
                    @if (regeneratingId() === idp._id) {
                      <mat-spinner diameter="16" />
                    } @else {
                      <mat-icon>refresh</mat-icon>
                    }
                  </button>
                }
                @if (canDelete()) {
                  <button class="card-action-btn delete-btn"
                          matTooltip="Delete IDP"
                          matTooltipPosition="above"
                          [disabled]="regeneratingId() === idp._id"
                          (click)="deleteIdp(idp)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                }
              </div>

              <!-- GROW sections -->
              <mat-accordion class="grow-accordion">
                <mat-expansion-panel class="grow-panel goal-panel">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>flag</mat-icon> Goal
                    </mat-panel-title>
                  </mat-expansion-panel-header>
                  <p>{{ idp.goal }}</p>
                </mat-expansion-panel>

                <mat-expansion-panel class="grow-panel reality-panel">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>explore</mat-icon> Reality
                    </mat-panel-title>
                  </mat-expansion-panel-header>
                  <p>{{ idp.currentReality }}</p>
                </mat-expansion-panel>

                <mat-expansion-panel class="grow-panel options-panel">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>lightbulb</mat-icon> Options ({{ idp.options.length }})
                    </mat-panel-title>
                  </mat-expansion-panel-header>
                  <ul>
                    @for (opt of idp.options; track opt) {
                      <li>{{ opt }}</li>
                    }
                  </ul>
                </mat-expansion-panel>

                <mat-expansion-panel class="grow-panel will-panel">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>bolt</mat-icon> Will Do ({{ idp.willDoActions.length }})
                    </mat-panel-title>
                  </mat-expansion-panel-header>
                  <ul>
                    @for (action of idp.willDoActions; track action) {
                      <li>{{ action }}</li>
                    }
                  </ul>
                </mat-expansion-panel>
              </mat-accordion>

              <!-- Milestone timeline -->
              <div class="milestone-section">
                <h4>Milestones</h4>
                <div class="milestone-timeline">
                  @for (ms of idp.milestones; track ms._id) {
                    <div class="milestone-item" [class]="ms.status">
                      <div class="ms-dot"></div>
                      <div class="ms-content">
                        <span class="ms-title">{{ ms.title }}</span>
                        <span class="ms-date">{{ ms.dueDate | date:'MMM d' }}</span>
                      </div>
                      <div class="ms-actions">
                        @if (ms.status !== 'completed' && canManage()) {
                          <button mat-icon-button [matTooltip]="'Mark complete'" (click)="updateMilestone(idp._id, ms._id, 'completed')">
                            <mat-icon>check_circle_outline</mat-icon>
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Competency gaps -->
              @if (idp.competencyGaps.length) {
                <div class="gaps-section">
                  <h4>Competency Gaps</h4>
                  <mat-chip-set>
                    @for (gap of idp.competencyGaps; track gap) {
                      <mat-chip>{{ gap }}</mat-chip>
                    }
                  </mat-chip-set>
                </div>
              }
            </div>
          }
        </div>

        <!-- Coaching Journal -->
        <div class="section-card journal-section" style="margin-top: 40px;">
          <div class="section-header-row">
            <div class="section-header-left">
              <div class="section-icon green"><mat-icon>book</mat-icon></div>
              <div>
                <h3>Coaching Journal</h3>
                <p>Log progress insights, session reflections, and key decisions between coaching sessions.</p>
              </div>
            </div>
            <button mat-raised-button color="primary" (click)="showJournalForm.set(!showJournalForm())">
              <mat-icon>{{ showJournalForm() ? 'close' : 'add' }}</mat-icon>
              {{ showJournalForm() ? 'Cancel' : 'New Entry' }}
            </button>
          </div>

          <!-- New entry form -->
          @if (showJournalForm()) {
            <div class="journal-form">
              <div class="journal-form-row">
                <mat-form-field appearance="outline" class="journal-mood-field">
                  <mat-label>Mood / Energy</mat-label>
                  <mat-select [(ngModel)]="journalMood">
                    @for (n of moodOptions; track n) {
                      <mat-option [value]="n">{{ n }} / 10</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                @if (idps().length > 0) {
                  <mat-form-field appearance="outline" class="journal-idp-field">
                    <mat-label>Related IDP (optional)</mat-label>
                    <mat-select [(ngModel)]="journalIdpId">
                      <mat-option value="">— None —</mat-option>
                      @for (idp of idps(); track idp._id) {
                        <mat-option [value]="idp._id">{{ idp.goal | slice:0:60 }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                }
              </div>

              <!-- Prompt suggestion -->
              @if (!journalContent) {
                <div class="journal-prompts">
                  <p class="prompts-label">Pick a reflection prompt or write freely:</p>
                  <div class="prompts-grid">
                    @for (prompt of journalPrompts; track prompt) {
                      <button class="prompt-card" (click)="journalPrompt = prompt; journalContent = ''">
                        <mat-icon class="prompt-icon">chat_bubble_outline</mat-icon>
                        <span>{{ prompt }}</span>
                      </button>
                    }
                  </div>
                </div>
              }

              @if (journalPrompt) {
                <div class="selected-prompt">
                  <mat-icon>format_quote</mat-icon>
                  <span>{{ journalPrompt }}</span>
                  <button mat-icon-button (click)="journalPrompt = ''"><mat-icon>close</mat-icon></button>
                </div>
              }

              <mat-form-field appearance="outline" class="journal-content-field">
                <mat-label>Your reflection</mat-label>
                <textarea matInput [(ngModel)]="journalContent" rows="4"
                          placeholder="What's on your mind? Reflect on progress, challenges, or insights..."></textarea>
              </mat-form-field>

              <div class="journal-form-actions">
                <button mat-raised-button color="primary"
                        [disabled]="!journalContent?.trim() || journalSaving()"
                        (click)="saveJournalEntry()">
                  @if (journalSaving()) { <mat-spinner diameter="16" /> }
                  @else { <mat-icon>save</mat-icon> }
                  Save Entry
                </button>
              </div>
            </div>
          }

          <!-- Journal entries list -->
          @if (journalEntries().length > 0) {
            <div class="journal-entries">
              @for (entry of journalEntries(); track entry._id) {
                <div class="journal-entry">
                  <div class="entry-header">
                    <div class="entry-meta">
                      @if (isPopulatedUser(entry.userId)) {
                        <span class="entry-author">{{ entry.userId.firstName }} {{ entry.userId.lastName }}</span>
                      }
                      <span class="entry-date">{{ entry.createdAt | date:'MMM d, y — h:mm a' }}</span>
                      @if (entry.mood) {
                        <span class="entry-mood" [class]="moodClass(entry.mood)">{{ entry.mood }}/10</span>
                      }
                    </div>
                    <button mat-icon-button class="entry-delete" matTooltip="Delete" (click)="deleteJournalEntry(entry)">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                  @if (entry.prompt) {
                    <div class="entry-prompt">
                      <mat-icon>format_quote</mat-icon>
                      <span>{{ entry.prompt }}</span>
                    </div>
                  }
                  <p class="entry-content">{{ entry.content }}</p>
                  @if (entry.idpId && isPopulatedIdpRef(entry.idpId)) {
                    <div class="entry-idp-link">
                      <mat-icon>flag</mat-icon>
                      <span>{{ entry.idpId.goal | slice:0:80 }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          } @else if (!showJournalForm()) {
            <div class="journal-empty">
              <mat-icon>book</mat-icon>
              <span>No journal entries yet. Start reflecting on your coaching journey.</span>
            </div>
          }
        </div>

        <!-- Helena Coaching Integration -->
        <div class="section-card helena-section">
          <div class="section-header-row">
            <div class="section-header-left">
              <div class="section-icon orange"><mat-icon>video_call</mat-icon></div>
              <div>
                <h3>Helena Coaching Integration</h3>
                <p>Book coaching sessions, EQi-2.0 debriefs, and stakeholder alignment workshops directly through the platform. Helena's availability is synced and sessions are linked to your active IDPs.</p>
              </div>
            </div>
          </div>
          <div class="helena-services">
            @for (service of helenaServices; track service.title) {
              <div class="helena-service-card">
                <div class="service-icon" [style.background]="service.color + '15'" [style.color]="service.color">
                  <mat-icon>{{ service.icon }}</mat-icon>
                </div>
                <div class="service-info">
                  <strong>{{ service.title }}</strong>
                  <span>{{ service.description }}</span>
                  <div class="service-meta">
                    <span class="service-duration"><mat-icon>schedule</mat-icon> {{ service.duration }}</span>
                    <span class="service-price">{{ service.price }}</span>
                  </div>
                </div>
                <a [href]="'mailto:helena@helenacoaching.com?subject=Booking%20Request:%20' + service.title"
                   mat-stroked-button class="book-btn">
                  Book
                </a>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .idp-page { padding: 32px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; } p { color: #5a6a7e; margin: 0; } }

    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .empty-state {
      text-align: center; padding: 64px; background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      mat-icon { font-size: 64px; width: 64px; height: 64px; color: #3A9FD6; margin-bottom: 16px; }
      h3 { font-size: 20px; color: #1B2A47; margin-bottom: 8px; }
      p  { color: #5a6a7e; margin-bottom: 24px; }
    }

    .idp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); gap: 24px; }

    .idp-card {
      background: white; border-radius: 16px; padding: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      &.status-active   { border-top: 3px solid #3A9FD6; background: azure;}
      &.status-draft    { border-top: 3px solid #9aa5b4; background: lavenderblush;}
      &.status-completed{ border-top: 3px solid #27C4A0; background: lightgrey;}
    }

    .idp-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; .idp-date { margin-left: auto; } }
    .idp-coachee-name {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 12px; font-weight: 600; color: #1B2A47;
      background: rgba(27,42,71,0.07); border-radius: 20px;
      padding: 2px 8px 2px 4px;
      .coachee-icon { font-size: 14px; width: 14px; height: 14px; color: #3A9FD6; }
    }
    .card-action-btn {
      display: flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; flex-shrink: 0;
      background: none; border: none; border-radius: 50%; cursor: pointer;
      color: rgba(0,0,0,0.35); padding: 0;
      transition: background 0.15s, color 0.15s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; line-height: 18px; }
      &:hover:not([disabled]) { background: rgba(58,159,214,0.1); color: #3A9FD6; }
      &[disabled] { cursor: default; opacity: 0.5; }
      &.delete-btn:hover:not([disabled]) { background: rgba(229,62,62,0.1); color: #e53e3e; }
    }
    .idp-status-badge {
      padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      &.active    { background: rgba(58,159,214,0.15); color: #2080b0; }
      &.draft     { background: rgba(154,165,180,0.15); color: #5a6a7e; }
      &.completed { background: rgba(39,196,160,0.15);  color: #1a9678; }
    }
    .idp-date { font-size: 12px; color: #9aa5b4; }

    .grow-accordion { margin-bottom: 20px; }
    .grow-panel {
      &.goal-panel    ::ng-deep .mat-expansion-panel-header-title mat-icon { color: #3A9FD6; }
      &.reality-panel ::ng-deep .mat-expansion-panel-header-title mat-icon { color: #27C4A0; }
      &.options-panel ::ng-deep .mat-expansion-panel-header-title mat-icon { color: #f0a500; }
      &.will-panel    ::ng-deep .mat-expansion-panel-header-title mat-icon { color: #e86c3a; }
    }
    ::ng-deep .mat-expansion-panel-header-title { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    ul { margin: 0; padding-left: 20px; li { margin-bottom: 6px; font-size: 14px; color: #5a6a7e; } }

    .milestone-section { margin-bottom: 16px; margin-top: 16px; h4 { font-size: 14px; color: #1B2A47; margin-bottom: 12px; } }
    .milestone-timeline { display: flex; flex-direction: column; gap: 8px; }
    .milestone-item {
      display: flex; align-items: center; gap: 10px;
      .ms-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; background: #dce6f0; }
      .ms-content { flex: 1; .ms-title { display: block; font-size: 13px; color: #1B2A47; } .ms-date { font-size: 11px; color: #9aa5b4; } }
      &.completed .ms-dot { background: #27C4A0; }
      &.in_progress .ms-dot { background: #3A9FD6; }
      &.pending .ms-dot { background: #dce6f0; border: 2px solid #9aa5b4; }
    }

    .gaps-section { h4 { font-size: 14px; color: #1B2A47; margin-bottom: 8px; } }

    /* ── Module banner ── */
    .module-banner {
      background: linear-gradient(135deg, #1B2A47 0%, #253659 100%);
      border-radius: 16px; padding: 24px 28px; margin-bottom: 24px; color: white;
    }
    .banner-insight {
      display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px;
      .banner-icon { color: #f0c040; font-size: 22px; flex-shrink: 0; margin-top: 2px; }
      p { font-size: 13.5px; color: rgba(255,255,255,0.88); line-height: 1.7; margin: 0; }
      strong { color: white; }
    }
    .banner-features { display: flex; flex-wrap: wrap; gap: 8px; }
    .feature-pill {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 12px; background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.18); border-radius: 20px;
      font-size: 12px; color: rgba(255,255,255,0.9);
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    /* ── Section cards ── */
    .section-card {
      background: white; border-radius: 16px; padding: 28px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 20px;
    }
    .section-header-row {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 16px; margin-bottom: 24px;
    }
    .section-header-left {
      display: flex; gap: 16px; align-items: flex-start;
      h3 { font-size: 17px; color: #1B2A47; margin: 0 0 4px; font-weight: 700; }
      p  { font-size: 13px; color: #5a6a7e; margin: 0; line-height: 1.6; }
    }
    .section-icon {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 22px; }
      &.blue   { background: rgba(58,159,214,0.12); color: #2b8bbf; }
      &.green  { background: rgba(39,196,160,0.12); color: #1a9678; }
      &.orange { background: rgba(232,108,58,0.12); color: #e86c3a; }
    }

    /* ── Scorecard ── */
    .scorecard-grid {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px;
    }
    .scorecard-metric {
      text-align: center; padding: 16px 12px;
      background: #f8fafc; border-radius: 12px; border: 1px solid #e8edf4;
    }
    .metric-value { font-size: 28px; font-weight: 800; line-height: 1; margin-bottom: 6px; }
    .metric-label { font-size: 12px; color: #5a6a7e; font-weight: 500; }
    .metric-sub   { font-size: 11px; color: #9aa5b4; margin-top: 3px; }

    /* ── Journal ── */
    .journal-form {
      background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;
      border: 1px solid #e8edf4;
    }
    .journal-form-row {
      display: flex; gap: 12px; margin-bottom: 8px;
    }
    .journal-mood-field { width: 140px; }
    .journal-idp-field { flex: 1; }
    .journal-content-field { width: 100%; }
    .journal-form-actions { display: flex; justify-content: flex-end; }

    .prompts-label { font-size: 12px; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin: 0 0 12px; }
    .prompts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px; }
    .prompt-card {
      display: flex; gap: 10px; align-items: flex-start;
      background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 12px 14px;
      font-size: 13px; color: #374151; line-height: 1.5; cursor: pointer;
      text-align: left; transition: background 0.15s;
      &:hover { background: #e0f2fe; }
      .prompt-icon { color: #3A9FD6; font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; }
    }

    .selected-prompt {
      display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
      background: #EBF5FB; border-radius: 8px; padding: 10px 14px;
      font-size: 13px; color: #2080b0; font-style: italic;
      mat-icon { color: #3A9FD6; font-size: 18px; flex-shrink: 0; }
      span { flex: 1; }
      button { width: 24px; height: 24px; color: #9aa5b4; }
    }

    .journal-entries { display: flex; flex-direction: column; gap: 12px; }

    .journal-entry {
      border: 1px solid #e8edf4; border-radius: 12px; padding: 16px; background: #fafbfc;
    }

    .entry-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
    }

    .entry-meta {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }

    .entry-author { font-size: 13px; font-weight: 600; color: #1B2A47; }
    .entry-date { font-size: 12px; color: #9aa5b4; }
    .entry-mood {
      font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
      &.mood-high { background: #e8faf4; color: #1a9678; }
      &.mood-mid  { background: #FFF8E6; color: #b07800; }
      &.mood-low  { background: #fef2f2; color: #c53030; }
    }

    .entry-delete { width: 28px; height: 28px; color: #c5d0db; &:hover { color: #e53e3e; } }

    .entry-prompt {
      display: flex; align-items: flex-start; gap: 6px; margin-bottom: 8px;
      font-size: 12px; color: #3A9FD6; font-style: italic;
      mat-icon { font-size: 14px; width: 14px; height: 14px; margin-top: 1px; }
    }

    .entry-content {
      font-size: 14px; color: #374151; line-height: 1.7; margin: 0;
      white-space: pre-wrap;
    }

    .entry-idp-link {
      display: flex; align-items: center; gap: 6px; margin-top: 8px;
      font-size: 12px; color: #5a6a7e;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #3A9FD6; }
    }

    .journal-empty {
      display: flex; align-items: center; gap: 12px; padding: 24px; color: #9aa5b4;
      mat-icon { font-size: 24px; width: 24px; height: 24px; color: #c5d0db; }
      span { font-size: 14px; }
    }

    /* ── Helena services ── */
    .helena-services { display: flex; flex-direction: column; gap: 12px; }
    .helena-service-card {
      display: flex; align-items: center; gap: 16px;
      border: 1px solid #e8edf4; border-radius: 12px; padding: 16px;
      background: #fafbfc; transition: background 0.15s;
      &:hover { background: #f0f4f8; }
    }
    .service-icon {
      width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 22px; }
    }
    .service-info {
      flex: 1; display: flex; flex-direction: column; gap: 3px;
      strong { font-size: 14px; color: #1B2A47; }
      span   { font-size: 12px; color: #5a6a7e; }
    }
    .service-meta { display: flex; align-items: center; gap: 14px; margin-top: 4px; }
    .service-duration {
      display: flex; align-items: center; gap: 3px;
      font-size: 11px; color: #9aa5b4;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
    }
    .service-price { font-size: 12px; font-weight: 700; color: #1B2A47; }
    .book-btn { color: #e86c3a; border-color: #e86c3a; flex-shrink: 0; }
  `],
})
export class IDPViewComponent implements OnInit {
  private auth = inject(AuthService);

  idps = signal<IDP[]>([]);
  loading = signal(true);
  regeneratingId = signal<string | null>(null);

  /** Roles that can generate, regenerate IDPs and mark milestones */
  canManage = computed(() => {
    const role = this.auth.currentUser()?.role;
    return role === 'admin' || role === 'hr_manager' || role === 'coach' || role === 'manager' || role === 'system_admin';
  });

  /** Roles that can delete IDPs */
  canDelete = computed(() => {
    const role = this.auth.currentUser()?.role;
    return role === 'admin' || role === 'hr_manager' || role === 'coach';
  });

  /** Show coachee name on cards for everyone except the coachee themselves */
  showCoacheeName = computed(() => this.auth.currentUser()?.role !== 'coachee');

  isPopulatedCoachee(val: IDP['coacheeId']): val is { _id: string; firstName: string; lastName: string; email: string } {
    return typeof val === 'object' && val !== null && 'firstName' in val;
  }

  // ── Journal ──────────────────────────────────────────────────
  journalEntries = signal<JournalEntry[]>([]);
  showJournalForm = signal(false);
  journalSaving = signal(false);
  journalContent = '';
  journalPrompt = '';
  journalMood: number | null = null;
  journalIdpId = '';
  moodOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  journalPrompts = [
    'What progress have you made toward your goal since your last session?',
    'What obstacles are you encountering — and what\'s really driving them?',
    'Which of your GROW options have you acted on, and what did you learn?',
    'What support do you need from your manager or mentor right now?',
    'On a scale of 1–10, how confident are you in achieving your 90-day milestone?',
    'What would "success" look like at your next coaching session?',
  ];

  loadJournal(): void {
    this.api.get<JournalEntry[]>('/succession/journal').subscribe({
      next: (entries) => this.journalEntries.set(entries),
    });
  }

  saveJournalEntry(): void {
    if (!this.journalContent?.trim()) return;
    this.journalSaving.set(true);
    this.api.post<JournalEntry>('/succession/journal', {
      content: this.journalContent,
      prompt: this.journalPrompt || undefined,
      mood: this.journalMood || undefined,
      idpId: this.journalIdpId || undefined,
    }).subscribe({
      next: () => {
        this.journalSaving.set(false);
        this.journalContent = '';
        this.journalPrompt = '';
        this.journalMood = null;
        this.journalIdpId = '';
        this.showJournalForm.set(false);
        this.loadJournal();
        this.snackBar.open('Journal entry saved', 'OK', { duration: 3000 });
      },
      error: () => {
        this.journalSaving.set(false);
        this.snackBar.open('Failed to save entry', 'Dismiss', { duration: 3000 });
      },
    });
  }

  deleteJournalEntry(entry: JournalEntry): void {
    if (!confirm('Delete this journal entry?')) return;
    this.api.delete(`/succession/journal/${entry._id}`).subscribe({
      next: () => {
        this.journalEntries.update((list) => list.filter((e) => e._id !== entry._id));
        this.snackBar.open('Entry deleted', 'OK', { duration: 3000 });
      },
    });
  }

  isPopulatedUser(u: JournalEntry['userId']): u is { _id: string; firstName: string; lastName: string } {
    return typeof u === 'object' && u !== null;
  }

  isPopulatedIdpRef(ref: JournalEntry['idpId']): ref is { _id: string; goal: string } {
    return typeof ref === 'object' && ref !== null;
  }

  moodClass(mood: number): string {
    if (mood >= 8) return 'mood-high';
    if (mood >= 5) return 'mood-mid';
    return 'mood-low';
  }

  helenaServices = [
    {
      title: 'EQi-2.0 Leadership Assessment & Debrief',
      description: 'Full emotional intelligence assessment with a 60-min debrief session. Results integrated directly into your IDP competency framework.',
      icon: 'psychology',
      color: '#3A9FD6',
      duration: '60 min debrief',
      price: 'CAD $1,200',
    },
    {
      title: 'GROW Coaching Session',
      description: 'Individual coaching session using the GROW model, aligned to your active IDP goals and milestones.',
      icon: 'emoji_people',
      color: '#27C4A0',
      duration: '60 min',
      price: 'CAD $350/session',
    },
    {
      title: 'Stakeholder Alignment Workshop',
      description: 'Facilitated 90-min session with the coachee, manager, and HR to align on IDP goals, success criteria, and organizational support.',
      icon: 'groups',
      color: '#e86c3a',
      duration: '90 min',
      price: 'CAD $650',
    },
    {
      title: 'Succession Planning Strategy Day',
      description: 'Full-day facilitated session with leadership team to map bench strength, identify critical roles, and build organizational succession strategy.',
      icon: 'corporate_fare',
      color: '#7c3aed',
      duration: 'Full day',
      price: 'CAD $3,200',
    },
  ];

  scorecardMetrics(idps: IDP[]): Array<{ label: string; value: string; sub?: string; color: string }> {
    const active    = idps.filter((i) => i.status === 'active').length;
    const completed = idps.filter((i) => i.status === 'completed').length;
    const total     = idps.length;

    const allMilestones   = idps.flatMap((i) => i.milestones);
    const doneMilestones  = allMilestones.filter((m) => m.status === 'completed').length;
    const milestoneRate   = allMilestones.length
      ? Math.round((doneMilestones / allMilestones.length) * 100)
      : 0;

    const allGaps = new Set(idps.flatMap((i) => i.competencyGaps));

    return [
      { label: 'Active Plans',         value: String(active),    color: '#3A9FD6' },
      { label: 'Completed Plans',       value: String(completed), sub: `of ${total} total`, color: '#27C4A0' },
      { label: 'Milestone Completion',  value: `${milestoneRate}%`, sub: `${doneMilestones} of ${allMilestones.length}`, color: milestoneRate >= 70 ? '#27C4A0' : milestoneRate >= 40 ? '#f0a500' : '#e53e3e' },
      { label: 'Competency Gaps Tracked', value: String(allGaps.size), color: '#e86c3a' },
      { label: 'Bench Readiness',       value: total >= 3 ? 'Strong' : total >= 1 ? 'Building' : 'Gaps', color: total >= 3 ? '#27C4A0' : '#f0a500' },
    ];
  }

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}


  ngOnInit(): void {
    this.loadIDPs();
    this.loadJournal();
  }

  loadIDPs(): void {
    this.api.get<IDP[]>('/succession/idps?module=succession').subscribe({
      next: (data) => { this.idps.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  updateMilestone(idpId: string, milestoneId: string, status: string): void {
    this.api.put(`/succession/idps/${idpId}/milestone`, { milestoneId, status }).subscribe({
      next: () => this.loadIDPs(),
    });
  }

  regenerate(idp: IDP): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Regenerate IDP',
        message: 'The current GROW content and milestones will be replaced with a new AI-generated plan.',
        confirmLabel: 'Regenerate',
        confirmColor: 'primary',
        icon: 'auto_awesome',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.regeneratingId.set(idp._id);
      this.api.post<IDP>(`/succession/idps/${idp._id}/regenerate`, {}).subscribe({
        next: (updated) => {
          this.idps.update((list) => list.map((i) => (i._id === updated._id ? updated : i)));
          this.regeneratingId.set(null);
          this.snackBar.open('IDP regenerated successfully', 'Close', { duration: 3000 });
        },
        error: (err) => {
          this.regeneratingId.set(null);
          this.snackBar.open(err?.error?.error ?? 'Regeneration failed', 'Close', { duration: 4000 });
        },
      });
    });
  }

  deleteIdp(idp: IDP): void {
    const coacheeName = this.isPopulatedCoachee(idp.coacheeId)
      ? `${idp.coacheeId.firstName} ${idp.coacheeId.lastName}`
      : 'this coachee';
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete IDP',
        message: `Delete the development plan for ${coacheeName}? This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmColor: 'warn',
        icon: 'delete_outline',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.delete(`/succession/idps/${idp._id}`).subscribe({
        next: () => {
          this.idps.update((list) => list.filter((i) => i._id !== idp._id));
          this.snackBar.open('IDP deleted', 'Close', { duration: 2500 });
        },
        error: () => this.snackBar.open('Delete failed', 'Close', { duration: 3000 }),
      });
    });
  }

  generateNew(): void {
    const ref = this.dialog.open(IdpGenerateDialogComponent, {
      width: '640px',
      disableClose: true,
    });

    ref.afterClosed().subscribe((result) => {
      if (result) this.loadIDPs();
    });
  }
}
