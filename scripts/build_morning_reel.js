/**
 * 🌅 LIKHIT JAP - MORNING REEL ENGINE (v3.0 Master Production)
 * ------------------------------------------------------------
 * 1. 0.0s - 1.5s: 'Day X of Naam Jap' elegant minimalist opener
 * 2. Fullscreen Hero Clip (raw_clips/hero_clips/)
 * 3. Circular PIP Screen (raw_clips/pip_clips/) in Top Corner:
 *    - Alternating daily: Odd Days -> Top-Right, Even Days -> Top-Left
 *    - If PIP < Hero: Loops up to the same length as main clip
 *    - If PIP > Hero: Ending screen continues showing with PIP speech until PIP ends
 * 4. Ending Screen (raw_clips/ending_clips/)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const puppeteer = require(path.join(PROJECT_ROOT, 'node_modules', 'puppeteer'));

const RAW_CLIPS_DIR = path.join(PROJECT_ROOT, 'raw_clips');
const HERO_DIR = path.join(RAW_CLIPS_DIR, 'hero_clips');
const PIP_DIR = path.join(RAW_CLIPS_DIR, 'pip_clips');
const ENDING_DIR = path.join(RAW_CLIPS_DIR, 'ending_clips');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');
const REELS_DIR = path.join(PROJECT_ROOT, 'rendered_reels');
const TEMP_DIR = path.join(PROJECT_ROOT, 'temp_build');
const STATE_PATH = path.join(PROJECT_ROOT, 'state.json');

// Ensure directories exist
[HERO_DIR, PIP_DIR, ENDING_DIR, ASSETS_DIR, REELS_DIR, TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function loadState() {
  if (fs.existsSync(STATE_PATH)) {
    try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (e) {}
  }
  return { currentDay: 1, currentFeatureIndex: 1, history: [] };
}

function getMediaDuration(mediaPath) {
  try {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${mediaPath}"`;
    const dur = parseFloat(execSync(cmd).toString().trim());
    return isNaN(dur) ? 15.0 : dur;
  } catch (err) {
    return 15.0;
  }
}

// Generate the 1.5s Opening Title Card ('Day X of Naam Jap')
async function generateOpeningCard(day, outputPath) {
  console.log(`  🎨 Rendering 1.5s Opening Card: 'Day ${day} of Naam Jap'...`);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&display=swap" rel="stylesheet">
      </head>
      <body style="margin:0; padding:0; background:transparent; overflow:hidden;">
        <div style="
          position: absolute;
          top: 360px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(14, 14, 20, 0.90);
          border: 3.5px solid #ffd700;
          border-radius: 60px;
          padding: 22px 58px;
          color: #ffd700;
          font-family: Outfit, -apple-system, sans-serif;
          font-size: 54px;
          font-weight: 800;
          letter-spacing: 1.5px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.85);
          backdrop-filter: blur(12px);
          white-space: nowrap;
        ">
          Day ${day} of Naam Jap ✨
        </div>
      </body>
    </html>
  `);
  await page.screenshot({ path: outputPath, omitBackground: true });
  await browser.close();
}

async function buildMorningReel(targetDay = null) {
  const state = loadState();
  const day = targetDay || state.currentDay || 1;

  console.log('\n======================================================');
  console.log(`🌅 LIKHIT JAP - BUILDING MORNING REEL [DAY ${day}]`);
  console.log('======================================================');

  // 1. Gather Clips
  const heroFiles = fs.readdirSync(HERO_DIR).filter(f => f.toLowerCase().endsWith('.mp4'));
  const pipFiles = fs.readdirSync(PIP_DIR).filter(f => f.toLowerCase().endsWith('.mp4'));
  const endingFiles = fs.readdirSync(ENDING_DIR).filter(f => f.toLowerCase().match(/\.(mp4|jpg|jpeg|png)$/));

  if (heroFiles.length === 0) throw new Error(`No hero clips found in ${HERO_DIR}`);
  if (pipFiles.length === 0) throw new Error(`No pip clips found in ${PIP_DIR}`);
  if (endingFiles.length === 0) throw new Error(`No ending clips found in ${ENDING_DIR}`);

  // Modulo rotation
  const heroFile = heroFiles[(day - 1) % heroFiles.length];
  const pipFile = pipFiles[(day - 1) % pipFiles.length];
  
  // Prefer background image or ending clip for ending screen
  const endingImg = endingFiles.find(f => f.toLowerCase().match(/\.(jpg|jpeg|png)$/));
  const endingVid = endingFiles.find(f => f.toLowerCase().endsWith('.mp4'));
  const endingFile = endingImg || endingVid || endingFiles[0];

  const heroPath = path.join(HERO_DIR, heroFile);
  const pipPath = path.join(PIP_DIR, pipFile);
  const endingPath = path.join(ENDING_DIR, endingFile);

  console.log(`  🎬 Hero Clip:     ${heroFile}`);
  console.log(`  🟣 Circular PIP:   ${pipFile}`);
  console.log(`  🏁 Ending Screen:  ${endingFile}`);

  const heroDur = getMediaDuration(heroPath);
  const pipDur = getMediaDuration(pipPath);

  console.log(`  ⏱️ Durations: Hero=${heroDur.toFixed(1)}s | PIP=${pipDur.toFixed(1)}s`);

  // 2. Corner Positioning (Alternating daily)
  // Odd days -> Top-Right | Even days -> Top-Left
  const isTopRight = (day % 2 !== 0);
  const pipX = isTopRight ? 670 : 50;
  const pipY = 120;
  const borderX = pipX - 4;
  const borderY = pipY - 4;
  console.log(`  📍 PIP Position: ${isTopRight ? 'TOP-RIGHT' : 'TOP-LEFT'} (x=${pipX}, y=${pipY})`);

  // 3. Generate Day Title Card (0.0s - 1.5s)
  const titleCardPng = path.join(TEMP_DIR, `day_${day}_title_card.png`);
  await generateOpeningCard(day, titleCardPng);

  // Masks
  const circleMaskPath = path.join(ASSETS_DIR, 'circle_mask.png');
  const circleBorderPath = path.join(ASSETS_DIR, 'circle_border.png');

  // Output paths
  const finalReelName = `Day_${String(day).padStart(3, '0')}_LikhitJap_Reel.mp4`;
  const finalReelPath = path.join(REELS_DIR, finalReelName);
  const tempHeroPipPath = path.join(TEMP_DIR, `temp_hero_pip_${day}.mp4`);
  const tempEndingPath = path.join(TEMP_DIR, `temp_ending_${day}.mp4`);

  // -------------------------------------------------------------
  // DURATION RULE IMPLEMENTATION:
  // - If pipDur < heroDur: Loop PIP up to hero length
  // - If pipDur > heroDur: Hero plays heroDur, then ending screen
  //   keeps showing with PIP speech wrap-up until PIP video ends
  // -------------------------------------------------------------
  console.log('  ⚙️ Rendering Part 1 (Hero + Circular PIP)...');

  let pipLoopOption = '';
  if (pipDur < heroDur) {
    console.log('  🔁 PIP is shorter than Hero: Looping PIP to match full main clip duration.');
    pipLoopOption = '-stream_loop -1';
  }

  const part1Filter = [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[hero_bg]`,
    `[1:v]scale=360:360:force_original_aspect_ratio=increase,crop=360:360,format=yuva420p[pip_scaled]`,
    `[2:v]scale=360:360[mask_scaled]`,
    `[pip_scaled][mask_scaled]alphamerge[pip_circle]`,
    `[hero_bg][pip_circle]overlay=${pipX}:${pipY}:shortest=0[with_pip]`,
    `[3:v]scale=368:368[border_scaled]`,
    `[with_pip][border_scaled]overlay=${borderX}:${borderY}[with_border]`,
    `[4:v]fade=t=in:st=0:d=0.2:alpha=1,fade=t=out:st=1.3:d=0.2:alpha=1[card_faded]`,
    `[with_border][card_faded]overlay=0:0:enable='between(t,0,1.5)'[v_out]`,
    `[0:a]volume=0.25[a_hero]`,
    `[1:a]volume=1.0[a_pip]`,
    `[a_hero][a_pip]amix=inputs=2:duration=first:dropout_transition=2[a_out]`
  ].join(';');

  const cmdPart1 = `ffmpeg -y -i "${heroPath}" ${pipLoopOption} -i "${pipPath}" -i "${circleMaskPath}" -i "${circleBorderPath}" -i "${titleCardPng}" -filter_complex "${part1Filter}" -map "[v_out]" -map "[a_out]" -t ${heroDur} -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k "${tempHeroPipPath}"`;
  execSync(cmdPart1, { stdio: 'ignore' });
  console.log('  ✅ Part 1 rendered successfully.');

  // Part 2: Ending Screen
  const isImageEnding = !endingFile.toLowerCase().endsWith('.mp4');

  if (pipDur > heroDur) {
    const remDur = pipDur - heroDur;
    console.log(`  🔊 PIP is longer than Hero by ${remDur.toFixed(1)}s: Keeping ending screen active with PIP completion...`);

    const part2Filter = [
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[end_bg]`,
      `[1:v]scale=360:360:force_original_aspect_ratio=increase,crop=360:360,format=yuva420p[pip_scaled]`,
      `[2:v]scale=360:360[mask_scaled]`,
      `[pip_scaled][mask_scaled]alphamerge[pip_circle]`,
      `[end_bg][pip_circle]overlay=${pipX}:${pipY}[with_pip]`,
      `[3:v]scale=368:368[border_scaled]`,
      `[with_pip][border_scaled]overlay=${borderX}:${borderY}[v_out]`,
      `[1:a]volume=1.0[a_out]`
    ].join(';');

    const endInputFlag = isImageEnding ? `-loop 1 -t ${remDur}` : '';
    const cmdPart2 = `ffmpeg -y ${endInputFlag} -i "${endingPath}" -ss ${heroDur} -t ${remDur} -i "${pipPath}" -i "${circleMaskPath}" -i "${circleBorderPath}" -filter_complex "${part2Filter}" -map "[v_out]" -map "[a_out]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k "${tempEndingPath}"`;
    execSync(cmdPart2, { stdio: 'ignore' });
    console.log('  ✅ Part 2 (Ending screen with PIP completion) rendered.');
  } else {
    const outroDur = 4.5;
    console.log(`  🏁 Rendering clean ${outroDur}s ending outro...`);
    const endInputFlag = isImageEnding ? `-loop 1 -t ${outroDur}` : `-t ${outroDur}`;
    const cmdPart2 = `ffmpeg -y ${endInputFlag} -i "${endingPath}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -t ${outroDur} -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k "${tempEndingPath}"`;
    execSync(cmdPart2, { stdio: 'ignore' });
    console.log('  ✅ Part 2 rendered.');
  }

  // Step C: Concat
  console.log('  🔗 Concatenating into final masterpiece...');
  const concatList = path.join(TEMP_DIR, `concat_${day}.txt`);
  fs.writeFileSync(concatList, `file '${tempHeroPipPath.replace(/\\/g, '/')}'\nfile '${tempEndingPath.replace(/\\/g, '/')}'`, 'utf8');

  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${finalReelPath}"`, { stdio: 'ignore' });

  // Cleanup temp files
  try {
    [titleCardPng, tempHeroPipPath, tempEndingPath, concatList].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  } catch (e) {}

  const finalSize = fs.statSync(finalReelPath).size;
  const finalDur = getMediaDuration(finalReelPath);
  console.log('\n======================================================');
  console.log(`🎉 MORNING REEL READY: ${finalReelName}`);
  console.log(`📁 File Path: ${finalReelPath}`);
  console.log(`⏱️ Duration:  ${finalDur.toFixed(1)}s | Size: ${(finalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log('======================================================\n');

  return { success: true, reelPath: finalReelPath, day };
}

if (require.main === module) {
  const targetDay = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  buildMorningReel(targetDay).catch(err => {
    console.error('Fatal Build Error:', err);
    process.exit(1);
  });
}

module.exports = { buildMorningReel };
