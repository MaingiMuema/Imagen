"use client";

import { useState } from "react";

interface Progress {
  framesGenerated?: number;
  totalFrames?: number;
  currentFrame?: number;
  elapsedTime?: number;
  message?: string;
  stage: "generating" | "processing" | "complete";
  error?: string;
  videoUrl?: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(10);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState<{ message: string; details?: string }>({
    message: "",
  });
  const [progress, setProgress] = useState<Progress>({
    stage: "generating",
  });

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Estimate completion time based on current progress
  const getEstimatedTimeRemaining = (
    current: number,
    total: number,
    elapsed: number
  ): string => {
    if (current === 0) return "Calculating...";
    const rate = elapsed / current; // seconds per frame
    const remaining = (total - current) * rate;
    return formatTime(remaining);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError({ message: "" });
    setVideoUrl("");
    setProgress({ stage: "generating" });

    try {
      const eventSource = new EventSource(
        "/api/generate?" +
          new URLSearchParams({
            prompt,
            duration: duration.toString(),
          })
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Progress;

          if (data.error) {
            throw new Error(data.error);
          }

          setProgress(data);

          if (data.stage === "complete" && data.videoUrl) {
            setVideoUrl(data.videoUrl);
            eventSource.close();
            setLoading(false);
          }
        } catch (e) {
          console.error("Failed to parse progress data:", e);
          eventSource.close();
          setError({ message: "Failed to parse server response" });
          setLoading(false);
        }
      };

      eventSource.onerror = (err) => {
        console.error("EventSource error:", err);
        eventSource.close();
        setError({ message: "Connection error occurred" });
        setLoading(false);
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError({
        message,
        details:
          err instanceof Error && err.cause ? String(err.cause) : undefined,
      });
      setProgress({ stage: "generating" });
      setLoading(false);
    }
  };

  const getProgressMessage = () => {
    const {
      stage,
      framesGenerated = 0,
      totalFrames = 0,
      currentFrame = 0,
      elapsedTime = 0,
    } = progress;

    let message = "";

    if (stage === "generating") {
      const percent = Math.round((currentFrame / totalFrames) * 100);
      message = `Generating frames: ${currentFrame}/${totalFrames} (${percent}%)`;

      if (elapsedTime > 0 && currentFrame > 0) {
        const remaining = getEstimatedTimeRemaining(
          currentFrame,
          totalFrames,
          elapsedTime
        );
        message += `\nEstimated time remaining: ${remaining}`;
      }
    } else if (stage === "processing") {
      message = "Processing video...";
    } else if (stage === "complete") {
      message = `Generated ${framesGenerated} frames successfully`;
    }

    if (elapsedTime) {
      message += `\nElapsed time: ${formatTime(elapsedTime)}`;
    }

    return message;
  };

  const getProgressPercent = () => {
    const { stage, currentFrame = 0, totalFrames = 0 } = progress;

    if (stage === "generating" && totalFrames > 0) {
      return (currentFrame / totalFrames) * 100;
    }

    if (stage === "processing") {
      return 95;
    }

    if (stage === "complete") {
      return 100;
    }

    return 0;
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-center text-gray-900">
          AI Video Generator
        </h1>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="prompt"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Enter your prompt
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Describe what you want to generate..."
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Be specific and descriptive for better results
              </p>
            </div>

            <div>
              <label
                htmlFor="duration"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Duration (seconds)
              </label>
              <input
                type="number"
                id="duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={2}
                max={300}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Min: 2 seconds, Max: 300 seconds (30 frames per second)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full p-3 rounded-md text-white font-medium transition-colors ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              {loading ? "Generating..." : "Generate Video"}
            </button>
          </form>

          {loading && (
            <div className="mt-4 p-4 bg-blue-50 rounded-md">
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium text-blue-700">
                  <span>
                    {progress.stage === "processing"
                      ? "Processing video..."
                      : "Generating frames..."}
                  </span>
                  {progress.elapsedTime !== undefined && (
                    <span>Elapsed: {formatTime(progress.elapsedTime)}</span>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${getProgressPercent()}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-blue-700 whitespace-pre-line">
                  {getProgressMessage()}
                </p>
              </div>
            </div>
          )}
        </div>

        {error.message && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 font-medium">{error.message}</p>
            {error.details && (
              <p className="mt-2 text-sm text-red-600">{error.details}</p>
            )}
          </div>
        )}

        {videoUrl && (
          <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Generated Video
            </h2>
            <video
              controls
              className="w-full rounded-md shadow"
              src={videoUrl}
            />
            <a
              href={videoUrl}
              download
              className="block w-full p-3 text-center bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors font-medium"
            >
              Download Video
            </a>
            {progress.stage === "complete" && progress.message && (
              <p className="text-sm text-gray-600 text-center">
                {progress.message}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
