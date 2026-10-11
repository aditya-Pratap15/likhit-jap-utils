/**
 * 🚀 LIKHIT JAP - MULTI-PLATFORM DUAL PUBLISHER (v2.0 Master Production)
 * ---------------------------------------------------------------------
 * Automatically syndicates both:
 * 1. Morning Challenge Reels (--type challenge)
 * 2. Night Feature Showcase Reels (--type feature)
 *
 * Supported Platforms:
 * - Facebook Reels (Meta Graph API /video_reels)
 * - Instagram Reels (Meta Graph API /media container)
 * - YouTube Shorts (YouTube Data API v3 Resumable Upload)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const STATE_PATH = path.join(PROJECT_ROOT, 'state.json');
const QUOTES_PATH = path.join(PROJECT_ROOT, 'quotes_108.json');
const FEATURES_PATH = path.join(PROJECT_ROOT, 'app_features.json');
const REELS_DIR = path.join(PROJECT_ROOT, 'rendered_reels');

// Load environment variables or fallback
const FB_PAGE_ID = (process.env.FACEBOOK_PAGE_ID || '1413344915187463').trim();
const FB_TOKEN = (process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '').trim();
const IG_ACCOUNT_ID = (process.env.INSTAGRAM_ACCOUNT_ID || '').trim();
const IG_TOKEN = (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();
const YT_CLIENT_ID = (process.env.YOUTUBE_CLIENT_ID || '').trim();
const YT_CLIENT_SECRET = (process.env.YOUTUBE_CLIENT_SECRET || '').trim();
const YT_REFRESH_TOKEN = (process.env.YOUTUBE_REFRESH_TOKEN || '').trim();

function loadState() {
  if (fs.existsSync(STATE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    } catch (e) {}
  }
  return { currentDay: 1, currentFeatureIndex: 1, history: [] };
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * 1. Publish to Facebook Reels
 */
async function publishFacebookReel(videoPath, description) {
  if (!FB_PAGE_ID || !FB_TOKEN) {
    console.log('  ⚠️ Skipping Facebook Reel: FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not set.');
    return { skipped: true };
  }

  console.log(`  📘 Uploading Facebook Reel (${FB_PAGE_ID})...`);
  const videoBuf = fs.readFileSync(videoPath);
  const fileSize = videoBuf.length;

  // Phase 1: Start
  const startParams = new URLSearchParams({
    access_token: FB_TOKEN,
    upload_phase: 'start'
  }).toString();

  const startRes = await new Promise(resolve => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v26.0/${FB_PAGE_ID}/video_reels`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(startParams)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: data }); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(startParams);
    req.end();
  });

  if (!startRes.video_id || !startRes.upload_url) {
    console.error('  ❌ Facebook Reel init failed:', startRes);
    return { error: startRes };
  }

  // Phase 2: Binary Upload
  const uploadUrl = new URL(startRes.upload_url);
  await new Promise(resolve => {
    const req = https.request({
      protocol: uploadUrl.protocol,
      hostname: uploadUrl.hostname,
      port: uploadUrl.port || 443,
      path: `${uploadUrl.pathname}${uploadUrl.search}`,
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${FB_TOKEN}`,
        'offset': '0',
        'file_size': fileSize.toString(),
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileSize
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: data }); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(videoBuf);
    req.end();
  });

  // Phase 3: Finish & Publish Live
  const finishParams = new URLSearchParams({
    access_token: FB_TOKEN,
    upload_phase: 'finish',
    video_id: startRes.video_id,
    video_state: 'PUBLISHED',
    description: description
  }).toString();

  await new Promise(resolve => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v26.0/${FB_PAGE_ID}/video_reels`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(finishParams)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: data }); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(finishParams);
    req.end();
  });

  console.log(`  ✅ Facebook Reel Published! Video ID: ${startRes.video_id}`);
  return { success: true, videoId: startRes.video_id };
}

/**
 * 2. Publish to YouTube Shorts
 */
async function publishYouTubeShort(videoPath, title, description) {
  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
    console.log('  ⚠️ Skipping YouTube Shorts: YOUTUBE credentials not set.');
    return { skipped: true };
  }

  const tokenData = new URLSearchParams({
    client_id: YT_CLIENT_ID,
    client_secret: YT_CLIENT_SECRET,
    refresh_token: YT_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  }).toString();

  const accessToken = await new Promise(resolve => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      port: 443,
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).access_token); } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(tokenData);
    req.end();
  });

  if (!accessToken) return { error: 'OAuth failed' };

  console.log(`  🔴 Uploading YouTube Short: "${title}"...`);
  const metadata = JSON.stringify({
    snippet: {
      title: title.slice(0, 100),
      description: description,
      tags: ['LikhitJap', 'Shorts', 'NaamJap', 'RadhaNaam', 'MentalPeace', 'SpiritualIndia'],
      categoryId: '22'
    },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
  });

  const videoBuf = fs.readFileSync(videoPath);
  const initRes = await new Promise(resolve => {
    const req = https.request({
      hostname: 'www.googleapis.com',
      port: 443,
      path: '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': videoBuf.length,
        'Content-Length': Buffer.byteLength(metadata)
      }
    }, res => resolve(res.headers.location));
    req.on('error', () => resolve(null));
    req.write(metadata);
    req.end();
  });

  if (!initRes) return { error: 'Init failed' };

  const uploadUrl = new URL(initRes);
  const uploadResult = await new Promise(resolve => {
    const req = https.request({
      protocol: uploadUrl.protocol,
      hostname: uploadUrl.hostname,
      port: uploadUrl.port || 443,
      path: `${uploadUrl.pathname}${uploadUrl.search}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuf.length
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: data }); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(videoBuf);
    req.end();
  });

  if (uploadResult.id) {
    console.log(`  ✅ YouTube Short Live! URL: https://youtube.com/shorts/${uploadResult.id}`);
    return { success: true, videoId: uploadResult.id };
  }
  return { error: uploadResult };
}

// --- Main Publisher ---
async function publishReel(type = 'challenge', targetId = null) {
  console.log('\n======================================================');
  console.log(`📡 LIKHIT JAP - MULTI-PLATFORM PUBLISHER [${type.toUpperCase()}]`);
  console.log('======================================================');

  const state = loadState();
  const isFeature = type === 'feature';

  let itemData = null;
  let reelFileName = '';
  let shortTitle = '';

  if (isFeature) {
    const featuresList = JSON.parse(fs.readFileSync(FEATURES_PATH, 'utf8'));
    const featId = targetId || state.currentFeatureIndex || 1;
    itemData = featuresList.find(f => f.id === featId) || featuresList[0];
    reelFileName = `Feature_${String(itemData.id).padStart(2, '0')}_LikhitJap_Reel.mp4`;
    shortTitle = `Likhit Jap: ${itemData.badge} #Shorts #LikhitJap`;
  } else {
    const quotesList = JSON.parse(fs.readFileSync(QUOTES_PATH, 'utf8'));
    const day = targetId || state.currentDay || 1;
    itemData = quotesList.find(q => q.day === day) || quotesList[0];
    reelFileName = `Day_${String(itemData.day).padStart(3, '0')}_LikhitJap_Reel.mp4`;
    shortTitle = `108-Day Sacred Jap Challenge | Day ${itemData.day}/108 #Shorts #LikhitJap`;
  }

  const reelPath = path.join(REELS_DIR, reelFileName);
  if (!fs.existsSync(reelPath)) {
    throw new Error(`Reel video not found at ${reelPath}. Run build first!`);
  }

  console.log(`🚀 Publishing Reel: ${reelFileName}`);

  // 1. Facebook Reels
  await publishFacebookReel(reelPath, itemData.caption);

  // 2. YouTube Shorts
  await publishYouTubeShort(reelPath, shortTitle, itemData.caption);

  // Update State
  if (isFeature) {
    const featuresList = JSON.parse(fs.readFileSync(FEATURES_PATH, 'utf8'));
    state.lastPublishedFeatureId = itemData.id;
    state.currentFeatureIndex = (itemData.id % featuresList.length) + 1;
    console.log(`✨ Advanced next feature index to: #${state.currentFeatureIndex}`);
  } else {
    state.lastPublishedDay = itemData.day;
    state.currentDay = (itemData.day % 108) + 1;
    console.log(`✨ Advanced next challenge day to: Day ${state.currentDay}`);
  }
  state.lastPublishedAt = new Date().toISOString();
  saveState(state);

  console.log('\n🏁 Publishing cycle complete!\n');
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

  publishReel(type, targetId).catch(err => {
    console.error('❌ Publishing error:', err);
    process.exit(1);
  });
}

module.exports = { publishReel };
