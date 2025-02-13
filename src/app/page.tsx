/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { StoryFrame } from "@/utils/promptGenerator";

interface Progress {
  framesGenerated?: number;
  totalFrames?: number;
  currentFrame?: number;
  elapsedTime?: number;
  message?: string;
  stage: "generating" | "processing" | "complete";
  error?: string;
  videoUrl?: string;
  currentPrompt?: string;
  storyFrames?: StoryFrame[];
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

  const getProgressInfo = () => {
    if (!progress.totalFrames) return { percent: 0, text: "Initializing..." };

    const current = progress.currentFrame || 0;
    const total = progress.totalFrames;
    const percent = Math.round((current / total) * 100);

    if (progress.stage === "processing") {
      return { percent: 95, text: "Processing video..." };
    }

    if (progress.stage === "complete") {
      return { percent: 100, text: "Generation complete!" };
    }

    return {
      percent,
      text: `Frame ${current}/${total}`,
    };
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

  return (
    <main className="min-h-screen p-4 md:p-8 page-transition-enter-active">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2 animate-float">
          <h1 className="text-5xl font-bold gradient-text">Imagen</h1>
          <p className="text-gray-400">
            Transform your stories into cinematic experiences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-xl hover-lift">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    htmlFor="prompt"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Your Story Concept
                  </label>
                  <div className="gradient-border">
                    <textarea
                      id="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full p-3 rounded-lg bg-black/30 text-white placeholder-gray-500 focus:outline-none"
                      rows={4}
                      placeholder="Describe your story in vivid detail..."
                      required
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-400">
                    Be descriptive - let AI bring your vision to life
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="duration"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Duration
                  </label>
                  <div className="gradient-border">
                    <input
                      type="number"
                      id="duration"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      min={2}
                      max={300}
                      className="w-full p-3 rounded-lg bg-black/30 text-white focus:outline-none"
                      required
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-400">
                    2-300 seconds • 30 frames per second
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full p-4 rounded-lg font-medium transition-all duration-300 btn-glow ${
                    loading
                      ? "bg-gray-700 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                  }`}
                >
                  {loading ? (
                    <span className="animate-pulse-slow">Generating...</span>
                  ) : (
                    "Generate Video"
                  )}
                </button>
              </form>
            </div>

            {loading && (
              <div className="glass-panel p-6 rounded-xl space-y-4 hover-lift">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-blue-400">
                    {getProgressInfo().text}
                  </span>
                  {progress.elapsedTime !== undefined && (
                    <span className="text-purple-400">
                      {formatTime(progress.elapsedTime)}
                    </span>
                  )}
                </div>
                <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 progress-animation"
                    style={{
                      width: `${getProgressInfo().percent}%`,
                    }}
                  />
                </div>
                {progress.currentPrompt && (
                  <div className="bg-black/20 p-4 rounded-lg border border-gray-700">
                    <p className="text-sm text-gray-300 loading-shimmer">
                      {progress.currentPrompt}
                    </p>
                  </div>
                )}
              </div>
            )}
            {videoUrl && (
              <div className="glass-panel p-6 rounded-xl space-y-4 hover-lift">
                <h2 className="text-xl font-semibold gradient-text">
                  Generated Video
                </h2>
                <video
                  controls
                  className="w-full rounded-lg shadow-2xl"
                  src={videoUrl}
                />
                <a
                  href={videoUrl}
                  download
                  className="block w-full p-4 text-center rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all duration-300 font-medium btn-glow"
                >
                  Download Video
                </a>
              </div>
            )}

            {error.message && (
              <div className="glass-panel p-6 rounded-xl border border-red-500/50 hover-lift">
                <p className="text-red-400 font-medium">{error.message}</p>
                {error.details && (
                  <p className="mt-2 text-sm text-red-300/70">
                    {error.details}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-xl hover-lift">
              <h2 className="text-xl font-semibold gradient-text">
                Story Progress
              </h2>
              {progress.storyFrames && progress.storyFrames.length > 0 && (
                <div className="space-y-4 max-h-[400px] overflow-y-auto story-scroll pr-2 mt-4">
                  {progress.storyFrames.map((frame, index) => (
                    <div
                      key={frame.frameNumber}
                      className={`frame-card glass-panel p-4 rounded-lg border border-gray-700/50 ${
                        frame.frameNumber === progress.currentFrame
                          ? "loading-shimmer border-blue-500/50"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-400">
                          Frame {frame.frameNumber}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(index / 30)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {frame.prompt}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
