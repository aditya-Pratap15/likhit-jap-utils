/**
 * 🌙 LIKHIT JAP - NIGHT APP SHOWCASE & EVENING REEL ENGINE
 * --------------------------------------------------------
 * Standardizes raw_clips/night_showcase/evening_clip_X.mp4 into
 * rendered_reels/Feature_0X_LikhitJap_Reel.mp4 at 1080x1920 with AAC audio.
 * ZERO morning Day X challenge text.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RAW_CLIPS_DIR = path.join(PROJECT_ROOT, 'raw_clips');
const NIGHT_CLIPS_DIR = path.join(RAW_CLIPS_DIR, 'night_showcase');
const REELS_DIR = path.join(PROJECT_ROOT, 'rendered_reels');
const FEATURES_PATH = path.join(PROJECT_ROOT, 'app_features.json');
const STATE_PATH = path.join(PROJECT_ROOT, 'state.json');

function loadState() {
  if (fs.existsSync(STATE_PATH)) {
    try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (e) {}
  }
  return { currentDay: 1, currentFeatureIndex: 1 };
}

async function buildNightReel(targetId = null) {
  console.log('\n======================================================');
  console.log('🌙 LIKHIT JAP - BUILDING NIGHT SHOWCASE REEL');
  console.log('======================================================');

  if (!fs.existsSync(REELS_DIR)) fs.mkdirSync(REELS_DIR, { recursive: true });

  const state = loadState();
  const featuresList = JSON.parse(fs.readFileSync(FEATURES_PATH, 'utf8'));
  const featId = targetId || state.currentFeatureIndex || 1;
  const itemData = featuresList.find(f => f.id === featId) || featuresList[0];

  const clipFileName = itemData.clipFile || ('evening_clip_' + itemData.id + '.mp4');
  const inputClipPath = path.join(NIGHT_CLIPS_DIR, clipFileName);

  if (!fs.existsSync(inputClipPath)) {
    throw new Error('Evening clip not found at ' + inputClipPath);
  }

  const safePrefix = 'Feature_' + String(itemData.id).padStart(2, '0');
  const finalReelPath = path.join(REELS_DIR, safePrefix + '_LikhitJap_Reel.mp4');

  console.log('  🎬 Evening Clip:    ' + clipFileName);
  console.log('  📱 Feature Theme:   ' + itemData.theme);
  console.log('  📁 Input Path:      ' + inputClipPath);
  console.log('  🎯 Target Reel:     ' + finalReelPath);

  const vfFilter = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p';
  const cmd = 'ffmpeg -y -i "' + inputClipPath + '" -vf "' + vfFilter + '" -c:v libx264 -preset fast -crf 20 -c:a aac -b:a 192k -movflags +faststart "' + finalReelPath + '"';

  console.log('  ⚙️ Encoding evening showcase reel with FFmpeg...');
  execSync(cmd, { stdio: 'inherit' });

  const stats = fs.statSync(finalReelPath);
  console.log('\n======================================================');
  console.log('🎉 NIGHT SHOWCASE REEL READY: ' + path.basename(finalReelPath));
  console.log('📁 File Path: ' + finalReelPath);
  console.log('⏱️ Size:      ' + (stats.size / 1024 / 1024).toFixed(1) + ' MB');
  console.log('======================================================\n');

  return {
    type: 'feature',
    id: itemData.id,
    videoPath: finalReelPath,
    caption: itemData.caption
  };
}

module.exports = { buildNightReel };

if (require.main === module) {
  const args = process.argv.slice(2);
  let targetId = null;
  const idIdx = args.indexOf('--id');
  if (idIdx !== -1 && args[idIdx + 1]) {
    targetId = parseInt(args[idIdx + 1], 10);
  }
  buildNightReel(targetId).catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
  });
}