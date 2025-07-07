#!/usr/bin/env node

/**
 * Generate version.ts file from package.json
 * This ensures version information is available at compile time
 * and works in all deployment environments including Cloudflare Workers
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Read package.json
  const packageJsonPath = join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  
  // Extract version and other relevant info
  const version = packageJson.version || '0.0.0';
  const name = packageJson.name || 'unknown';
  const description = packageJson.description || '';
  
  // Generate TypeScript content
  const versionFileContent = `/**
 * Auto-generated version information
 * Generated at build time from package.json
 * DO NOT EDIT MANUALLY
 */

export const VERSION_INFO = {
  version: '${version}',
  name: '${name}',
  description: '${description}',
  buildTime: '${new Date().toISOString()}',
} as const;

export const VERSION = VERSION_INFO.version;
export const SERVICE_NAME = VERSION_INFO.name;
`;

  // Ensure src directory exists
  const srcDir = join(__dirname, '..', 'src');
  mkdirSync(srcDir, { recursive: true });
  
  // Write version.ts file
  const versionFilePath = join(srcDir, 'version.ts');
  writeFileSync(versionFilePath, versionFileContent, 'utf8');
  
  console.log(`✅ Generated version file: ${versionFilePath}`);
  console.log(`📦 Version: ${version}`);
  console.log(`🏷️  Service: ${name}`);
  
} catch (error) {
  console.error('❌ Failed to generate version file:', error.message);
  process.exit(1);
}