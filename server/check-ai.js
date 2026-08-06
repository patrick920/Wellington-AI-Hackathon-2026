/**
 * check-ai.js
 * -----------
 * A diagnostic you can run without starting the website:
 *
 *     npm run check-ai
 *
 * It reports which provider Waste Opportunities would use, whether your API key works, and
 * — for Gemini — which model names your key can actually see. That last part
 * matters: model names change over time, and a wrong one produces a confusing
 * 404 at chat time rather than at startup.
 *
 * It also sends one real test message through the full tool loop, so you find
 * out here whether tool calling works, rather than during your pitch.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// --- Load .env (same minimal parser the server uses) -----------------------
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !process.env[key]) process.env[key] = value;
  }
  console.log(`Loaded .env from ${envPath}\n`);
} else {
  console.log('No .env file found.');
  console.log('Copy .env.example to .env and add your API key.\n');
}

const { chat, aiStatus, PROVIDERS } = await import('./ai.js');
const gemini = await import('./providers/gemini.js');

console.log('─'.repeat(64));
console.log(' Waste Opportunities — AI provider check');
console.log('─'.repeat(64));

// --- Which providers have keys? -------------------------------------------
console.log('\nConfigured providers (in preference order):\n');
for (const provider of PROVIDERS) {
  const info = provider.describe();
  const ready = typeof provider.isAvailable === 'function'
    ? await provider.isAvailable()
    : provider.isConfigured();
  const mark = ready ? '  ✓' : '  ·';
  console.log(`${mark} ${provider.label.padEnd(18)} ${ready ? `ready — ${info.model}` : `no ${info.envVar} set`}`);
  if (!ready) console.log(`      get a key: ${provider.keyUrl}`);
}

// --- What will actually be used? ------------------------------------------
const status = await aiStatus();
console.log('\n' + '─'.repeat(64));
if (!status.available) {
  console.log('\nACTIVE: offline demo assistant (no API key found).');
  console.log('\nThe website still works — the built-in assistant can search,');
  console.log('filter and navigate. To enable a real AI, add this to .env:\n');
  console.log('    GEMINI_API_KEY=your-key-here');
  console.log(`\nFree key from ${gemini.keyUrl}\n`);
  process.exit(0);
}
console.log(`\nACTIVE: ${status.label} — ${status.model}\n`);

// --- For Gemini, test the model with a REAL call ---------------------------
//
// Important: we do NOT trust the models-list endpoint here. Google keeps
// retired models in that list, and they only fail when you actually call them
// ("no longer available to new users"). So we send a tiny real request instead.
if (status.id === 'gemini') {
  const current = gemini.model();
  console.log('Checking each model with a real request.');
  console.log('(The free tier allows ~20 requests per DAY per model, and one chat');
  console.log(' message costs 2-3 requests. Waste Opportunities rotates models automatically when');
  console.log(' one runs out, so more green ticks below = more demo runs available.)\n');

  const working = [];
  for (const name of [current, ...gemini.MODEL_CANDIDATES.filter(m => m !== current)]) {
    const result = await gemini.probeModel(name);
    const marker = name === current ? '→' : ' ';
    if (result.ok) {
      working.push(name);
      console.log(`   ${marker} ✓ ${name.padEnd(32)} ${String(result.ms).padStart(5)}ms`);
    } else {
      const why = /429/.test(result.error) ? 'out of quota for today'
                : /404/.test(result.error) ? 'retired by Google'
                : result.error.slice(0, 60);
      console.log(`   ${marker} ✗ ${name.padEnd(32)} ${why}`);
    }
  }

  console.log('');
  if (!working.length) {
    console.log('   ✗ No models are usable right now.');
    console.log('     If they all say "out of quota", your daily free allowance is spent —');
    console.log('     it resets every day. Otherwise the key may be invalid: get a fresh');
    console.log(`     one from ${gemini.keyUrl}\n`);
    process.exit(1);
  }
  console.log(`   ${working.length} of ${gemini.MODEL_CANDIDATES.length} models available — roughly ${working.length * 7} chat messages left today.`);
  if (!working.includes(current)) {
    console.log(`   "${current}" is unavailable, so Waste Opportunities will automatically use "${working[0]}".`);
  }
}

// --- Send one real message through the full tool loop ---------------------
console.log('\n' + '─'.repeat(64));
console.log('\nSending a test message through the real tool loop...\n');
console.log('   "What kiwifruit waste is available in the Bay of Plenty?"\n');

try {
  const started = Date.now();
  const result = await chat([], 'What kiwifruit waste is available in the Bay of Plenty?', 'home');
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (result.offline) {
    console.log('   ✗ The request fell back to the offline assistant.');
    console.log('     The reply below contains the reason:\n');
    console.log('     ' + result.reply.split('\n')[0]);
    console.log('');
    process.exit(1);
  }

  console.log(`   ✓ Reply received in ${seconds}s`);
  console.log(`   ✓ Tools called: ${result.toolsUsed.length ? [...new Set(result.toolsUsed)].join(', ') : 'none'}`);
  console.log(`   ✓ UI actions: ${result.actions.length}`);
  console.log('\n   Reply:\n');
  console.log(result.reply.split('\n').map(l => '     ' + l).join('\n'));

  if (!result.toolsUsed.length) {
    console.log('\n   ⚠  No tools were called. The model answered from the prompt alone.');
    console.log('      Tool calling may not be working — try a different model.');
  }
  console.log('\nAll good. Start the site with:  npm start\n');
} catch (err) {
  console.log(`   ✗ ${err.message}\n`);
  process.exit(1);
}
