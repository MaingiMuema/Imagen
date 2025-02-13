import fs from "fs/promises";
import path from "path";
import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import axios from "axios";
import sharp from "sharp";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to download an image from pollinations.ai with retry logic
export async function generateImage(
  prompt: string,
  index: number,
  outputDir: string,
  retries = 3
): Promise<string> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    `${prompt} ${index}`
  )}?seed=${index}&nologo=true&quality=100&width=1024&height=1024`;

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

// Function to create video from images
export async function createVideo(
  imageDir: string,
  outputPath: string,
  fps: number = 30
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ffmpeg) {
      reject(new Error("FFmpeg not found"));
      return;
    }

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
      outputPath,
    ];

    const process = spawn(ffmpeg, args);

    process.stderr.on("data", (data) => {
      console.error(`FFmpeg stderr: ${data}`);
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });

    process.on("error", (err) => {
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
