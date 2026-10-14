#!/usr/bin/env node
/**
 * 🕉️ LIKHIT JAP - DUAL REEL DISPATCHER & VIDEO ENGINE
 * -----------------------------------------------------------------------
 * Automated Daily 9:16 Video Generator supporting Dual-Drop Cadence:
 * 1. Morning Slot (--type challenge): 108-Day Sacred Challenge Reel (Day 1..108)
 *    - Uses native Hero video audio + top-right circular PIP audio + normalized BGM
 * 2. Night Slot (--type feature): App Feature & Mental Peace Showcase (Features 1..6)
 *    - Uses pure pre-recorded evening clips (1..6) with native audio, no Day text
 * 
 * NOTE: Both formats use ONLY pure native pre-recorded human video audio.
 * Zero synthetic TTS is used or required.
 */

const { buildMorningReel } = require('./build_morning_reel');
const { buildNightReel } = require('./build_night_reel');

async function buildReel(type = 'challenge', targetId = null) {
  if (type === 'challenge') {
    return await buildMorningReel(targetId);
  }

  if (type === 'feature') {
    return await buildNightReel(targetId);
  }

  throw new Error(`Unknown reel type: ${type}. Must be 'challenge' or 'feature'.`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let type = 'challenge';
  let targetId = null;

  const typeIdx = args.indexOf('--type');
  if (typeIdx !== -1 && args[typeIdx + 1]) {
    type = args[typeIdx + 1].toLowerCase();
  }

  const idIdx = args.indexOf('--id') !== -1 ? args.indexOf('--id') : args.indexOf('--day');
  if (idIdx !== -1 && args[idIdx + 1]) {
    targetId = parseInt(args[idIdx + 1], 10);
  }

  buildReel(type, targetId).catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
  });
}

module.exports = { buildReel };