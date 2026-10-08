import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Design Tokens Integrity - Zero Hardcoded Colors Sweeper', () => {
  const srcDir = path.resolve(__dirname);

  // Helper to recursively find all .jsx and .js files
  function getSourceFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(getSourceFiles(fullPath));
      } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const allFiles = getSourceFiles(srcDir);

  // Files legitimately defining tokens, testing tokens, or embedding high-contrast scanner SVG
  const EXCLUDED_FILES = [
    'contrast.test.js',
    'hardcodedColors.test.js',
    'ThemeContext.jsx', // Sets document <meta name="theme-color">
    'QRJoinCard.jsx'    // Standard QR code reader requires black-on-white SVG
  ];

  it('asserts zero legacy Tailwind palette utilities in application source code', () => {
    const legacyPaletteRegex = /\b(slate|indigo|purple|emerald|amber|rose|sky|stone|cyan|violet)-[0-9]+/g;
    const violations = [];

    for (const filePath of allFiles) {
      const fileName = path.basename(filePath);
      if (EXCLUDED_FILES.includes(fileName)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const matches = content.match(legacyPaletteRegex);
      if (matches) {
        violations.push({
          file: path.relative(srcDir, filePath),
          matches: Array.from(new Set(matches))
        });
      }
    }

    expect(
      violations,
      `Found legacy palette utilities outside allowed files: ${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it('asserts zero raw hex colors (#hex) in application source code outside token definitions', () => {
    // Matches hex color codes like #fff, #123456, but not anchor links like #features
    const hexColorRegex = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
    const violations = [];

    for (const filePath of allFiles) {
      const fileName = path.basename(filePath);
      if (EXCLUDED_FILES.includes(fileName)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, lineIdx) => {
        // Skip href="#..." anchor links or comments
        if (line.includes('href="#') || line.trim().startsWith('//')) return;

        const matches = line.match(hexColorRegex);
        if (matches) {
          violations.push({
            file: path.relative(srcDir, filePath),
            line: lineIdx + 1,
            matches: Array.from(new Set(matches))
          });
        }
      });
    }

    expect(
      violations,
      `Found raw hex color codes in application source code: ${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it('asserts zero rgb/rgba/hsl/hsla color strings in application source code', () => {
    const rgbRegex = /\b(?:rgba?|hsla?)\s*\(/g;
    const violations = [];

    for (const filePath of allFiles) {
      const fileName = path.basename(filePath);
      if (EXCLUDED_FILES.includes(fileName)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const matches = content.match(rgbRegex);
      if (matches) {
        violations.push({
          file: path.relative(srcDir, filePath),
          matches: Array.from(new Set(matches))
        });
      }
    }

    expect(
      violations,
      `Found rgb/hsl color functions in application source code: ${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });
});
