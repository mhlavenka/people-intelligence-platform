import {
  Component, OnInit, signal, computed,
  ElementRef, ViewChild, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragEnd, CdkDragMove } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';

// ── Layout constants ──────────────────────────────────────────────────────────
const NW   = 300;   // node width
const NH   = 92;    // node height
const HGAP = 44;    // horizontal gap between sibling subtrees
const VGAP = 88;    // vertical gap between levels
const PAD  = 60;    // canvas padding

interface OrgUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department?: string;
  managerId: string | null;
}

interface LayoutNode extends OrgUser {
  x: number;
  y: number;
}

interface OrgLine {
  id: string;
  d: string;
}

// ── Layout algorithm ──────────────────────────────────────────────────────────
function buildChildrenMap(users: OrgUser[]): Map<string | null, string[]> {
  const map = new Map<string | null, string[]>();
  for (const u of users) {
    if (!map.has(u.managerId)) map.set(u.managerId, []);
    map.get(u.managerId)!.push(u._id);
  }
  return map;
}

function subtreeWidth(id: string, childrenMap: Map<string | null, string[]>): number {
  const children = childrenMap.get(id) ?? [];
  if (!children.length) return NW;
  const childWidths = children.map((c) => subtreeWidth(c, childrenMap));
  return Math.max(NW, childWidths.reduce((s, w) => s + w, 0) + HGAP * (children.length - 1));
}

function assignPositions(
  id: string,
  cx: number,
  y: number,
  childrenMap: Map<string | null, string[]>,
  widths: Map<string, number>,
  pos: Map<string, { x: number; y: number }>,
): void {
  pos.set(id, { x: cx - NW / 2, y });
  const children = childrenMap.get(id) ?? [];
  if (!children.length) return;
  const total = children.reduce((s, c) => s + (widths.get(c) ?? NW) + HGAP, -HGAP);
  let curX = cx - total / 2;
  for (const childId of children) {
    const cw = widths.get(childId) ?? NW;
    assignPositions(childId, curX + cw / 2, y + NH + VGAP, childrenMap, widths, pos);
    curX += cw + HGAP;
  }
}

function computeLayout(users: OrgUser[]): LayoutNode[] {
  if (!users.length) return [];

  const allIds = new Set(users.map((u) => u._id));
  // Normalize managerId — treat references to missing users as null
  const normalised = users.map((u) => ({
    ...u,
    managerId: u.managerId && allIds.has(u.managerId) ? u.managerId : null,
  }));

  const childrenMap = buildChildrenMap(normalised);
  const roots = normalised.filter((u) => u.managerId === null);

  // Pre-compute subtree widths
  const widths = new Map<string, number>();
  for (const r of roots) {
    const calc = (id: string): number => {
      const children = childrenMap.get(id) ?? [];
      const w = !children.length
        ? NW
        : Math.max(NW, children.reduce((s, c) => s + calc(c) + HGAP, -HGAP));
      widths.set(id, w);
      return w;
    };
    calc(r._id);
  }

  // Assign absolute positions
  const pos = new Map<string, { x: number; y: number }>();
  let curX = PAD;
  for (const r of roots) {
    const rw = widths.get(r._id) ?? NW;
    assignPositions(r._id, curX + rw / 2, PAD, childrenMap, widths, pos);
    curX += rw + HGAP * 2;
  }

  return normalised.map((u) => ({
    ...u,
    x: pos.get(u._id)?.x ?? 0,
    y: pos.get(u._id)?.y ?? 0,
  }));
}

function computeLines(nodes: LayoutNode[]): OrgLine[] {
  const map = new Map(nodes.map((n) => [n._id, n]));
  return nodes
    .filter((n) => n.managerId && map.has(n.managerId))
    .map((n) => {
      const p = map.get(n.managerId!)!;
      const x1 = p.x + NW / 2;
      const y1 = p.y + NH;
      const x2 = n.x + NW / 2;
      const y2 = n.y;
      const my = (y1 + y2) / 2;
      return {
        id: `${p._id}>${n._id}`,
        d: `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`,
      };
    });
}

function isDescendant(targetId: string, ancestorId: string, childrenMap: Map<string | null, string[]>): boolean {
  const children = childrenMap.get(ancestorId) ?? [];
  return children.includes(targetId) || children.some((c) => isDescendant(targetId, c, childrenMap));
}

// ── Role helpers ──────────────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
  admin:      '#1B2A47',
  hr_manager: '#2080b0',
  manager:    '#b07800',
  coach:      '#1a9678',
  coachee:    '#5a6a7e',
};

const ROLE_LABEL: Record<string, string> = {
  admin:      'Admin',
  hr_manager: 'HR Manager',
  manager:    'Manager',
  coach:      'Coach',
  coachee:    'Employee',
};

const DEPT_PALETTE = [
  '#6366f1', '#f59e0b', '#ef4444', '#10b981',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#06b6d4', '#84cc16',
];

@Component({
  selector: 'app-org-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DragDropModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="oc-page">

      <!-- ── Header ───────────────────────────────────────────────────────── -->
      <div class="oc-header">
        <div class="header-left">
          <div>
            <h1>Organizational Chart</h1>
            <p>Drag a person card onto another to set their reporting line. Drop on an empty area to make them a top-level node.</p>
          </div>
          @if (departments().length) {
            <div class="dept-filters">
              <button class="dept-chip" [class.active]="deptFilter() === null"
                      (click)="deptFilter.set(null)">All</button>
              @for (dept of departments(); track dept) {
                <button class="dept-chip"
                        [class.active]="deptFilter() === dept"
                        [style.--chip-color]="deptColor(dept)"
                        (click)="deptFilter.set(deptFilter() === dept ? null : dept)">
                  {{ dept }}
                </button>
              }
            </div>
          }
        </div>
        <div class="header-actions">
          <div class="zoom-controls">
            <button mat-icon-button (click)="zoomOut()" [disabled]="zoom() <= 0.4" matTooltip="Zoom out">
              <mat-icon>remove</mat-icon>
            </button>
            <span class="zoom-label">{{ (zoom() * 100) | number:'1.0-0' }}%</span>
            <button mat-icon-button (click)="zoomIn()"  [disabled]="zoom() >= 1.6" matTooltip="Zoom in">
              <mat-icon>add</mat-icon>
            </button>
            <button mat-icon-button (click)="zoom.set(1)" matTooltip="Reset zoom">
              <mat-icon>center_focus_strong</mat-icon>
            </button>
          </div>
          @if (hasChanges()) {
            <button mat-stroked-button (click)="discard()" [disabled]="saving()">
              <mat-icon>undo</mat-icon> Discard
            </button>
            <button mat-raised-button color="primary" (click)="save()" [disabled]="saving()">
              @if (saving()) {
                <mat-spinner diameter="16" />
              } @else {
                <mat-icon>save</mat-icon>
              }
              Save
            </button>
          }
        </div>
      </div>

      <!-- ── Canvas ───────────────────────────────────────────────────────── -->
      @if (loading()) {
        <div class="oc-loading"><mat-spinner /></div>
      } @else {
        <div class="oc-canvas-wrap" #canvasWrap>
          <div class="oc-canvas"
               #canvas
               [style.width.px]="canvasSize().w"
               [style.height.px]="canvasSize().h"
               [style.transform]="'scale(' + zoom() + ')'"
               [style.transformOrigin]="'top left'">

            <!-- SVG connector lines -->
            <svg class="oc-lines"
                 [attr.width]="canvasSize().w"
                 [attr.height]="canvasSize().h">
              @for (line of lines(); track line.id) {
                <path [attr.d]="line.d" class="connector" />
              }
            </svg>

            <!-- Nodes -->
            @for (node of layoutNodes(); track node._id) {
              <div class="oc-node"
                   cdkDrag
                   [cdkDragDisabled]="saving()"
                   [style.left.px]="node.x"
                   [style.top.px]="node.y"
                   [style.width.px]="NW"
                   [class.drop-target]="hoveredId() === node._id"
                   [class.dragging]="draggingId() === node._id"
                   (cdkDragStarted)="draggingId.set(node._id)"
                   (cdkDragMoved)="onDragMoved($event, node)"
                   (cdkDragEnded)="onDragEnded($event, node)">

                <!-- drag handle -->
                <div class="node-drag-handle" cdkDragHandle matTooltip="Drag to reassign">
                  <mat-icon>drag_indicator</mat-icon>
                </div>

                <!-- avatar -->
                <div class="node-avatar"
                     [style.background]="roleColor(node.role) + '22'"
                     [style.color]="roleColor(node.role)">
                  {{ initials(node) }}
                </div>

                <!-- info -->
                <div class="node-info">
                  <span class="node-name">{{ node.firstName }} {{ node.lastName }}</span>
                  <div class="node-badges">
                    <span class="node-role-badge"
                          [style.background]="roleColor(node.role) + '18'"
                          [style.color]="roleColor(node.role)">
                      {{ roleLabel(node.role) }}
                    </span>
                    @if (node.department) {
                      <span class="node-dept-badge"
                            [style.background]="deptColor(node.department) + '18'"
                            [style.color]="deptColor(node.department)">
                        {{ node.department }}
                      </span>
                    }
                  </div>
                  <span class="node-email">{{ node.email }}</span>
                </div>

                <!-- remove manager button -->
                @if (node.managerId) {
                  <button class="node-unlink-btn"
                          matTooltip="Remove from reporting line"
                          (click)="unlinkManager(node._id); $event.stopPropagation()">
                    <mat-icon>link_off</mat-icon>
                  </button>
                }

                <!-- CDK drag placeholder -->
                <div *cdkDragPlaceholder class="drag-placeholder"></div>
              </div>
            }

          </div>
        </div>
      }

      <!-- ── Legend ────────────────────────────────────────────────────────── -->
      @if (!loading()) {
        <div class="oc-legend">
          @for (entry of legendEntries; track entry.role) {
            <span class="legend-dot" [style.background]="entry.color"></span>
            <span class="legend-label">{{ entry.label }}</span>
          }
          @if (departments().length) {
            <span class="legend-sep">|</span>
            @for (dept of departments(); track dept) {
              <span class="legend-dot" [style.background]="deptColor(dept)"></span>
              <span class="legend-label">{{ dept }}</span>
            }
          }
          <span class="legend-sep">|</span>
          <mat-icon class="legend-icon">drag_indicator</mat-icon>
          <span class="legend-label">Drag to reassign</span>
          <span class="legend-sep">|</span>
          <mat-icon class="legend-icon">link_off</mat-icon>
          <span class="legend-label">Remove from hierarchy</span>
        </div>
      }
    </div>
  `,
  styles: [`
    /* ── Page shell ──────────────────────────────────────────────────────── */
    .oc-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f0f4f8;
      overflow: hidden;
    }

    .oc-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 24px 12px;
      background: white;
      border-bottom: 1px solid #e8edf4;
      flex-shrink: 0;

      h1 { font-size: 22px; font-weight: 700; color: var(--artes-primary); margin: 0 0 2px; }
      p  { font-size: 13px; color: #5a6a7e; margin: 0 0 10px; }
    }

    .header-left {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .dept-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .dept-chip {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 20px;
      border: 1px solid #e8edf4;
      background: #f5f7fa;
      color: #5a6a7e;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
      &:hover { background: #e8f4fb; border-color: var(--artes-accent); color: #2080b0; }
      &.active {
        background: #e8f4fb;
        border-color: var(--chip-color, #3A9FD6);
        color: var(--chip-color, #3A9FD6);
        font-weight: 700;
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 2px;
      background: #f5f7fa;
      border: 1px solid #e8edf4;
      border-radius: 8px;
      padding: 2px 8px;

      .zoom-label {
        font-size: 12px;
        font-weight: 600;
        color: #5a6a7e;
        min-width: 38px;
        text-align: center;
      }
    }

    /* ── Canvas area ─────────────────────────────────────────────────────── */
    .oc-loading {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .oc-canvas-wrap {
      flex: 1;
      overflow: auto;
      padding: 0;
      background: #f0f4f8;
      /* subtle grid */
      background-image:
        radial-gradient(circle, #c8d6e5 1px, transparent 1px);
      background-size: 28px 28px;
    }

    .oc-canvas {
      position: relative;
      transform-origin: top left;
      /* size is set via binding */
    }

    /* ── SVG lines ───────────────────────────────────────────────────────── */
    .oc-lines {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      overflow: visible;
    }

    .connector {
      fill: none;
      stroke: #b0c4d8;
      stroke-width: 2;
      stroke-dasharray: none;
    }

    /* ── Node cards ──────────────────────────────────────────────────────── */
    .oc-node {
      position: absolute;
      height: ${NH}px;
      background: white;
      border-radius: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.09);
      border: 2px solid transparent;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 10px 0 4px;
      cursor: default;
      transition: box-shadow 0.15s, border-color 0.15s;
      box-sizing: border-box;
      user-select: none;

      &:hover { box-shadow: 0 4px 18px rgba(0,0,0,0.13); }

      &.drop-target {
        border-color: var(--artes-accent);
        box-shadow: 0 0 0 3px rgba(58,159,214,0.2), 0 4px 18px rgba(0,0,0,0.13);
      }

      &.dragging {
        opacity: 0.5;
        box-shadow: 0 8px 32px rgba(0,0,0,0.22);
        z-index: 1000;
      }

      /* CDK drag override — show grab cursor on handle */
      &.cdk-drag-dragging { opacity: 0.9; z-index: 1000; }
    }

    .node-drag-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      flex-shrink: 0;
      cursor: grab;
      color: #c8d6e5;
      &:hover { color: var(--artes-accent); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .node-avatar {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
    }

    .node-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .node-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--artes-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .node-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .node-role-badge, .node-dept-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 2px 6px;
      border-radius: 20px;
      width: fit-content;
    }

    .node-email {
      font-size: 10px;
      color: #9aa5b4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .node-unlink-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      background: none;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: #c8d6e5;
      padding: 0;
      &:hover { background: #fee2e2; color: #ef4444; }
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }

    .drag-placeholder {
      width: ${NW}px;
      height: ${NH}px;
      border: 2px dashed #3A9FD6;
      border-radius: 14px;
      background: rgba(58,159,214,0.05);
    }

    /* CDK drag preview */
    .cdk-drag-preview {
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.22);
      opacity: 0.95;
    }

    /* ── Legend ──────────────────────────────────────────────────────────── */
    .oc-legend {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 24px;
      background: white;
      border-top: 1px solid #e8edf4;
      font-size: 12px;
      color: #5a6a7e;
      flex-shrink: 0;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .legend-label { white-space: nowrap; }
    .legend-sep { color: #d1d5db; }

    .legend-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #9aa5b4;
    }
  `],
})
export class OrgChartComponent implements OnInit {
  @ViewChild('canvasWrap') canvasWrap!: ElementRef<HTMLDivElement>;
  @ViewChild('canvas')     canvas!:     ElementRef<HTMLDivElement>;

  NW = NW;

  loading  = signal(true);
  saving   = signal(false);
  zoom     = signal(1);
  deptFilter = signal<string | null>(null);

  /** Source of truth — mutated on drag, reset on discard, sent on save */
  users         = signal<OrgUser[]>([]);
  originalUsers = signal<OrgUser[]>([]);

  hoveredId  = signal<string | null>(null);
  draggingId = signal<string | null>(null);

  hasChanges = computed(() => {
    const a = this.users();
    const b = this.originalUsers();
    return JSON.stringify(a.map((u) => ({ _id: u._id, managerId: u.managerId }))) !==
           JSON.stringify(b.map((u) => ({ _id: u._id, managerId: u.managerId })));
  });

  departments = computed(() =>
    [...new Set(this.users().map((u) => u.department).filter((d): d is string => !!d))].sort()
  );

  deptColorMap = computed(() => {
    const map = new Map<string, string>();
    this.departments().forEach((d, i) => map.set(d, DEPT_PALETTE[i % DEPT_PALETTE.length]));
    return map;
  });

  filteredUsers = computed(() => {
    const f = this.deptFilter();
    return f ? this.users().filter((u) => u.department === f) : this.users();
  });

  layoutNodes = computed(() => computeLayout(this.filteredUsers()));
  lines       = computed(() => computeLines(this.layoutNodes()));

  canvasSize = computed(() => {
    const nodes = this.layoutNodes();
    if (!nodes.length) return { w: 900, h: 600 };
    return {
      w: Math.max(900,  Math.max(...nodes.map((n) => n.x + NW))  + PAD),
      h: Math.max(600,  Math.max(...nodes.map((n) => n.y + NH))  + PAD),
    };
  });

  legendEntries = Object.entries(ROLE_LABEL).map(([role, label]) => ({
    role, label, color: ROLE_COLOR[role] ?? '#888',
  }));

  constructor(private api: ApiService, private snack: MatSnackBar) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.api.get<OrgUser[]>('/org-chart').subscribe({
      next: (data) => {
        // Normalise managerId — API may return object or null string
        const clean = data.map((u) => ({
          ...u,
          managerId: u.managerId ?? null,
        }));
        this.users.set(clean);
        this.originalUsers.set(structuredClone(clean));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snack.open('Failed to load org chart', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  onDragMoved(event: CdkDragMove, dragged: LayoutNode): void {
    const target = this.nodeAtPointer(event.pointerPosition.x, event.pointerPosition.y, dragged._id);
    this.hoveredId.set(target?._id ?? null);
  }

  onDragEnded(event: CdkDragEnd, dragged: LayoutNode): void {
    // Immediately reset CDK's visual transform — layout is managed by signals
    event.source.reset();

    const target = this.nodeAtPointer(event.dropPoint.x, event.dropPoint.y, dragged._id);
    this.hoveredId.set(null);
    this.draggingId.set(null);

    if (target) {
      // Don't allow dropping onto a descendant (cycle prevention)
      const childrenMap = buildChildrenMap(this.users());
      if (isDescendant(target._id, dragged._id, childrenMap)) return;
      if (dragged.managerId === target._id) return; // no-op, same manager
      this.updateManager(dragged._id, target._id);
    } else {
      // Dropped on background → make root
      if (dragged.managerId !== null) {
        this.updateManager(dragged._id, null);
      }
    }
  }

  unlinkManager(userId: string): void {
    this.updateManager(userId, null);
  }

  private updateManager(userId: string, managerId: string | null): void {
    this.users.update((list) =>
      list.map((u) => (u._id === userId ? { ...u, managerId } : u))
    );
  }

  private nodeAtPointer(screenX: number, screenY: number, excludeId: string): LayoutNode | null {
    if (!this.canvas?.nativeElement || !this.canvasWrap?.nativeElement) return null;

    const rect   = this.canvas.nativeElement.getBoundingClientRect();
    const z      = this.zoom();
    const canvasX = (screenX - rect.left) / z;
    const canvasY = (screenY - rect.top)  / z;

    return this.layoutNodes().find(
      (n) =>
        n._id !== excludeId &&
        canvasX >= n.x && canvasX <= n.x + NW &&
        canvasY >= n.y && canvasY <= n.y + NH,
    ) ?? null;
  }

  // ── Zoom ─────────────────────────────────────────────────────────────────────
  zoomIn():  void { this.zoom.update((z) => Math.min(1.6, +(z + 0.1).toFixed(1))); }
  zoomOut(): void { this.zoom.update((z) => Math.max(0.4, +(z - 0.1).toFixed(1))); }

  // ── Save / Discard ───────────────────────────────────────────────────────────
  save(): void {
    this.saving.set(true);
    const updates = this.users().map((u) => ({ userId: u._id, managerId: u.managerId }));
    this.api.put('/org-chart', { updates }).subscribe({
      next: () => {
        this.originalUsers.set(structuredClone(this.users()));
        this.saving.set(false);
        this.snack.open('Org chart saved', 'Close', { duration: 2500 });
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Failed to save — please try again', 'Close', { duration: 3000 });
      },
    });
  }

  discard(): void {
    this.users.set(structuredClone(this.originalUsers()));
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  initials  = (n: OrgUser) => `${n.firstName[0]}${n.lastName[0]}`.toUpperCase();
  roleColor = (role: string) => ROLE_COLOR[role] ?? '#5a6a7e';
  roleLabel = (role: string) => ROLE_LABEL[role] ?? role;
  deptColor = (dept?: string) => (dept ? (this.deptColorMap().get(dept) ?? '#9aa5b4') : '#9aa5b4');
}
