import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const runFfmpeg = (ffmpegPath, args) =>
  new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });

let ffmpegPathCache = null;
let ffmpegChecked = false;

const resolveFfmpegPath = async () => {
  if (ffmpegChecked) return ffmpegPathCache;
  ffmpegChecked = true;
  try {
    await runFfmpeg('ffmpeg', ['-version']);
    ffmpegPathCache = 'ffmpeg';
  } catch {
    ffmpegPathCache = null;
  }
  return ffmpegPathCache;
};

/**
 * Remux MP4 with moov atom at start (faststart) and extract a poster frame.
 * Falls back to the original file when ffmpeg is unavailable.
 */
export const optimizeBrandMp4 = async (inputPath) => {
  const ffmpeg = await resolveFfmpegPath();
  if (!ffmpeg || !fs.existsSync(inputPath)) {
    return { videoPath: inputPath, posterPath: null, optimized: false };
  }

  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const tempPath = path.join(dir, `${base}-faststart.mp4`);
  const posterPath = path.join(dir, `${base}-poster.jpg`);

  try {
    await runFfmpeg(ffmpeg, [
      '-i',
      inputPath,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      '-y',
      tempPath,
    ]);

    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(inputPath);
      fs.renameSync(tempPath, inputPath);
    }

    try {
      await runFfmpeg(ffmpeg, [
        '-i',
        inputPath,
        '-vframes',
        '1',
        '-q:v',
        '2',
        '-y',
        posterPath,
      ]);
    } catch {
      if (fs.existsSync(posterPath)) fs.unlinkSync(posterPath);
    }

    return {
      videoPath: inputPath,
      posterPath: fs.existsSync(posterPath) ? posterPath : null,
      optimized: true,
    };
  } catch (err) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    console.warn('Brand MP4 optimization skipped:', err.message);
    return { videoPath: inputPath, posterPath: null, optimized: false };
  }
};
