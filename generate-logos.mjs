import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUT = 'frontend/src/assets';

// Colors
const NAVY = '#1B2A47';
const BLUE = '#3A9FD6';
const GREEN = '#27C4A0';
const LIGHT_BG = '#F0F4F8';

// ── Tied arch bridge SVG path builders ──────────────────────────────────

function tiedArchBridge({ stroke, deckStroke, cx, cy, w, archH, deckY }) {
  // Deck (the tie)
  const deckLeft = cx - w / 2;
  const deckRight = cx + w / 2;
  const deck = `<line x1="${deckLeft}" y1="${deckY}" x2="${deckRight}" y2="${deckY}" stroke="${deckStroke || stroke}" stroke-width="3.5" stroke-linecap="round"/>`;

  // Arch (parabolic curve above deck)
  const archTop = deckY - archH;
  const arch = `<path d="M${deckLeft},${deckY} Q${cx},${archTop} ${deckRight},${deckY}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>`;

  // Vertical hangers
  const hangerCount = 7;
  let hangers = '';
  for (let i = 1; i < hangerCount; i++) {
    const t = i / hangerCount;
    const hx = deckLeft + t * w;
    // Parabola y at this x: y = deckY - archH * 4 * t * (1 - t)
    const hy = deckY - archH * 4 * t * (1 - t);
    hangers += `<line x1="${hx}" y1="${hy}" x2="${hx}" y2="${deckY}" stroke="${stroke}" stroke-width="1.5" opacity="0.7"/>`;
  }

  // End pillars
  const pillarH = 8;
  const pillars = `
    <line x1="${deckLeft}" y1="${deckY}" x2="${deckLeft}" y2="${deckY + pillarH}" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
    <line x1="${deckRight}" y1="${deckY}" x2="${deckRight}" y2="${deckY + pillarH}" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
  `;

  // Water reflection (subtle)
  const reflY = deckY + pillarH + 4;
  const reflection = `<line x1="${deckLeft + 15}" y1="${reflY}" x2="${deckRight - 15}" y2="${reflY}" stroke="${stroke}" stroke-width="1" opacity="0.2"/>
    <line x1="${deckLeft + 25}" y1="${reflY + 5}" x2="${deckRight - 25}" y2="${reflY + 5}" stroke="${stroke}" stroke-width="0.8" opacity="0.12"/>`;

  return `${arch}${hangers}${deck}${pillars}${reflection}`;
}

// ── Icon (circle with bridge) ───────────────────────────────────────────

function iconSvg(size, { bg, bridgeColor, borderColor, shadow }) {
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const bridge = tiedArchBridge({ stroke: bridgeColor, deckStroke: bridgeColor, cx, cy: cy, w: r * 1.4, archH: r * 0.55, deckY: cy + r * 0.1 });

  const shadowFilter = shadow ? `
    <defs>
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.15"/>
      </filter>
    </defs>` : '';
  const filterAttr = shadow ? 'filter="url(#shadow)"' : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${shadowFilter}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="${borderColor}" stroke-width="3" ${filterAttr}/>
    ${bridge}
  </svg>`;
}

// ── Full logo (circle + text) ───────────────────────────────────────────

function fullLogoSvg({ width, height, bgColor, circleBg, circleStroke, bridgeColor, textColor, subtitleColor, taglineColor, shadow, transparent }) {
  const circleR = height / 2 - 12;
  const circleCx = circleR + 16;
  const circleCy = height / 2;
  const textX = circleCx + circleR + 30;

  const bridge = tiedArchBridge({ stroke: bridgeColor, deckStroke: bridgeColor, cx: circleCx, cy: circleCy, w: circleR * 1.4, archH: circleR * 0.55, deckY: circleCy + circleR * 0.1 });

  const shadowFilter = shadow ? `
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.18"/>
    </filter>` : '';
  const filterAttr = shadow ? 'filter="url(#shadow)"' : '';

  // Separator line
  const sepX = textX - 12;
  const sep = `<line x1="${sepX}" y1="${circleCy - circleR * 0.6}" x2="${sepX}" y2="${circleCy + circleR * 0.6}" stroke="${GREEN}" stroke-width="2.5" opacity="0.8"/>`;

  // Tighter bounding - reduce right padding
  const totalWidth = width;

  const bgRect = transparent ? '' : `<rect width="${totalWidth}" height="${height}" fill="${bgColor}" rx="0"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">
    <defs>
      ${shadow ? shadowFilter : ''}
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900');
      </style>
    </defs>
    ${bgRect}
    <circle cx="${circleCx}" cy="${circleCy}" r="${circleR}" fill="${circleBg}" stroke="${circleStroke}" stroke-width="3" ${filterAttr}/>
    ${bridge}
    ${sep}
    <text x="${textX}" y="${circleCy - 22}" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="48" fill="${textColor}" letter-spacing="3">ARTES</text>
    <text x="${textX}" y="${circleCy + 8}" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="16" fill="${subtitleColor}" letter-spacing="4">PEOPLE INTELLIGENCE</text>
    <text x="${textX}" y="${circleCy + 30}" font-family="Inter, Arial, sans-serif" font-weight="400" font-style="italic" font-size="13" fill="${taglineColor}">artes / skills · excellence</text>
    <text x="${textX}" y="${circleCy + 52}" font-family="Inter, Arial, sans-serif" font-weight="600" font-size="14" fill="${taglineColor}">AI-Powered Organizational Development</text>
  </svg>`;
}

// ── Generate all variants ───────────────────────────────────────────────

async function generate() {
  // Icon: light bg, dark bridge, dark border, shadow
  const iconLight512 = iconSvg(512, { bg: LIGHT_BG, bridgeColor: NAVY, borderColor: NAVY, shadow: true });
  const iconLight192 = iconSvg(192, { bg: LIGHT_BG, bridgeColor: NAVY, borderColor: NAVY, shadow: true });

  // Full logos
  const logoW = 580;
  const logoH = 200;

  // Dark: dark background, light circle inside, dark bridge reversed
  const dark = fullLogoSvg({
    width: logoW, height: logoH,
    bgColor: NAVY,
    circleBg: LIGHT_BG, circleStroke: BLUE, bridgeColor: NAVY,
    textColor: '#FFFFFF', subtitleColor: BLUE, taglineColor: 'rgba(255,255,255,0.7)',
    shadow: true, transparent: false,
  });

  // Light: light background, light circle inside with dark border, dark bridge
  const light = fullLogoSvg({
    width: logoW, height: logoH,
    bgColor: '#FFFFFF',
    circleBg: LIGHT_BG, circleStroke: NAVY, bridgeColor: NAVY,
    textColor: NAVY, subtitleColor: BLUE, taglineColor: '#5a6a7e',
    shadow: true, transparent: false,
  });

  // Transparent dark: for dark backgrounds, no bg rect
  const transDark = fullLogoSvg({
    width: logoW, height: logoH,
    bgColor: 'transparent',
    circleBg: LIGHT_BG, circleStroke: BLUE, bridgeColor: NAVY,
    textColor: '#FFFFFF', subtitleColor: BLUE, taglineColor: 'rgba(255,255,255,0.7)',
    shadow: true, transparent: true,
  });

  // Transparent light: for light backgrounds, no bg rect
  const transLight = fullLogoSvg({
    width: logoW, height: logoH,
    bgColor: 'transparent',
    circleBg: LIGHT_BG, circleStroke: NAVY, bridgeColor: NAVY,
    textColor: NAVY, subtitleColor: BLUE, taglineColor: '#5a6a7e',
    shadow: true, transparent: true,
  });

  // Write PNGs
  const jobs = [
    { svg: iconLight512, file: 'artes_icon_512.png', w: 512, h: 512 },
    { svg: iconLight192, file: 'artes_icon_192.png', w: 192, h: 192 },
    { svg: dark, file: 'artes_dark.png', w: logoW * 2, h: logoH * 2 },
    { svg: light, file: 'artes_light.png', w: logoW * 2, h: logoH * 2 },
    { svg: transDark, file: 'artes_transparent_dark.png', w: logoW * 2, h: logoH * 2 },
    { svg: transLight, file: 'artes_transparent_light.png', w: logoW * 2, h: logoH * 2 },
  ];

  for (const { svg, file, w, h } of jobs) {
    const buf = Buffer.from(svg);
    await sharp(buf, { density: 150 })
      .resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(OUT, file));
    console.log(`  ✓ ${file} (${w}x${h})`);
  }

  console.log('\nDone — all logos generated.');
}

generate().catch(console.error);
