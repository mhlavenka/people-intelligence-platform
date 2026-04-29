import { Injectable } from '@angular/core';

export interface OrgTheme {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;     // cards
  panelColor?: string;       // sections / panels (wraps cards)
  headingFont?: string;
  bodyFont?: string;
  borderRadius?: 'sharp' | 'rounded' | 'pill';
}

const DEFAULTS: Required<OrgTheme> = {
  primaryColor:    '#1B2A47',
  accentColor:     '#3A9FD6',
  backgroundColor: '#EBF5FB',
  surfaceColor:    '#ffffff',
  panelColor:      '#ffffff',
  headingFont:     'Inter',
  bodyFont:        'Inter',
  borderRadius:    'rounded',
};

const CARD_RADIUS: Record<string, string> = { sharp: '4px',   rounded: '12px', pill: '20px'  };
const BTN_RADIUS:  Record<string, string> = { sharp: '2px',   rounded: '6px',  pill: '999px' };

/** Pick text colours for a given background using WCAG-style luminance.
 *  Returns the primary / muted / subtle text triplet so components can use
 *  one variable for body copy, another for secondary captions/labels. */
function textOn(bg: string): { primary: string; muted: string; subtle: string } {
  const m = /^#([0-9a-f]{6})$/i.exec(bg.trim());
  // Unknown / non-hex: fall back to dark text — safe default for white/light surfaces.
  if (!m) return { primary: '#1B2A47', muted: '#5a6a7e', subtle: '#9aa5b4' };
  const hex = m[1]!;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  // Relative luminance per WCAG 2.x (sRGB → linear → weighted).
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5
    ? { primary: '#1B2A47', muted: '#5a6a7e', subtle: '#9aa5b4' }
    : { primary: '#ffffff', muted: 'rgba(255,255,255,0.72)', subtle: 'rgba(255,255,255,0.48)' };
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private fontsLoaded = new Set<string>();

  apply(theme: OrgTheme | undefined | null): void {
    const t: Required<OrgTheme> = { ...DEFAULTS, ...(theme ?? {}) };
    const root = document.documentElement;

    // Brand colours
    root.style.setProperty('--artes-primary',    t.primaryColor);
    root.style.setProperty('--artes-accent',     t.accentColor);
    root.style.setProperty('--artes-bg',         t.backgroundColor);
    root.style.setProperty('--artes-surface',    t.surfaceColor);
    root.style.setProperty('--artes-panel',      t.panelColor);

    // On-* text colours derived from luminance of each base. Components reading
    // `var(--artes-on-surface)` / `var(--artes-on-panel)` / `var(--artes-on-bg)`
    // automatically flip between dark and light text when the org configures a
    // dark colour, without each component having to encode the switch.
    const onSurface = textOn(t.surfaceColor);
    const onPanel   = textOn(t.panelColor);
    const onBg      = textOn(t.backgroundColor);
    root.style.setProperty('--artes-on-surface',        onSurface.primary);
    root.style.setProperty('--artes-on-surface-muted',  onSurface.muted);
    root.style.setProperty('--artes-on-surface-subtle', onSurface.subtle);
    root.style.setProperty('--artes-on-panel',          onPanel.primary);
    root.style.setProperty('--artes-on-panel-muted',    onPanel.muted);
    root.style.setProperty('--artes-on-panel-subtle',   onPanel.subtle);
    root.style.setProperty('--artes-on-bg',             onBg.primary);
    root.style.setProperty('--artes-on-bg-muted',       onBg.muted);

    // Border radius
    root.style.setProperty('--artes-radius',     CARD_RADIUS[t.borderRadius] ?? '12px');
    root.style.setProperty('--artes-btn-radius', BTN_RADIUS[t.borderRadius]  ?? '6px');

    // Fonts
    root.style.setProperty('--artes-heading-font', `'${t.headingFont}', sans-serif`);
    root.style.setProperty('--artes-body-font',    `'${t.bodyFont}', sans-serif`);

    // Override Angular Material MDC CSS custom properties
    root.style.setProperty('--mdc-theme-primary',                    t.primaryColor);
    root.style.setProperty('--mdc-filled-button-container-color',    t.primaryColor);
    root.style.setProperty('--mdc-protected-button-container-color', t.primaryColor);
    root.style.setProperty('--mdc-outlined-button-label-text-color', t.primaryColor);
    root.style.setProperty('--mdc-text-button-label-text-color',     t.primaryColor);
    root.style.setProperty('--mdc-checkbox-selected-checkmark-color','#fff');
    root.style.setProperty('--mdc-checkbox-selected-focus-icon-color', t.primaryColor);
    root.style.setProperty('--mdc-checkbox-selected-icon-color',     t.primaryColor);
    root.style.setProperty('--mdc-switch-selected-track-color',      t.primaryColor);
    root.style.setProperty('--mdc-fab-container-color',              t.accentColor);
    root.style.setProperty('--mat-tab-header-active-label-text-color', t.primaryColor);
    root.style.setProperty('--mat-tab-header-active-focus-indicator-color', t.primaryColor);
    root.style.setProperty('--mdc-linear-progress-active-indicator-color', t.accentColor);

    // Load Google Fonts for any non-system font
    this.loadGoogleFont(t.headingFont);
    this.loadGoogleFont(t.bodyFont);
  }

  reset(): void {
    this.apply(DEFAULTS);
  }

  private loadGoogleFont(family: string): void {
    const system = new Set(['Inter', 'Roboto', 'Arial', 'Helvetica', 'sans-serif', 'serif', 'monospace']);
    if (system.has(family) || this.fontsLoaded.has(family)) return;

    const id = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) { this.fontsLoaded.add(family); return; }

    const link = document.createElement('link');
    link.id   = id;
    link.rel  = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
    this.fontsLoaded.add(family);
  }
}
