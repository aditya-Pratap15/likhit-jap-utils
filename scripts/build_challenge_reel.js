/**
 * 🕉️ LIKHIT JAP - REEL STUDIO & VIDEO ENGINE (v1.0 Master Production)
 * ------------------------------------------------------------------
 * Automated Daily 9:16 Video Generator for 108-Day Sacred Jap Challenge.
 * Builds high-converting vertical Reels/Shorts for:
 * - Instagram Reels
 * - YouTube Shorts
 * - Facebook Reels
 *
 * Architecture:
 * 1. Day & Metadata: Fetches Day X reflection from quotes_108.json & state.json.
 * 2. Raw Clip Rotation: Cycles through user screen-recordings in raw_clips/.
 * 3. Divine Hindi Voiceover: Synthesizes hi-IN-MadhurNeural using @andresaya/edge-tts.
 * 4. High-Resolution Visuals: Uses Puppeteer to render pixel-perfect Devanagari typography.
 * 5. Audio Engineering: Mixes authentic app Bansuri flute BGM (18%) with boosted voiceover (180%).
 * 6. High-Converting Outro: Dedicated 3.2s CTA card driving searches for "Likhit Jap" on Play Store.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');
const { EdgeTTS, Constants } = require('@andresaya/edge-tts');

// --- Paths & Constants ---
const PROJECT_ROOT = path.resolve(__dirname, '..');
const RAW_CLIPS_DIR = path.join(PROJECT_ROOT, 'raw_clips');
const BGM_DIR = path.join(PROJECT_ROOT, 'background_music');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');
const REELS_DIR = path.join(PROJECT_ROOT, 'rendered_reels');
const TEMP_DIR = path.join(PROJECT_ROOT, 'temp_build');
const STATE_PATH = path.join(PROJECT_ROOT, 'state.json');
const QUOTES_PATH = path.join(PROJECT_ROOT, 'quotes_108.json');

const BGM_PATH = path.join(BGM_DIR, 'bansuri_bgm.mp3');
const APP_ICON_PATH = path.join(ASSETS_DIR, 'app_icon.png');
const OUTRO_DURATION = 3.2; // seconds

// Ensure runtime directories exist
[RAW_CLIPS_DIR, BGM_DIR, ASSETS_DIR, REELS_DIR, TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Load state or initialize
function loadState() {
  if (fs.existsSync(STATE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    } catch (e) {
      console.warn('⚠️ Could not parse state.json, initializing fresh state.');
    }
  }
  return { currentDay: 1, history: [] };
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

// Probe audio duration via ffprobe
function getMediaDuration(mediaPath) {
  try {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${mediaPath}"`;
    const stdout = execSync(cmd).toString().trim();
    const dur = parseFloat(stdout);
    return isNaN(dur) ? 15.0 : dur;
  } catch (err) {
    console.warn(`⚠️ Could not probe duration for ${mediaPath}, defaulting to 15s.`, err.message);
    return 15.0;
  }
}

// Generate Hindi neural voiceover
async function generateHindiVoice(text, outputPath) {
  const tts = new EdgeTTS();
  const voice = 'hi-IN-MadhurNeural';
  console.log(`  🎙️ Synthesizing sacred Hindi narration (${voice})...`);
  await tts.synthesize(text, voice, {
    outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
  });
  fs.writeFileSync(outputPath, tts.toBuffer());
  const duration = getMediaDuration(outputPath);
  console.log(`  ✅ Voiceover generated: ${duration.toFixed(2)}s`);
  return duration;
}

// Render Quote & Header Overlay via Puppeteer
async function renderQuoteOverlay(dayData, outputPath) {
  console.log('  🎨 Rendering high-res typography overlay via Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Rozha+One&family=Yatra+One&family=Noto+Sans+Devanagari:wght@600;700;800;900&display=swap" rel="stylesheet">
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

      /* Top Sacred Header Pill */
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

      /* Center Floating Sacred Watermark / Mantra Badge */
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

      /* Bottom Wisdom Card */
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

      .quote-mark {
        font-family: 'Rozha One', serif;
        font-size: 90px;
        line-height: 40px;
        color: #F59E0B;
        opacity: 0.8;
        position: absolute;
        top: 25px;
        left: 28px;
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
        font-size: 33px;
        font-weight: 600;
        line-height: 1.5;
        color: #F3F4F6;
        text-shadow: 0 2px 6px rgba(0,0,0,0.9);
      }

      /* Micro banner inside card */
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
        <span style="font-size: 32px;">🚩</span>
        <span class="header-title">108-DAY SACRED JAP CHALLENGE</span>
        <span class="header-tag">${dayData.dayText}</span>
      </div>

      <div class="mantra-badge">
        <span>✨</span>
        <span class="mantra-text">दैनिक नाम साधना: ${dayData.mantra}</span>
      </div>
    </div>

    <div class="bottom-container">
      <div class="wisdom-card">
        <div class="hook-text">${dayData.hook}</div>
        <div class="wisdom-body">${dayData.quoteHindi}</div>
        <div class="card-footer">
          <div class="benefit-chip">✍️ लिखित नाम जप · १० गुना अधिक प्रभाव</div>
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
  console.log(`  ✅ Typography overlay saved to ${outputPath}`);
}

// Render Outro Card via Puppeteer
async function renderOutroCard(outputPath) {
  console.log('  🌟 Rendering high-converting Play Store Outro CTA...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });

  // Read app icon as base64
  let appIconBase64 = '';
  if (fs.existsSync(APP_ICON_PATH)) {
    appIconBase64 = 'data:image/png;base64,' + fs.readFileSync(APP_ICON_PATH).toString('base64');
  }

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800;900&family=Noto+Sans+Devanagari:wght@700;800;900&display=swap" rel="stylesheet">
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

      /* Glowing Aura Background */
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

      /* App Icon with 3D Luxury Frame */
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
      .icon-container img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .app-title-hindi {
        font-size: 78px;
        font-weight: 900;
        color: #FEF08A;
        text-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
        margin-bottom: 6px;
      }
      .app-title-en {
        font-size: 50px;
        font-weight: 900;
        letter-spacing: 4px;
        color: #FFFFFF;
        margin-bottom: 24px;
      }

      .tagline {
        font-size: 34px;
        font-weight: 700;
        color: #FCD34D;
        max-width: 820px;
        line-height: 1.45;
        margin-bottom: 40px;
      }

      /* Trust Badges */
      .badges-row {
        display: flex;
        gap: 20px;
        margin-bottom: 55px;
      }
      .badge {
        background: rgba(255, 255, 255, 0.08);
        border: 1.5px solid rgba(254, 240, 138, 0.3);
        border-radius: 999px;
        padding: 12px 28px;
        font-size: 24px;
        font-weight: 700;
        color: #F3F4F6;
      }

      /* CTA Button */
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
      .cta-headline {
        font-size: 42px;
        font-weight: 900;
        color: #1A0D00;
        letter-spacing: 0.5px;
      }
      .cta-sub {
        font-size: 26px;
        font-weight: 800;
        color: #451A03;
      }

      .bio-pointer {
        font-size: 32px;
        font-weight: 800;
        color: #FDE68A;
        display: flex;
        align-items: center;
        gap: 14px;
      }
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
  console.log(`  ✅ Outro card saved to ${outputPath}`);
}

// Select raw clip from raw_clips/ or generate dynamic backdrop if empty
function resolveRawVideoSource(dayIndex, contentDuration, outPreparedVideo) {
  const allowedExts = ['.mp4', '.mov', '.mkv', '.webm'];
  const availableClips = fs.readdirSync(RAW_CLIPS_DIR)
    .filter(f => allowedExts.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(RAW_CLIPS_DIR, f));

  if (availableClips.length > 0) {
    const selected = availableClips[(dayIndex - 1) % availableClips.length];
    console.log(`  🎬 Using rotating raw recording: ${path.basename(selected)} (Rotation ${dayIndex}/${availableClips.length})`);
    
    // Scale and pad to standard 1080x1920 with subtle darkening so text pops
    const filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=brightness=-0.08:contrast=1.05`;
    const cmd = `ffmpeg -y -stream_loop -1 -i "${selected}" -t ${contentDuration.toFixed(2)} -vf "${filter}" -c:v libx264 -preset fast -crf 20 -an "${outPreparedVideo}"`;
    execSync(cmd, { stdio: 'inherit' });
    return outPreparedVideo;
  }

  // Fallback: Synthesize rich sacred motion parchment backdrop if no user recordings uploaded yet
  console.log(`  ℹ️ No user recordings found in raw_clips/. Synthesizing sacred temple backdrop for Day ${dayIndex}...`);
  const cmd = `ffmpeg -y -f lavfi -i "color=c=0x1A0F05:s=1080x1920:r=30:d=${contentDuration.toFixed(2)}" -vf "drawbox=x=40:y=40:w=1000:h=1840:color=gold@0.2:t=3,format=yuv420p" -c:v libx264 -preset fast -crf 20 "${outPreparedVideo}"`;
  execSync(cmd, { stdio: 'inherit' });
  return outPreparedVideo;
}

// --- Main Reel Production Pipeline ---
async function buildReel(targetDay = null) {
  console.log('\n======================================================');
  console.log('🕉️ LIKHIT JAP - SACRED 108-DAY REEL FACTORY');
  console.log('======================================================');

  const state = loadState();
  const day = targetDay || state.currentDay || 1;

  if (!fs.existsSync(QUOTES_PATH)) {
    throw new Error(`quotes_108.json not found at ${QUOTES_PATH}!`);
  }
  const quotesList = JSON.parse(fs.readFileSync(QUOTES_PATH, 'utf8'));
  const dayData = quotesList.find(q => q.day === day) || quotesList[0];

  console.log(`📅 Building Reel for Day ${dayData.day} / 108:`);
  console.log(`   - Mantra: ${dayData.mantra} (${dayData.mantraEnglish})`);
  console.log(`   - Hook: "${dayData.hook}"`);

  const safePrefix = `Day_${String(day).padStart(3, '0')}`;
  const voicePath = path.join(TEMP_DIR, `${safePrefix}_voice.mp3`);
  const overlayPngPath = path.join(TEMP_DIR, `${safePrefix}_overlay.png`);
  const outroPngPath = path.join(TEMP_DIR, `outro_card.png`);
  const rawVideoCutPath = path.join(TEMP_DIR, `${safePrefix}_raw_cut.mp4`);
  const finalReelPath = path.join(REELS_DIR, `${safePrefix}_LikhitJap_Reel.mp4`);

  // 1. Synthesize Hindi voiceover
  const voiceDuration = await generateHindiVoice(dayData.voiceScript, voicePath);
  const totalDuration = voiceDuration + OUTRO_DURATION;

  // 2. Generate Graphic Overlays
  await renderQuoteOverlay(dayData, overlayPngPath);
  await renderOutroCard(outroPngPath);

  // 3. Prepare Base Video
  resolveRawVideoSource(day, voiceDuration, rawVideoCutPath);

  // 4. Assemble Video with FFmpeg
  console.log(`  🎞️ Assembling Final 1080x1920 Reel (${totalDuration.toFixed(2)}s)...`);

  // Inputs:
  // 0: rawVideoCutPath (voiceDuration)
  // 1: overlayPngPath
  // 2: outroPngPath
  // 3: voicePath
  // 4: BGM_PATH (bansuri_bgm.mp3)
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

  console.log(`\n🎉 SUCCESS! Sacred Challenge Reel Created:`);
  console.log(`   📁 Output: ${finalReelPath}`);
  console.log(`   ⏱️ Duration: ${totalDuration.toFixed(2)}s`);
  console.log(`   📝 Caption Ready in quotes_108.json`);

  // Update State if this was the planned currentDay
  if (!targetDay || targetDay === state.currentDay) {
    state.lastBuiltDay = day;
    state.lastBuiltAt = new Date().toISOString();
    state.lastBuiltVideo = finalReelPath;
    saveState(state);
  }

  return {
    day,
    videoPath: finalReelPath,
    caption: dayData.caption
  };
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  let dayArg = null;
  const dayIdx = args.indexOf('--day');
  if (dayIdx !== -1 && args[dayIdx + 1]) {
    dayArg = parseInt(args[dayIdx + 1], 10);
  }
  buildReel(dayArg).catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
  });
}

module.exports = { buildReel };
