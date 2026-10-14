/**
 * 🕉️ LIKHIT JAP - DUAL REEL STUDIO & VIDEO ENGINE (v2.0 Master Production)
 * -----------------------------------------------------------------------
 * Automated Daily 9:16 Video Generator supporting Dual-Drop Cadence:
 * 1. Morning Slot (--type challenge): 108-Day Sacred Jap Challenge (Day 1..108)
 * 2. Night Slot (--type feature): App Feature & Mental Peace Showcase (Features 1..6)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// --- Paths & Constants ---
const PROJECT_ROOT = path.resolve(__dirname, '..');
const RAW_CLIPS_DIR = path.join(PROJECT_ROOT, 'raw_clips');
const MORNING_CLIPS_DIR = path.join(RAW_CLIPS_DIR, 'morning_challenge');
const NIGHT_CLIPS_DIR = path.join(RAW_CLIPS_DIR, 'night_showcase');
const BGM_DIR = path.join(PROJECT_ROOT, 'background_music');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');
const REELS_DIR = path.join(PROJECT_ROOT, 'rendered_reels');
const TEMP_DIR = path.join(PROJECT_ROOT, 'temp_build');
const STATE_PATH = path.join(PROJECT_ROOT, 'state.json');
const QUOTES_PATH = path.join(PROJECT_ROOT, 'quotes_108.json');
const FEATURES_PATH = path.join(PROJECT_ROOT, 'app_features.json');

const BGM_PATH = path.join(BGM_DIR, 'bansuri_bgm.mp3');
const APP_ICON_PATH = path.join(ASSETS_DIR, 'app_icon.png');
const OUTRO_DURATION = 3.2; // seconds

// Ensure runtime directories exist
[RAW_CLIPS_DIR, BGM_DIR, ASSETS_DIR, REELS_DIR, TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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

function getMediaDuration(mediaPath) {
  try {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${mediaPath}"`;
    const stdout = execSync(cmd).toString().trim();
    const dur = parseFloat(stdout);
    return isNaN(dur) ? 15.0 : dur;
  } catch (err) {
    return 15.0;
  }
}


async function generateGoogleTTS(text, lang, outputPath) {
  const words = (text || '').split(/\s+/);
  const chunks = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 180) {
      chunks.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) chunks.push(cur);

  const audioBuffers = [];
  for (const chunk of chunks) {
    const buf = await new Promise((resolve, reject) => {
      const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(chunk) + '&tl=' + lang + '&client=tw-ob';
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, res => {
        if (res.statusCode !== 200) return reject(new Error('Google TTS HTTP ' + res.statusCode));
        const cArr = [];
        res.on('data', d => cArr.push(d));
        res.on('end', () => resolve(Buffer.concat(cArr)));
      }).on('error', reject);
    });
    audioBuffers.push(buf);
  }
  fs.writeFileSync(outputPath, Buffer.concat(audioBuffers));
}

async function generateHindiVoice(rawText, outputPath, maxRetries = 3) {
  const text = (rawText || '').replace(/&/g, ' और ').replace(/[<>]/g, '').trim();
  const voice = 'hi-IN-MadhurNeural';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  🎙️ Synthesizing sacred Hindi narration (${voice}) [Attempt ${attempt}/${maxRetries}]...`);
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

      const audioChunks = [];
      await new Promise((resolve, reject) => {
        const { audioStream } = tts.toStream(text);
        audioStream.on('data', chunk => audioChunks.push(chunk));
        audioStream.on('end', resolve);
        audioStream.on('error', reject);
      });

      const buffer = Buffer.concat(audioChunks);
      if (buffer.length === 0) throw new Error('Received empty audio buffer from TTS service');
      fs.writeFileSync(outputPath, buffer);
      const duration = getMediaDuration(outputPath);
      console.log(`  ✅ Voiceover generated: ${duration.toFixed(2)}s`);
      return duration;
    } catch (err) {
      console.warn(`  [!] Tier 1 Hindi TTS Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  // --- TIER 2: BULLETPROOF GOOGLE HINDI TTS BACKUP ---
  console.warn(`    🛡️ Engaging Tier 2 Google Hindi TTS Fallback (Zero-Failure Guarantee)...`);
  try {
    await generateGoogleTTS(text, 'hi', outputPath);
    const duration = getMediaDuration(outputPath);
    console.log(`    ✅ Tier 2 Hindi Voiceover created successfully (${duration.toFixed(2)}s)`);
    return duration;
  } catch (fallbackErr) {
    console.error(`    [!] Tier 2 Hindi TTS failed: ${fallbackErr.message}`);
    throw fallbackErr;
  }
}

// Render Typography Overlay for Challenge or Feature
async function renderOverlay(itemData, isFeature, outputPath) {
  console.log(`  🎨 Rendering typography overlay (${isFeature ? 'App Feature' : 'Sacred Challenge'})...`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });

  const headerPillTitle = isFeature ? '5-MIN DAILY SACRED HABIT' : '108-DAY SACRED JAP CHALLENGE';
  const headerPillTag = isFeature ? 'FEATURE SPOTLIGHT' : itemData.dayText;
  const subBadgeText = isFeature ? itemData.badge : `दैनिक नाम साधना: ${itemData.mantra}`;
  const benefitChipText = isFeature ? itemData.benefitChip : '✍️ लिखित नाम जप · १० गुना अधिक प्रभाव';
  const hookText = itemData.hook;
  const bodyText = isFeature ? itemData.body : itemData.quoteHindi;

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Noto+Sans+Devanagari:wght@600;700;800;900&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 1080px;
        height: 1920px;
        background: transparent;
        font-family: 'Noto Sans Devanagari', sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 90px 60px 140px 60px;
        color: #FFFFFF;
        overflow: hidden;
      }
      .header-pill {
        align-self: center;
        background: linear-gradient(135deg, rgba(234, 88, 12, 0.95), rgba(180, 83, 9, 0.95));
        border: 2px solid rgba(254, 240, 138, 0.9);
        border-radius: 999px;
        padding: 16px 42px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 25px rgba(245, 158, 11, 0.5);
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .header-title {
        font-size: 32px;
        font-weight: 900;
        letter-spacing: 1.5px;
        color: #FEF08A;
        text-shadow: 0 2px 4px rgba(0,0,0,0.6);
      }
      .header-tag {
        font-size: 26px;
        font-weight: 700;
        background: rgba(0,0,0,0.3);
        padding: 6px 18px;
        border-radius: 999px;
        color: #FFFFFF;
      }
      .mantra-badge {
        align-self: center;
        margin-top: 30px;
        background: rgba(15, 10, 5, 0.75);
        backdrop-filter: blur(12px);
        border: 1.5px solid rgba(245, 158, 11, 0.4);
        border-radius: 50px;
        padding: 10px 32px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .mantra-text {
        font-size: 28px;
        font-weight: 800;
        color: #FCD34D;
      }
      .bottom-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .wisdom-card {
        background: linear-gradient(180deg, rgba(20, 14, 8, 0.88) 0%, rgba(10, 6, 2, 0.94) 100%);
        backdrop-filter: blur(18px);
        border: 2px solid rgba(245, 158, 11, 0.5);
        border-radius: 36px;
        padding: 44px 44px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(254, 240, 138, 0.3);
        position: relative;
      }
      .hook-text {
        font-size: 40px;
        font-weight: 900;
        line-height: 1.35;
        color: #FBBF24;
        margin-bottom: 20px;
        text-shadow: 0 3px 8px rgba(0,0,0,0.8);
      }
      .wisdom-body {
        font-size: 32px;
        font-weight: 600;
        line-height: 1.5;
        color: #F3F4F6;
        text-shadow: 0 2px 6px rgba(0,0,0,0.9);
      }
      .card-footer {
        margin-top: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid rgba(245, 158, 11, 0.25);
        padding-top: 18px;
      }
      .benefit-chip {
        font-size: 24px;
        font-weight: 700;
        color: #FDE68A;
      }
      .app-mention {
        font-size: 22px;
        font-weight: 800;
        background: #DC2626;
        color: #FFFFFF;
        padding: 6px 18px;
        border-radius: 8px;
        letter-spacing: 0.5px;
      }
    </style>
  </head>
  <body>
    <div>
      <div class="header-pill">
        <span style="font-size: 32px;">${isFeature ? '✨' : '🚩'}</span>
        <span class="header-title">${headerPillTitle}</span>
        <span class="header-tag">${headerPillTag}</span>
      </div>

      <div class="mantra-badge">
        <span>✨</span>
        <span class="mantra-text">${subBadgeText}</span>
      </div>
    </div>

    <div class="bottom-container">
      <div class="wisdom-card">
        <div class="hook-text">${hookText}</div>
        <div class="wisdom-body">${bodyText}</div>
        <div class="card-footer">
          <div class="benefit-chip">${benefitChipText}</div>
          <div class="app-mention">APP: LIKHIT JAP</div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outputPath, omitBackground: true });
  await browser.close();
}

async function renderOutroCard(outputPath) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });

  let appIconBase64 = '';
  if (fs.existsSync(APP_ICON_PATH)) {
    appIconBase64 = 'data:image/png;base64,' + fs.readFileSync(APP_ICON_PATH).toString('base64');
  }

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;900&family=Noto+Sans+Devanagari:wght@700;800;900&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 1080px;
        height: 1920px;
        background: radial-gradient(circle at 50% 40%, #2A1505 0%, #100802 70%, #050200 100%);
        font-family: 'Outfit', 'Noto Sans Devanagari', sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px;
        color: #FFFFFF;
        position: relative;
        overflow: hidden;
      }
      .aura {
        position: absolute;
        width: 750px;
        height: 750px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(234, 88, 12, 0.08) 60%, transparent 80%);
        filter: blur(50px);
        z-index: 1;
      }
      .content-wrapper {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        width: 100%;
      }
      .icon-container {
        width: 250px;
        height: 250px;
        border-radius: 54px;
        background: #1E120A;
        border: 4px solid #F59E0B;
        box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 50px rgba(245, 158, 11, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 45px;
        overflow: hidden;
      }
      .icon-container img { width: 100%; height: 100%; object-fit: cover; }
      .app-title-hindi {
        font-size: 78px;
        font-weight: 900;
        color: #FEF08A;
        text-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
        margin-bottom: 6px;
      }
      .app-title-en { font-size: 50px; font-weight: 900; letter-spacing: 4px; color: #FFFFFF; margin-bottom: 24px; }
      .tagline { font-size: 34px; font-weight: 700; color: #FCD34D; max-width: 820px; line-height: 1.45; margin-bottom: 40px; }
      .badges-row { display: flex; gap: 20px; margin-bottom: 55px; }
      .badge {
        background: rgba(255, 255, 255, 0.08);
        border: 1.5px solid rgba(254, 240, 138, 0.3);
        border-radius: 999px;
        padding: 12px 28px;
        font-size: 24px;
        font-weight: 700;
        color: #F3F4F6;
      }
      .cta-button {
        width: 90%;
        max-width: 860px;
        background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
        border: 3px solid #FEF08A;
        border-radius: 36px;
        padding: 30px 40px;
        box-shadow: 0 20px 50px rgba(217, 119, 6, 0.6);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        margin-bottom: 35px;
      }
      .cta-headline { font-size: 42px; font-weight: 900; color: #1A0D00; }
      .cta-sub { font-size: 26px; font-weight: 800; color: #451A03; }
      .bio-pointer { font-size: 32px; font-weight: 800; color: #FDE68A; display: flex; align-items: center; gap: 14px; }
    </style>
  </head>
  <body>
    <div class="aura"></div>
    <div class="content-wrapper">
      <div class="icon-container">
        <img src="${appIconBase64}" alt="Likhit Jap Icon" />
      </div>
      <div class="app-title-hindi">लिखित जप</div>
      <div class="app-title-en">LIKHIT JAP</div>
      <div class="tagline">हाथ से नाम लिखने की पहली डिजिटल नाम जप डायरी</div>
      <div class="badges-row">
        <div class="badge">⭐ 108 माला काउंटर</div>
        <div class="badge">🔔 मंदिर घंटियां</div>
        <div class="badge">🕊️ 100% मुफ़्त & ऑफ़लाइन</div>
      </div>
      <div class="cta-button">
        <div class="cta-headline">🔍 Google Play Store पर सर्च करें</div>
        <div class="cta-sub">"Likhit Jap" टाइप करके आज ही शुरू करें</div>
      </div>
      <div class="bio-pointer">
        <span>📲 लिंक बायो में उपलब्ध है</span>
        <span style="font-size: 38px;">👆</span>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outputPath });
  await browser.close();
}

function resolveRawVideoSource(subfolderDir, seedIndex, contentDuration, outPreparedVideo) {
  const allowedExts = ['.mp4', '.mov', '.mkv', '.webm'];
  let availableClips = [];
  if (fs.existsSync(subfolderDir)) {
    availableClips = fs.readdirSync(subfolderDir)
      .filter(f => allowedExts.includes(path.extname(f).toLowerCase()))
      .map(f => path.join(subfolderDir, f));
  }
  if (availableClips.length === 0 && fs.existsSync(RAW_CLIPS_DIR)) {
    availableClips = fs.readdirSync(RAW_CLIPS_DIR)
      .filter(f => allowedExts.includes(path.extname(f).toLowerCase()))
      .map(f => path.join(RAW_CLIPS_DIR, f));
  }

  if (availableClips.length > 0) {
    const selected = availableClips[(seedIndex - 1) % availableClips.length];
    console.log(`  🎬 Using rotating raw recording: ${path.basename(selected)} (Rotation ${seedIndex}/${availableClips.length})`);
    const filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=brightness=-0.08:contrast=1.05`;
    const cmd = `ffmpeg -y -stream_loop -1 -i "${selected}" -t ${contentDuration.toFixed(2)} -vf "${filter}" -c:v libx264 -preset fast -crf 20 -an "${outPreparedVideo}"`;
    execSync(cmd, { stdio: 'inherit' });
    return outPreparedVideo;
  }

  const cmd = `ffmpeg -y -f lavfi -i "color=c=0x1A0F05:s=1080x1920:r=30:d=${contentDuration.toFixed(2)}" -vf "drawbox=x=40:y=40:w=1000:h=1840:color=gold@0.2:t=3,format=yuv420p" -c:v libx264 -preset fast -crf 20 "${outPreparedVideo}"`;
  execSync(cmd, { stdio: 'inherit' });
  return outPreparedVideo;
}

// --- Main Builder Pipeline ---
async function buildReel(type = 'challenge', targetId = null) {
  if (type === 'challenge') {
    const { buildMorningReel } = require('./build_morning_reel');
    return await buildMorningReel(targetId);
  }

  if (type === 'feature') {
    const { buildNightReel } = require('./build_night_reel');
    return await buildNightReel(targetId);
  }

  console.log('\n======================================================');
  console.log(`🕉️ LIKHIT JAP - REEL STUDIO [MODE: ${type.toUpperCase()}]`);
  console.log('======================================================');

  const state = loadState();
  const isFeature = type === 'feature';

  let itemData = null;
  let safePrefix = '';

  if (isFeature) {
    const featuresList = JSON.parse(fs.readFileSync(FEATURES_PATH, 'utf8'));
    const featId = targetId || state.currentFeatureIndex || 1;
    itemData = featuresList.find(f => f.id === featId) || featuresList[0];
    safePrefix = `Feature_${String(itemData.id).padStart(2, '0')}`;
    console.log(`📱 Building Night Showcase #${itemData.id}: "${itemData.theme}"`);
  } else {
    const quotesList = JSON.parse(fs.readFileSync(QUOTES_PATH, 'utf8'));
    const day = targetId || state.currentDay || 1;
    itemData = quotesList.find(q => q.day === day) || quotesList[0];
    safePrefix = `Day_${String(itemData.day).padStart(3, '0')}`;
    console.log(`📅 Building Morning Challenge Day ${itemData.day}/108: Mantra: ${itemData.mantra}`);
  }

  const voicePath = path.join(TEMP_DIR, `${safePrefix}_voice.mp3`);
  const overlayPngPath = path.join(TEMP_DIR, `${safePrefix}_overlay.png`);
  const outroPngPath = path.join(TEMP_DIR, `outro_card.png`);
  const rawVideoCutPath = path.join(TEMP_DIR, `${safePrefix}_raw_cut.mp4`);
  const finalReelPath = path.join(REELS_DIR, `${safePrefix}_LikhitJap_Reel.mp4`);

  // 1. Voiceover
  const voiceDuration = await generateHindiVoice(itemData.voiceScript, voicePath);
  const totalDuration = voiceDuration + OUTRO_DURATION;

  // 2. Overlays
  await renderOverlay(itemData, isFeature, overlayPngPath);
  await renderOutroCard(outroPngPath);

  // 3. Raw video cut
  const targetClipsDir = isFeature ? NIGHT_CLIPS_DIR : MORNING_CLIPS_DIR;
  const seedNum = isFeature ? (itemData.id + 10) : itemData.day;
  resolveRawVideoSource(targetClipsDir, seedNum, voiceDuration, rawVideoCutPath);

  // 4. FFmpeg assembly
  const fadeOutStart = Math.max(0, totalDuration - 1.2).toFixed(2);
  const filterComplex = 
    `[0:v][1:v]overlay=0:0[main_scene];` +
    `[2:v]loop=loop=${Math.round(OUTRO_DURATION * 30)}:size=1:start=0,setpts=PTS-STARTPTS[outro_scene];` +
    `[main_scene][outro_scene]concat=n=2:v=1:a=0[v_final];` +
    `[3:a]volume=1.8,apad=pad_dur=${OUTRO_DURATION + 1}[v_voice];` +
    `[4:a]volume=0.18,afade=t=out:st=${fadeOutStart}:d=1.2[v_bgm];` +
    `[v_voice][v_bgm]amix=inputs=2:duration=first:dropout_transition=2[a_final]`;

  const ffmpegCmd = [
    'ffmpeg -y',
    `-i "${rawVideoCutPath}"`,
    `-i "${overlayPngPath}"`,
    `-i "${outroPngPath}"`,
    `-i "${voicePath}"`,
    `-stream_loop -1 -i "${BGM_PATH}"`,
    `-filter_complex "${filterComplex}"`,
    `-map "[v_final]" -map "[a_final]"`,
    `-t ${totalDuration.toFixed(2)}`,
    `-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p`,
    `-c:a aac -b:a 192k -ar 48000`,
    `"${finalReelPath}"`
  ].join(' ');

  execSync(ffmpegCmd, { stdio: 'inherit' });

  console.log(`\n🎉 Reel created successfully: ${finalReelPath} (${totalDuration.toFixed(2)}s)`);

  return {
    type,
    id: isFeature ? itemData.id : itemData.day,
    videoPath: finalReelPath,
    caption: itemData.caption
  };
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
