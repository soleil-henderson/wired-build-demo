#!/usr/bin/env node
/**
 * Production web build:
 * 1. Expo static export → dist/ (then moved under dist/app/)
 * 2. Marketing landing → dist/index.html
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const marketingDir = resolve(root, 'marketing');
const dist = resolve(root, 'dist');
const appDir = join(dist, 'app');

console.log('Exporting Expo web app…');
execSync('npx expo export --platform web', { cwd: root, stdio: 'inherit' });

const landingSrc = resolve(marketingDir, 'index.html');
if (!existsSync(landingSrc)) {
  console.error('Missing marketing/index.html');
  process.exit(1);
}

mkdirSync(appDir, { recursive: true });

for (const name of readdirSync(dist)) {
  if (name === 'app') continue;
  renameSync(join(dist, name), join(appDir, name));
}

copyFileSync(landingSrc, join(dist, 'index.html'));

const marketingAssets = [
  'favicon.ico',
  'favicon.png',
  'logo.png',
  'logo@2x.png',
  'apple-touch-icon.png',
];
for (const name of marketingAssets) {
  const src = join(marketingDir, name);
  if (existsSync(src)) {
    copyFileSync(src, join(dist, name));
  }
}

/** Expo export ships a stale favicon.ico — always replace with our brand assets. */
const appBrandAssets = [
  ['marketing/favicon.ico', 'favicon.ico'],
  ['marketing/favicon.png', 'favicon.png'],
  ['marketing/apple-touch-icon.png', 'apple-touch-icon.png'],
  ['assets/images/favicon-32.png', 'favicon-32.png'],
];
for (const [relSrc, destName] of appBrandAssets) {
  const src = join(root, relSrc);
  if (existsSync(src)) {
    copyFileSync(src, join(appDir, destName));
  }
}

console.log('Moved web app → dist/app/');
console.log('Copied marketing landing → dist/index.html');
console.log('Copied marketing brand assets → dist/');
console.log('Done. Deploy dist/ to Vercel.');
