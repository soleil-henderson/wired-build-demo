#!/usr/bin/env node
/**
 * Pre-flight checks before manual smoke testing.
 * Usage: node scripts/verify-setup.mjs [--db]
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const withDb = process.argv.includes('--db');

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

// .env
const envPath = resolve(root, '.env');
if (!existsSync(envPath)) {
  fail('Missing .env — copy .env.example and add Supabase keys.');
}
const env = readFileSync(envPath, 'utf8');
for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
  if (!env.includes(`${key}=`) || env.includes(`${key}=https://YOUR`)) {
    fail(`.env missing or placeholder: ${key}`);
  }
}
ok('.env has Supabase variables');

// CI scripts
for (const script of ['typecheck', 'test', 'lint']) {
  try {
    execSync(`npm run ${script}`, { cwd: root, stdio: 'inherit' });
    ok(`npm run ${script}`);
  } catch {
    fail(`npm run ${script} failed`);
  }
}

if (withDb) {
  try {
    execSync('npx supabase db push', { cwd: root, stdio: 'inherit' });
    ok('supabase db push (remote up to date)');
  } catch {
    fail('supabase db push failed — run supabase login && supabase link');
  }
}

console.log('\nReady for manual smoke: npm run ios | android | web\n');
