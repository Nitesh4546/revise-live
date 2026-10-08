import { describe, it, expect } from 'vitest';

/**
 * WCAG 2.1 relative luminance and contrast ratio algorithms
 */
function getRelativeLuminance(hex) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function getContrastRatio(foregroundHex, backgroundHex) {
  const l1 = getRelativeLuminance(foregroundHex);
  const l2 = getRelativeLuminance(backgroundHex);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Semantic Token Color Pairs for Light Theme
 */
export const LIGHT_THEME_PAIRS = [
  {
    name: 'Light: Text on Page Background',
    background: '#FFFFFF',
    foreground: '#242424',
    minRatio: 4.5
  },
  {
    name: 'Light: Text on Subtle Background',
    background: '#F5F5F5',
    foreground: '#242424',
    minRatio: 4.5
  },
  {
    name: 'Light: Text on Surface',
    background: '#FFFFFF',
    foreground: '#242424',
    minRatio: 4.5
  },
  {
    name: 'Light: Muted Text on Page',
    background: '#FFFFFF',
    foreground: '#616161',
    minRatio: 4.5
  },
  {
    name: 'Light: Muted Text on Surface',
    background: '#FFFFFF',
    foreground: '#616161',
    minRatio: 4.5
  },
  {
    name: 'Light: Accent Link/Text on Page',
    background: '#FFFFFF',
    foreground: '#0F6CBD',
    minRatio: 4.5
  },
  {
    name: 'Light: Primary Button Text on Accent',
    background: '#0F6CBD',
    foreground: '#FFFFFF',
    minRatio: 4.5
  },
  {
    name: 'Light: Focus Ring on Page',
    background: '#FFFFFF',
    foreground: '#0F6CBD',
    minRatio: 3.0
  },
  {
    name: 'Light: Danger Button Text on Red',
    background: '#C42B1C',
    foreground: '#FFFFFF',
    minRatio: 4.5
  }
];

/**
 * Semantic Token Color Pairs for Dark Theme
 */
export const DARK_THEME_PAIRS = [
  {
    name: 'Dark: Text on Page Background',
    background: '#1F1F1F',
    foreground: '#FFFFFF',
    minRatio: 4.5
  },
  {
    name: 'Dark: Text on Subtle Background',
    background: '#292929',
    foreground: '#FFFFFF',
    minRatio: 4.5
  },
  {
    name: 'Dark: Text on Surface',
    background: '#2B2B2B',
    foreground: '#FFFFFF',
    minRatio: 4.5
  },
  {
    name: 'Dark: Muted Text on Page',
    background: '#1F1F1F',
    foreground: '#D1D1D1',
    minRatio: 4.5
  },
  {
    name: 'Dark: Muted Text on Surface',
    background: '#2B2B2B',
    foreground: '#D1D1D1',
    minRatio: 4.5
  },
  {
    name: 'Dark: Primary Button Text on Accent',
    background: '#0F6CBD',
    foreground: '#FFFFFF',
    minRatio: 4.5
  },
  {
    name: 'Dark: Focus Ring on Page Background',
    background: '#1F1F1F',
    foreground: '#479EF5',
    minRatio: 3.0
  },
  {
    name: 'Dark: Danger Button Text on Red',
    background: '#D83B01',
    foreground: '#FFFFFF',
    minRatio: 4.5
  }
];

/**
 * Okabe-Ito Functional Answer Tile Palette (Validated in Both Themes)
 */
export const OKABE_ITO_TILE_PAIRS = [
  {
    name: 'Option A (Vermillion) + White text',
    background: '#C04900',
    foreground: '#FFFFFF',
    minRatio: 4.5
  },
  {
    name: 'Option B (Sky Blue) + Dark text',
    background: '#56B4E9',
    foreground: '#1F1F1F',
    minRatio: 4.5
  },
  {
    name: 'Option C (Amber Orange) + Dark text',
    background: '#E69F00',
    foreground: '#1F1F1F',
    minRatio: 4.5
  },
  {
    name: 'Option D (Bluish Green) + White text',
    background: '#007654',
    foreground: '#FFFFFF',
    minRatio: 4.5
  },
  {
    name: 'QR Code Tile: Black modules on White quiet zone',
    background: '#FFFFFF',
    foreground: '#000000',
    minRatio: 4.5
  }
];

describe('WCAG AA Contrast Ratios (Phase 4 Semantic Design Tokens)', () => {
  it.each(LIGHT_THEME_PAIRS)(
    '$name meets minimum contrast ratio of $minRatio:1',
    ({ background, foreground, minRatio }) => {
      const ratio = getContrastRatio(foreground, background);
      expect(ratio).toBeGreaterThanOrEqual(minRatio);
    }
  );

  it.each(DARK_THEME_PAIRS)(
    '$name meets minimum contrast ratio of $minRatio:1',
    ({ background, foreground, minRatio }) => {
      const ratio = getContrastRatio(foreground, background);
      expect(ratio).toBeGreaterThanOrEqual(minRatio);
    }
  );

  it.each(OKABE_ITO_TILE_PAIRS)(
    '$name meets minimum contrast ratio of $minRatio:1',
    ({ background, foreground, minRatio }) => {
      const ratio = getContrastRatio(foreground, background);
      expect(ratio).toBeGreaterThanOrEqual(minRatio);
    }
  );
});
