/**
 * Expo's nested ExpoModulesJSI build signs a helper framework. Under ~/Documents,
 * File Provider stamps that framework and codesign rejects it. The simulator app
 * does not need this helper to be signed. Re-applied on npm install.
 */
const fs = require('fs');
const path = require('path');

const MARKER = 'thaw: skip helper codesign under iCloud Documents';
const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'scripts',
  'build-xcframework.sh',
);

if (!fs.existsSync(target)) {
  console.log('expo-modules-jsi build script is not installed; skipping signing patch');
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
if (source.includes(MARKER)) {
  process.exit(0);
}

const envLine = 'local env_args=(PATH="$PATH" HOME="$HOME" PODS_ROOT="$PODS_ROOT" RN_ROOT="$RN_ROOT")';
const envReplacement = `local env_args=(PATH="$PATH" HOME="$HOME" PODS_ROOT="$PODS_ROOT" RN_ROOT="$RN_ROOT" COPYFILE_DISABLE=1) # ${MARKER}`;
const signLine = '    CLANG_COVERAGE_MAPPING=NO \\';
const signReplacement = `    CLANG_COVERAGE_MAPPING=NO \\
    CODE_SIGNING_ALLOWED=NO \\
    CODE_SIGNING_REQUIRED=NO \\`;

if (!source.includes(envLine) || !source.includes(signLine)) {
  console.error('expo-modules-jsi build script did not match the expected signing lines');
  process.exit(1);
}

const next = source.replace(envLine, envReplacement).replace(signLine, signReplacement);
fs.writeFileSync(target, next);
console.log('Patched ExpoModulesJSI so the simulator helper framework is not signed');
