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
const IG_ACCOUNT_ID = (process.env.INSTAGRAM_ACCOUNT_ID || '17841455874945250').trim();
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


/**
 * 3. Publish to Instagram Reels (Resumable Meta Protocol)
 */
async function publishInstagramReel(videoPath, caption) {
  const token = IG_TOKEN || FB_TOKEN;
  if (!IG_ACCOUNT_ID || !token) {
    console.log('  ⚠️ Skipping Instagram Reel: INSTAGRAM_ACCOUNT_ID or ACCESS_TOKEN not set.');
    return { skipped: true };
  }

  if (!fs.existsSync(videoPath)) return { skipped: true, error: 'Video file missing' };
  const fileSize = fs.statSync(videoPath).size;
  console.log(`  📸 Uploading Instagram Reel to @likhitjap (${IG_ACCOUNT_ID})...`);

  const initParams = {
    access_token: token,
    upload_type: 'resumable',
    media_type: 'REELS',
    caption: caption
  };

  const initData = new URLSearchParams(initParams).toString();
  const initRes = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v26.0/${IG_ACCOUNT_ID}/media`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(initData)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: data }); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(initData);
    req.end();
  });

  if (!initRes || !initRes.id || !initRes.uri) {
    console.error('  ❌ Instagram Reel container init failed:', initRes);
    return { error: initRes };
  }

  const containerId = initRes.id;
  const uploadUrl = new URL(initRes.uri);

  const uploadSuccess = await new Promise((resolve) => {
    const fileStream = fs.createReadStream(videoPath);
    const req = https.request({
      hostname: uploadUrl.hostname,
      port: 443,
      path: uploadUrl.pathname + uploadUrl.search,
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${token}`,
        'offset': '0',
        'file_size': fileSize.toString()
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.success !== false);
        } catch (e) { resolve(true); }
      });
    });
    req.on('error', () => resolve(false));
    fileStream.pipe(req);
  });

  if (!uploadSuccess) {
    console.error('  ❌ Instagram binary upload failed.');
    return { error: 'Upload stream failed' };
  }

  // Poll status up to 60s
  console.log('  ⏳ Processing Instagram video encoding on Meta servers...');
  let isReady = false;
  let attempts = 0;
  while (!isReady && attempts < 12) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
    const statusRes = await new Promise(resolve => {
      https.get(`https://graph.facebook.com/v26.0/${containerId}?fields=status_code&access_token=${token}`, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); } catch (e) { resolve({}); }
        });
      });
    });

    if (statusRes.status_code === 'FINISHED') isReady = true;
    else if (statusRes.status_code === 'ERROR') {
      console.error('  ❌ Meta transcoding error:', statusRes);
      return { error: statusRes };
    }
  }

  // Publish
  const pubParams = new URLSearchParams({
    creation_id: containerId,
    access_token: token
  }).toString();

  const pubRes = await new Promise(resolve => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v26.0/${IG_ACCOUNT_ID}/media_publish`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(pubParams)
      }
    }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: data }); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(pubParams);
    req.end();
  });

  if (pubRes.id) {
    console.log(`  ✅ Instagram Reel Published Live! Post ID: ${pubRes.id}`);
    return { success: true, postId: pubRes.id };
  } else {
    console.error('  ❌ Instagram Publish Error:', pubRes);
    return { error: pubRes };
  }
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

  // 2. Instagram Reels
  await publishInstagramReel(reelPath, itemData.caption);

  // 3. YouTube Shorts
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
