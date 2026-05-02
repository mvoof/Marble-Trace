import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import process from 'node:process';

const newVersion = process.argv[2];

if (!newVersion) {
  console.error(
    'Please provide a version as an argument. Example: node scripts/bump-version.js 1.2.3'
  );
  process.exit(1);
}

// Basic semver validation
if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(newVersion)) {
  console.error(
    `Invalid version format: ${newVersion}. Use semver (e.g., 1.2.3 or 1.2.3-beta.1)`
  );
  process.exit(1);
}

const rootDir = process.cwd();

const paths = {
  packageJson: path.join(rootDir, 'package.json'),
  tauriConf: path.join(rootDir, 'src-tauri', 'tauri.conf.json'),
  cargoToml: path.join(rootDir, 'src-tauri', 'Cargo.toml'),
};

// 1. Update package.json
console.log(`Updating package.json to ${newVersion}...`);
const pkg = JSON.parse(fs.readFileSync(paths.packageJson, 'utf-8'));
pkg.version = newVersion;
fs.writeFileSync(paths.packageJson, JSON.stringify(pkg, null, 2) + '\n');

// 2. Update tauri.conf.json
console.log(`Updating tauri.conf.json to ${newVersion}...`);
const tauriConf = JSON.parse(fs.readFileSync(paths.tauriConf, 'utf-8'));
tauriConf.version = newVersion;
fs.writeFileSync(paths.tauriConf, JSON.stringify(tauriConf, null, 2) + '\n');

// 3. Update Cargo.toml
console.log(`Updating Cargo.toml to ${newVersion}...`);
let cargoToml = fs.readFileSync(paths.cargoToml, 'utf-8');
// Use regex to find version under [package]
cargoToml = cargoToml.replace(
  /(\[package\][\s\S]*?^version\s*=\s*")[^"]*(")/m,
  `$1${newVersion}$2`
);
fs.writeFileSync(paths.cargoToml, cargoToml);

// 4. Update Cargo.lock
console.log('Updating Cargo.lock...');
try {
  execSync('cargo update -p marble-trace', {
    cwd: path.join(rootDir, 'src-tauri'),
    stdio: 'inherit',
  });
} catch {
  console.warn(
    'Failed to update Cargo.lock automatically. Please run "cargo check" in src-tauri.'
  );
}

console.log('Successfully updated all version files.');
