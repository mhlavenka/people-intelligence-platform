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
    root.style.setProperty('--pip-primary',    t.primaryColor);
    root.style.setProperty('--pip-accent',     t.accentColor);
    root.style.setProperty('--pip-bg',         t.backgroundColor);
    root.style.setProperty('--pip-surface',    t.surfaceColor);

    // Border radius
    root.style.setProperty('--pip-radius',     CARD_RADIUS[t.borderRadius] ?? '12px');
    root.style.setProperty('--pip-btn-radius', BTN_RADIUS[t.borderRadius]  ?? '6px');

    // Fonts
    root.style.setProperty('--pip-heading-font', `'${t.headingFont}', sans-serif`);
    root.style.setProperty('--pip-body-font',    `'${t.bodyFont}', sans-serif`);

    // Override Angular Material MDC CSS custom properties
    root.style.setProperty('--mdc-theme-primary',                    t.primaryColor);
    root.style.setProperty('--mdc-filled-button-container-color',    t.primaryColor);
    root.style.setProperty('--mdc-protected-button-container-color', t.primaryColor);

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
