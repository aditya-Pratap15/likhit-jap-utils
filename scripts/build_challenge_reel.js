#!/usr/bin/env node
/**
 * 🎬 LIKHIT JAP - DUAL REEL DISPATCHER & VIDEO ENGINE
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

const fs = require('fs');
const path = require('path');
const { buildMorningReel } = require('./build_morning_reel');
const { buildNightReel } = require('./build_night_reel');

async function buildReel(type = 'challenge', targetId = null) {
  const isForce = process.argv.includes('--force');
  const statePath = path.join(__dirname, '..', 'state.json');

  if (fs.existsSync(statePath) && !isForce && !targetId) {
    try {
      const raw = fs.readFileSync(statePath, 'utf8').replace(/^\uFEFF/, '').trim();
      const state = JSON.parse(raw);
      const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      if (type === 'challenge' && state.lastPublishedChallengeDate === todayIst) {
        console.log(`[🛡️ Likhit Daily Cadence Guard] Challenge Reel Day ${state.lastPublishedDay} has ALREADY been published today (${todayIst}). Skipping video build to prevent premature generation.`);
        return null;
      }
      if (type === 'feature' && state.lastPublishedFeatureDate === todayIst) {
        console.log(`[🛡️ Likhit Daily Cadence Guard] Feature Reel #${state.lastPublishedFeatureId} has ALREADY been published tonight (${todayIst}). Skipping video build.`);
        return null;
      }
    } catch(e) {
      console.warn('⚠️ Warning checking cadence state in build:', e.message);
    }
  }

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
