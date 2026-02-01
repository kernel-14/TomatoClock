#!/usr/bin/env node

/**
 * Validation script for electron-builder configuration
 * Checks for common issues before building
 */

import { existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const checks = [];
let hasErrors = false;

function check(name, condition, errorMessage, warningOnly = false) {
  const result = {
    name,
    passed: condition,
    message: errorMessage,
    type: warningOnly ? 'warning' : 'error'
  };
  checks.push(result);
  
  if (!condition && !warningOnly) {
    hasErrors = true;
  }
  
  return condition;
}

console.log('🔍 Validating electron-builder configuration...\n');

// Check package.json exists
check(
  'package.json exists',
  existsSync(join(rootDir, 'package.json')),
  'package.json not found in root directory'
);

// Check build directory exists
check(
  'build directory exists',
  existsSync(join(rootDir, 'build')),
  'build/ directory not found - create it for build resources'
);

// Check icon file (warning only since we have placeholder)
check(
  'icon.ico exists',
  existsSync(join(rootDir, 'build', 'icon.ico')),
  'build/icon.ico not found - using default icon (see build/README.md)',
  true
);

// Check LICENSE file
check(
  'LICENSE file exists',
  existsSync(join(rootDir, 'LICENSE')),
  'LICENSE file not found - required for NSIS installer'
);

// Check dist directories don't exist (clean build)
const distExists = existsSync(join(rootDir, 'dist'));
const distElectronExists = existsSync(join(rootDir, 'dist-electron'));

check(
  'Build directories ready',
  true, // Always pass, just informational
  distExists || distElectronExists 
    ? 'dist/ or dist-electron/ exists - will be rebuilt'
    : 'Build directories clean',
  true
);

// Check node_modules exists
check(
  'Dependencies installed',
  existsSync(join(rootDir, 'node_modules')),
  'node_modules not found - run "npm install" first'
);

// Check electron-builder is installed
check(
  'electron-builder installed',
  existsSync(join(rootDir, 'node_modules', 'electron-builder')),
  'electron-builder not found - run "npm install" first'
);

// Print results
console.log('Results:\n');
checks.forEach(({ name, passed, message, type }) => {
  const icon = passed ? '✅' : (type === 'warning' ? '⚠️' : '❌');
  const status = passed ? 'PASS' : type.toUpperCase();
  console.log(`${icon} ${name}: ${status}`);
  if (!passed) {
    console.log(`   ${message}`);
  }
});

console.log('\n' + '='.repeat(60));

if (hasErrors) {
  console.log('❌ Validation failed! Fix errors before building.');
  process.exit(1);
} else {
  const warnings = checks.filter(c => !c.passed && c.type === 'warning');
  if (warnings.length > 0) {
    console.log('⚠️  Validation passed with warnings.');
    console.log('   Build will succeed but consider fixing warnings.');
  } else {
    console.log('✅ All checks passed! Ready to build.');
  }
  process.exit(0);
}
