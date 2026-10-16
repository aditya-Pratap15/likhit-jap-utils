/**
 * ðŸš€ LIKHIT JAP - MULTI-PLATFORM DUAL PUBLISHER (v2.0 Master Production)
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
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const STATE_PATH = path.join(PROJECT_ROOT, 'state.json');
const QUOTES_PATH = path.join(PROJECT_ROOT, 'quotes_108.json');
const FEATURES_PATH = path.join(PROJECT_ROOT, 'app_features.json');
const REELS_DIR = path.join(PROJECT_ROOT, 'rendered_reels');

// Load environment variables or fallback
const FB_PAGE_ID = (process.env.FACEBOOK_PAGE_ID || '1413344915187463').trim();
const FB_TOKEN = (process.env.FACEBOOK_PAGE_ACCESS_TOKEN || 'EAAi2ZB1tN8IIBSkkrGUNSUHqtX5qzgA4lpCYlf4xygevpLneAODRYnA0v0QisvJ2OwckynnrzUYtrZBIWHik1bXkcY0r45C5KnotZBJIZBxYQudDqgk2sPLuFwbiGFIp5qQK1FkkK3oKo7wi0Vn9Qg4u1RV0CqMwSoaGAZAvTWkfdF1KBBy353X3a75bnWYANp0rJIRjE').trim();
const IG_ACCOUNT_ID = (process.env.INSTAGRAM_ACCOUNT_ID || '17841455874945250').trim();
const IG_TOKEN = (process.env.INSTAGRAM_ACCESS_TOKEN || FB_TOKEN).trim();
const YT_CLIENT_ID = (process.env.YOUTUBE_CLIENT_ID || '').trim();
const YT_CLIENT_SECRET = (process.env.YOUTUBE_CLIENT_SECRET || '').trim();
const YT_REFRESH_TOKEN = (process.env.YOUTUBE_REFRESH_TOKEN || '').trim();

function formatUnicodeBold(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\*\*(.+?)\*\*/g, (_, s) => {
    return Array.from(s).map(c => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D5D4 + code - 65);   // A-Z
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + code - 97);  // a-z
      if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7EC + code - 48);   // 0-9
      return c;
    }).join('');
  });
}


function loadState() {
  if (fs.existsSync(STATE_PATH)) {
    try {
      const content = fs.readFileSync(STATE_PATH, 'utf8').replace(/^\uFEFF/, '').trim();
      return JSON.parse(content);
    } catch (e) {
      console.error('⚠️ Warning: Failed to parse state.json:', e.message);
    }
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
  const cleanDescription = formatUnicodeBold(description);
  if (!FB_PAGE_ID || !FB_TOKEN) {
    console.log('  âš ï¸ Skipping Facebook Reel: FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not set.');
    return { skipped: true };
  }

  console.log(`  ðŸ“˜ Uploading Facebook Reel (${FB_PAGE_ID})...`);
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
    console.error('  âŒ Facebook Reel init failed:', startRes);
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
        'Content-Length': fileSize.toString(),
        'X-Entity-Length': fileSize.toString(),
        'Content-Type': 'application/octet-stream'
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
    description: cleanDescription
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

  console.log(`  âœ… Facebook Reel Published! Video ID: ${startRes.video_id}`);
  return { success: true, videoId: startRes.video_id };
}

/**
 * 2. Publish to YouTube Shorts
 */
async function publishYouTubeShort(videoPath, title, description) {
  const cleanTitle = formatUnicodeBold(title);
  const cleanDescription = formatUnicodeBold(description);
  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
    console.log('  âš ï¸ Skipping YouTube Shorts: YOUTUBE credentials not set.');
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

  console.log(`  ðŸ”´ Uploading YouTube Short: "${title}"...`);
  const metadata = JSON.stringify({
    snippet: {
      title: cleanTitle.slice(0, 100),
      description: cleanDescription,
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
    console.log(`  âœ… YouTube Short Live! URL: https://youtube.com/shorts/${uploadResult.id}`);
    return { success: true, videoId: uploadResult.id };
  }
  return { error: uploadResult };
}


/**
 * 3. Publish to Instagram Reels (Resumable Meta Protocol)
 */
async function publishInstagramReel(videoPath, caption) {
  const cleanCaption = formatUnicodeBold(caption);
  const token = IG_TOKEN || FB_TOKEN;
  if (!IG_ACCOUNT_ID || !token) {
    console.log('  âš ï¸ Skipping Instagram Reel: INSTAGRAM_ACCOUNT_ID or ACCESS_TOKEN not set.');
    return { skipped: true };
  }

  if (!fs.existsSync(videoPath)) return { skipped: true, error: 'Video file missing' };

  let uploadVideoPath = videoPath;
  let fileSize = fs.statSync(videoPath).size;

  // Auto-optimize if video > 20 MB for rapid Meta transcode
  if (fileSize > 20 * 1024 * 1024) {
    const optPath = videoPath.replace(/\.mp4$/i, '_optimized.mp4');
    if (!fs.existsSync(optPath)) {
      console.log('  âš¡ Video is large (' + (fileSize / 1024 / 1024).toFixed(1) + ' MB). Optimizing with FFmpeg for instant Instagram transcode...');
      try {
        execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -preset fast -crf 23 -maxrate 4.5M -bufsize 9M -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${optPath}"`, { stdio: 'ignore' });
      } catch (e) {
        console.warn('  âš ï¸ FFmpeg optimization skipped:', e.message);
      }
    }
    if (fs.existsSync(optPath)) {
      uploadVideoPath = optPath;
      fileSize = fs.statSync(uploadVideoPath).size;
      console.log('  âœ… Video optimized to ' + (fileSize / 1024 / 1024).toFixed(1) + ' MB for instant Meta ingestion.');
    }
  }

  console.log(`  ðŸ“¸ Uploading Instagram Reel to @likhitjap (${IG_ACCOUNT_ID})...`);

  const initParams = {
    access_token: token,
    upload_type: 'resumable',
    media_type: 'REELS',
    caption: cleanCaption
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
    console.error('  âŒ Instagram Reel container init failed:', initRes);
    return { error: initRes };
  }

  const containerId = initRes.id;
  const uploadUrl = new URL(initRes.uri);

  const uploadSuccess = await new Promise((resolve) => {
    const fileStream = fs.createReadStream(uploadVideoPath);
    const req = https.request({
      hostname: uploadUrl.hostname,
      port: 443,
      path: uploadUrl.pathname + uploadUrl.search,
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${token}`,
        'offset': '0',
        'file_size': fileSize.toString(),
        'Content-Length': fileSize.toString(),
        'X-Entity-Length': fileSize.toString(),
        'Content-Type': 'application/octet-stream'
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
    console.error('  âŒ Instagram binary upload failed.');
    return { error: 'Upload stream failed' };
  }

  // Poll status up to 160s
  console.log('  â³ Processing Instagram video encoding on Meta servers...');
  let isReady = false;
  let attempts = 0;
  while (!isReady && attempts < 40) {
    await new Promise(r => setTimeout(r, 4000));
    attempts++;
    const statusRes = await new Promise(resolve => {
      https.get(`https://graph.facebook.com/v26.0/${containerId}?fields=status_code&access_token=${token}`, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); } catch (e) { resolve({}); }
        });
      }).on('error', () => resolve({}));
    });

    if (statusRes.status_code === 'FINISHED') {
      isReady = true;
      console.log(`  âœ… Meta transcode ready (${attempts * 4}s)!`);
    } else if (statusRes.status_code === 'ERROR') {
      console.error('  âŒ Meta transcoding error:', statusRes);
      return { error: statusRes };
    } else {
      console.log(`  â³ Transcoding in progress (Attempt ${attempts}/40: ${statusRes.status_code || 'PENDING'})...`);
    }
  }

  if (!isReady) {
    console.error('  âŒ Meta encoding timed out. Cannot publish.');
    return { error: 'Encoding timeout' };
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
    console.log(`  âœ… Instagram Reel Published Live! Post ID: ${pubRes.id}`);
    return { success: true, postId: pubRes.id };
  } else {
    console.error('  âŒ Instagram Publish Error:', pubRes);
    return { error: pubRes };
  }
}

// --- Main Publisher ---
async function publishReel(type = 'challenge', targetId = null) {
  console.log('\n======================================================');
  console.log(`ðŸ“¡ LIKHIT JAP - MULTI-PLATFORM PUBLISHER [${type.toUpperCase()}]`);
  console.log('======================================================');

  const state = loadState();
  const isFeature = type === 'feature';
  const isForce = process.argv.includes('--force');
  const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // -------------------------------------------------------------
  // DAILY CADENCE GUARD: Prevent premature/duplicate publishing
  // -------------------------------------------------------------
  if (!isForce && !targetId) {
    if (!isFeature && state.lastPublishedChallengeDate === todayIst) {
      console.log(`\n[🛡️ Likhit Daily Cadence Guard] Today's Challenge Reel (Day ${state.lastPublishedDay}) has ALREADY been published on ${todayIst}!`);
      console.log(`   ⏭️ Skipping execution to prevent premature publishing of future reels!`);
      console.log(`   Day ${state.currentDay} will automatically publish tomorrow morning at 06:30 AM IST.`);
      return { skipped: true, reason: 'Challenge already published today' };
    }
    if (isFeature && state.lastPublishedFeatureDate === todayIst) {
      console.log(`\n[🛡️ Likhit Daily Cadence Guard] Today's Night Feature Reel (#${state.lastPublishedFeatureId}) has ALREADY been published tonight on ${todayIst}!`);
      console.log(`   ⏭️ Skipping execution to prevent duplicate night publishing.`);
      console.log(`   Next feature showcase reel will automatically publish tomorrow night at 09:45 PM IST.`);
      return { skipped: true, reason: 'Feature already published tonight' };
    }
  }

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
    shortTitle = `Daily Naam Jap — Day ${itemData.day} ✨ #Shorts #LikhitJap #NaamJap`;
  }

  const reelPath = path.join(REELS_DIR, reelFileName);
  if (!fs.existsSync(reelPath)) {
    throw new Error(`Reel video not found at ${reelPath}. Run build first!`);
  }

  console.log(`ðŸš€ Publishing Reel: ${reelFileName}`);

  const formattedCaption = formatUnicodeBold(itemData.caption);
  const formattedTitle = formatUnicodeBold(shortTitle);

  // 1. Facebook Reels
  await publishFacebookReel(reelPath, formattedCaption);

  // 2. Instagram Reels
  await publishInstagramReel(reelPath, formattedCaption);

  // 3. YouTube Shorts
  await publishYouTubeShort(reelPath, formattedTitle, formattedCaption);

    // Update State with Daily Cadence Guard Dates
  if (isFeature) {
    const featuresList = JSON.parse(fs.readFileSync(FEATURES_PATH, 'utf8'));
    state.lastPublishedFeatureId = itemData.id;
    state.lastPublishedFeatureDate = todayIst;
    state.currentFeatureIndex = (itemData.id % featuresList.length) + 1;
    console.log(`✨ Advanced next feature index to: #${state.currentFeatureIndex}`);
  } else {
    state.lastPublishedDay = itemData.day;
    state.lastPublishedChallengeDate = todayIst;
    state.currentDay = (itemData.day % 108) + 1;
    console.log(`✨ Advanced next challenge day to: Day ${state.currentDay}`);
  }
  state.lastPublishedAt = new Date().toISOString();
  saveState(state);

  console.log('\nðŸ Publishing cycle complete!\n');
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
    console.error('âŒ Publishing error:', err);
    process.exit(1);
  });
}

module.exports = { publishReel };

