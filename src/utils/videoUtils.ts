import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import axios from "axios";
import sharp from "sharp";
import { promptGenerator } from "./promptGenerator";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Progress update type
export interface GenerationProgress {
  framesGenerated: number;
  totalFrames: number;
  currentFrame: number;
  stage: "generating" | "processing" | "complete";
  currentPrompt?: string;
  storyProgress?: Array<{
    frameNumber: number;
    context: string;
  }>;
}

type ProgressCallback = (progress: GenerationProgress) => Promise<void>;

// Function to check if ffmpeg is available
async function checkFFmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn("ffmpeg", ["-version"]);

    process.on("error", () => {
      resolve(false);
    });

    process.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

// Function to validate frame sequence
async function validateFrameSequence(
  dir: string,
  totalFrames: number
): Promise<boolean> {
  const files = await fs.readdir(dir);
  const frameFiles = files.filter(
    (f) => f.startsWith("frame_") && f.endsWith(".jpg")
  );

  if (frameFiles.length !== totalFrames) {
    console.error(
      `Missing frames: expected ${totalFrames}, got ${frameFiles.length}`
    );
    return false;
  }

  // Check for sequential frame numbers
  for (let i = 0; i < totalFrames; i++) {
    const expectedFile = `frame_${String(i).padStart(4, "0")}.jpg`;
    if (!frameFiles.includes(expectedFile)) {
      console.error(`Missing frame: ${expectedFile}`);
      return false;
    }
  }

  return true;
}

// Function to download an image from pollinations.ai with retry logic
async function generateImage(
  prompt: string,
  index: number,
  outputDir: string,
  retries = 3
): Promise<string> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    `${prompt} ${index}`
  )}?seed=${index}&nologo=true&quality=100&width=1024&height=1024`;

  const filename = path.join(
    outputDir,
    `frame_${String(index).padStart(4, "0")}.jpg`
  );

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) {
        await delay(Math.min(1000 * Math.pow(2, attempt), 10000));
      }

      const response = await axios({
        method: "get",
        url,
        responseType: "arraybuffer",
        timeout: 60000,
        headers: {
          Accept: "image/jpeg",
          "User-Agent": "Mozilla/5.0",
        },
      });

      const buffer = Buffer.from(response.data);

      const processedBuffer = await sharp(buffer)
        .resize(1024, 1024, { fit: "contain", background: "black" })
        .jpeg({ quality: 90 })
        .toBuffer();

      await fs.writeFile(filename, processedBuffer);
      await fs.access(filename);

      return filename;
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed for frame ${index}:`, error);
      if (attempt === retries - 1) throw error;
      await delay(1000 * Math.pow(2, attempt));
    }
  }

  throw new Error(
    `Failed to generate image ${index} after ${retries} attempts`
  );
}

// Function to generate all frames with AI-generated prompts
export async function generateFrames(
  basePrompt: string,
  totalFrames: number,
  outputDir: string,
  onProgress?: ProgressCallback
): Promise<string[]> {
  console.log(`Starting generation of ${totalFrames} frames...`);
  const frames: string[] = new Array(totalFrames);
  const batchSize = 5;
  const batches = Math.ceil(totalFrames / batchSize);
  let successfulFrames = 0;

  // Initialize the story
  await promptGenerator.initializeStory(basePrompt);

  for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, totalFrames);
    const batchPromises: Promise<string>[] = [];

    // Generate prompts and images for each frame in the batch
    for (let i = start; i < end; i++) {
      try {
        const framePrompt = await promptGenerator.generateFramePrompt(
          i + 1,
          totalFrames
        );
        batchPromises.push(generateImage(framePrompt, i, outputDir));

        if (onProgress) {
          await onProgress({
            framesGenerated: successfulFrames,
            totalFrames,
            currentFrame: i + 1,
            stage: "generating",
            currentPrompt: framePrompt,
            storyProgress: promptGenerator.getFrameHistory(),
          });
        }

        await delay(100); // Small delay between frame generations
      } catch (error) {
        console.error(`Failed to generate prompt for frame ${i}:`, error);
      }
    }

    try {
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        const frameIndex = start + index;
        if (result.status === "fulfilled") {
          frames[frameIndex] = result.value;
          successfulFrames++;
        } else {
          console.error(
            `Failed to generate frame ${frameIndex}:`,
            result.reason
          );
        }
      });

      // Add delay between batches
      if (batchIndex < batches - 1) {
        await delay(1000);
      }
    } catch (error) {
      console.error(`Error in batch ${batchIndex}:`, error);
      throw error;
    }
  }

  // Filter out any undefined frames (failed generations)
  const successfulFramesList = frames.filter(Boolean);

  // Validate the frame sequence
  const isValid = await validateFrameSequence(
    outputDir,
    successfulFramesList.length
  );
  if (!isValid) {
    throw new Error("Frame sequence validation failed");
  }

  return successfulFramesList;
}

// Function to create video from images
export async function createVideo(
  imageDir: string,
  outputPath: string,
  fps: number = 30
): Promise<string> {
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) {
    throw new Error(
      "FFmpeg is not installed. Please install FFmpeg to create videos."
    );
  }

  const files = await fs.readdir(imageDir);
  const frameFiles = files
    .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.match(/\d+/)?.[0] || "0");
      return numA - numB;
    });

  if (frameFiles.length === 0) {
    throw new Error("No frames found to create video");
  }

  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-framerate",
      fps.toString(),
      "-pattern_type",
      "sequence",
      "-i",
      path.join(imageDir, "frame_%04d.jpg"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      outputPath,
    ];

    const process = spawn("ffmpeg", args);
    const output = { stdout: "", stderr: "" };

    process.stdout.on("data", (data) => {
      output.stdout += data.toString();
      console.log(`FFmpeg stdout: ${data}`);
    });

    process.stderr.on("data", (data) => {
      output.stderr += data.toString();
      console.error(`FFmpeg stderr: ${data}`);
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        const error = new Error(`FFmpeg process failed (exit code ${code})`);
        error.cause = {
          stdout: output.stdout,
          stderr: output.stderr,
          code,
        };
        reject(error);
      }
    });

    process.on("error", (err) => {
      console.error("FFmpeg process error:", err);
      err.cause = {
        stdout: output.stdout,
        stderr: output.stderr,
      };
      reject(err);
    });
  });
}

// Function to ensure output directories exist
export async function ensureDirectories() {
  const dirs = ["public/frames", "public/videos"];
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// Function to clean up temporary files
export async function cleanup(imageDir: string) {
  try {
    const files = await fs.readdir(imageDir);
    await Promise.all(
      files.map((file) => fs.unlink(path.join(imageDir, file)))
    );
  } catch (error) {
    console.error("Error cleaning up:", error);
  }
}
