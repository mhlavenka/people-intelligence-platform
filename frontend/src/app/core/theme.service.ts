import { Injectable } from '@angular/core';

export interface OrgTheme {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  headingFont?: string;
  bodyFont?: string;
  borderRadius?: 'sharp' | 'rounded' | 'pill';
}

const DEFAULTS: Required<OrgTheme> = {
  primaryColor:    '#1B2A47',
  accentColor:     '#3A9FD6',
  backgroundColor: '#EBF5FB',
  surfaceColor:    '#ffffff',
  headingFont:     'Inter',
  bodyFont:        'Inter',
  borderRadius:    'rounded',
};

const CARD_RADIUS: Record<string, string> = { sharp: '4px',   rounded: '12px', pill: '20px'  };
const BTN_RADIUS:  Record<string, string> = { sharp: '2px',   rounded: '6px',  pill: '999px' };

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
