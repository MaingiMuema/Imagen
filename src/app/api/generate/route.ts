import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
  generateImagesInBatches,
  createVideo,
  ensureDirectories,
  cleanup,
} from "@/utils/videoUtils";

export async function POST(req: NextRequest) {
  try {
    const { prompt, duration = 10 } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (duration < 10 || duration > 30) {
      return NextResponse.json(
        { error: "Duration must be between 10 and 30 seconds" },
        { status: 400 }
      );
    }

    // Ensure directories exist
    await ensureDirectories();

    const framesDir = path.join(process.cwd(), "public", "frames");
    const videoDir = path.join(process.cwd(), "public", "videos");

    // Calculate number of frames needed
    const fps = 30;
    const totalFrames = duration * fps;

    try {
      console.log(`Generating ${totalFrames} frames for prompt: "${prompt}"`);

      // Generate frames in batches
      const generatedFrames = await generateImagesInBatches(
        prompt,
        totalFrames,
        framesDir
      );

      // Check if we have enough successful frames (70% success rate)
      if (generatedFrames.length < totalFrames * 0.7) {
        throw new Error(
          `Not enough frames generated. Got ${generatedFrames.length} of ${totalFrames} frames.`
        );
      }

      // Create video
      const videoFileName = `video_${Date.now()}.mp4`;
      const videoPath = path.join(videoDir, videoFileName);
      await createVideo(framesDir, videoPath, fps);

      // Clean up frames
      await cleanup(framesDir);

      return NextResponse.json({
        success: true,
        videoUrl: `/videos/${videoFileName}`,
        framesGenerated: generatedFrames.length,
        totalFrames,
        message:
          generatedFrames.length === totalFrames
            ? "All frames generated successfully"
            : `Generated ${generatedFrames.length} of ${totalFrames} frames successfully`,
      });
    } catch (error) {
      // Clean up frames on error
      await cleanup(framesDir);
      throw error;
    }
  } catch (error) {
    console.error("Error generating video:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred during video generation";

    return NextResponse.json(
      {
        error: errorMessage,
        type: error instanceof Error ? error.constructor.name : "UnknownError",
      },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
    responseLimit: false,
  },
};
