import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
  generateFrames,
  createVideo,
  ensureDirectories,
  cleanup,
  GenerationProgress,
} from "@/utils/videoUtils";
import { promptGenerator } from "@/utils/promptGenerator";

interface ProgressUpdate extends GenerationProgress {
  elapsedTime?: number;
  message?: string;
  videoUrl?: string;
  error?: string;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const prompt = searchParams.get("prompt");
  const duration = Number(searchParams.get("duration")) || 10;

  // Validate input
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  // Duration must be between 1 and 300 seconds
  if (duration < 1 || duration > 300) {
    return NextResponse.json(
      { error: "Duration must be between 2 and 300 seconds" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const startTime = Date.now();

        // Send updates function
        const sendUpdate = async (update: Partial<ProgressUpdate>) => {
          const elapsedTime = (Date.now() - startTime) / 1000;
          const storyFrames = promptGenerator.getFrameHistory();

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                ...update,
                elapsedTime,
                storyFrames,
              })}\n\n`
            )
          );
        };

        // Ensure directories exist
        await ensureDirectories();

        const framesDir = path.join(process.cwd(), "public", "frames");
        const videoDir = path.join(process.cwd(), "public", "videos");

        // Calculate number of frames needed
        const fps = 30;
        const totalFrames = Math.round(duration * fps);

        try {
          console.log(
            `Generating ${totalFrames} frames for prompt: "${prompt}"`
          );

          // Initial progress update
          await sendUpdate({
            stage: "generating",
            framesGenerated: 0,
            totalFrames,
            currentFrame: 0,
            message: "Starting frame generation...",
          });

          // Generate all frames with progress updates
          const frames = await generateFrames(
            prompt,
            totalFrames,
            framesDir,
            fps,
            duration,
            async (progress: GenerationProgress) => {
              await sendUpdate({
                ...progress,
                message: `Generating frame ${progress.currentFrame} of ${progress.totalFrames}`,
              });
            }
          );

          if (frames.length < totalFrames * 0.9) {
            throw new Error(
              `Not enough frames generated. Got ${frames.length} of ${totalFrames} frames.`
            );
          }

          // Update progress for video processing
          await sendUpdate({
            stage: "processing",
            framesGenerated: frames.length,
            totalFrames,
            currentFrame: frames.length,
            message: "Creating video from frames...",
          });

          // Create video
          const videoFileName = `video_${Date.now()}.mp4`;
          const videoPath = path.join(videoDir, videoFileName);
          await createVideo(framesDir, videoPath, fps);

          // Clean up frames
          await cleanup(framesDir);

          // Send final success response
          await sendUpdate({
            stage: "complete",
            framesGenerated: frames.length,
            totalFrames,
            currentFrame: frames.length,
            videoUrl: `/videos/${videoFileName}`,
            message:
              frames.length === totalFrames
                ? "All frames generated successfully"
                : `Generated ${frames.length} of ${totalFrames} frames successfully`,
          });

          // Clear prompt generator memory
          promptGenerator.clearMemory();
        } catch (error) {
          // Clean up frames on error
          await cleanup(framesDir);
          promptGenerator.clearMemory();
          throw error;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error: errorMessage,
              stage: "generating",
              message: errorMessage,
              storyFrames: [],
            })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
    responseLimit: false,
  },
};
