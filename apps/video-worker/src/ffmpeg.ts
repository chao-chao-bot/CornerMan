import { spawn } from "node:child_process";
import ffmpeg from "fluent-ffmpeg";

export interface ProbeResult {
  durationMs: number;
  width: number;
  height: number;
}

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg 退出码 ${code}：${stderr.slice(-500)}`));
    });
  });
}

export function probe(inputPath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return reject(err);
      const stream = data.streams.find((s) => s.codec_type === "video");
      const durationSec = Number(
        data.format?.duration ?? stream?.duration ?? 0
      );
      resolve({
        durationMs: Math.round(durationSec * 1000),
        width: stream?.width ?? 0,
        height: stream?.height ?? 0
      });
    });
  });
}

/** 转码为指定高度的 mp4（宽度按比例，保证偶数） */
export function transcode(
  inputPath: string,
  outputPath: string,
  height: number
): Promise<void> {
  return run([
    "-i",
    inputPath,
    "-vf",
    `scale=-2:${height}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "26",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath
  ]);
}

/** 截取首帧封面 */
export function poster(inputPath: string, outputPath: string): Promise<void> {
  return run([
    "-i",
    inputPath,
    "-vf",
    "thumbnail",
    "-frames:v",
    "1",
    outputPath
  ]);
}

/** 每秒抽 1 帧到 outputDir/0001.jpg... */
export function extractFrames(
  inputPath: string,
  outputPattern: string
): Promise<void> {
  return run(["-i", inputPath, "-vf", "fps=1", "-q:v", "3", outputPattern]);
}

/**
 * 场景切点检测：返回场景突变发生的时间（秒）。
 * 用 showinfo + select=gt(scene,threshold)，解析 stderr 的 pts_time。
 */
export function detectSceneCuts(
  inputPath: string,
  threshold = 0.3
): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "ffmpeg",
      [
        "-i",
        inputPath,
        "-filter:v",
        `select='gt(scene,${threshold})',showinfo`,
        "-f",
        "null",
        "-"
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", () => {
      const times: number[] = [];
      const re = /pts_time:([0-9.]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(stderr)) !== null) {
        times.push(Number(m[1]));
      }
      resolve(times);
    });
  });
}
