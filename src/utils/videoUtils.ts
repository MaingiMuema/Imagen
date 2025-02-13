import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import axios from "axios";
import sharp from "sharp";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Function to download an image from pollinations.ai with retry logic
export async function generateImage(
  prompt: string,
  index: number,
  outputDir: string,
  retries = 10
): Promise<string> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    `${prompt} ${index}`
  )}?seed=${index}&nologo=true&quality=100&width=1024&height=768`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) {
        // Add exponential backoff between retries
        await delay(Math.min(1000 * Math.pow(2, attempt), 10000));
      }

      const response = await axios({
        method: "get",
        url,
        responseType: "arraybuffer",
        timeout: 60000, // Increased timeout to 60 seconds
        headers: {
          Accept: "image/jpeg",
          "User-Agent": "Mozilla/5.0",
        },
      });

      const buffer = Buffer.from(response.data);

      // Ensure consistent image dimensions
      const processedBuffer = await sharp(buffer)
        .resize(1024, 1024, { fit: "contain", background: "black" })
        .jpeg()
        .toBuffer();

      const filename = path.join(
        outputDir,
        `frame_${String(index).padStart(4, "0")}.jpg`
      );
      await fs.writeFile(filename, processedBuffer);
      return filename;
    } catch (error) {
      if (attempt === retries - 1) {
        console.error(
          `Error generating image ${index} after ${retries} attempts:`,
          error
        );
        throw error;
      }
      console.warn(
        `Attempt ${attempt + 1} failed for image ${index}, retrying...`
      );
    }
  }

  throw new Error(
    `Failed to generate image ${index} after ${retries} attempts`
  );
}

// Function to generate images in batches
export async function generateImagesInBatches(
  prompt: string,
  totalFrames: number,
  outputDir: string,
  batchSize = 10
): Promise<string[]> {
  const results: string[] = [];
  const batches = Math.ceil(totalFrames / batchSize);

  for (let batch = 0; batch < batches; batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, totalFrames);
    const batchPromises = [];

    for (let i = start; i < end; i++) {
      batchPromises.push(generateImage(prompt, i, outputDir));
      // Small delay between starting each request in the batch
      await delay(100);
    }

    const batchResults = await Promise.allSettled(batchPromises);
    const successfulResults = batchResults
      .filter(
        (result): result is PromiseFulfilledResult<string> =>
          result.status === "fulfilled"
      )
      .map((result) => result.value);

    results.push(...successfulResults);

    // Add delay between batches to avoid rate limiting
    if (batch < batches - 1) {
      await delay(2000);
    }
  }

  return results;
}

// Function to create video from images using native FFmpeg
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

  return new Promise((resolve, reject) => {
    const args = [
      "-y", // Overwrite output files
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
      outputPath,
    ];

    const process = spawn("ffmpeg", args);

    const output = {
      stdout: "",
      stderr: "",
    };

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
