"use client";

import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(10);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState<{ message: string; details?: string }>({
    message: "",
  });
  const [progress, setProgress] = useState<{
    framesGenerated?: number;
    totalFrames?: number;
    message?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError({ message: "" });
    setVideoUrl("");
    setProgress({});

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, duration }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate video");
      }

      setVideoUrl(data.videoUrl);
      setProgress({
        framesGenerated: data.framesGenerated,
        totalFrames: data.totalFrames,
        message: data.message,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError({
        message,
        details:
          err instanceof Error && err.cause ? String(err.cause) : undefined,
      });
    } finally {
      setLoading(false);
    }
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
                min={10}
                max={30}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Min: 10 seconds, Max: 30 seconds (Longer durations may take more
                time)
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
              {loading ? "Generating Video..." : "Generate Video"}
            </button>
          </form>

          {loading && (
            <div className="mt-4 p-4 bg-blue-50 rounded-md">
              <p className="text-blue-700">
                Generating video in batches... This may take several minutes.
              </p>
              {progress.totalFrames && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          ((progress.framesGenerated || 0) /
                            progress.totalFrames) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Generated {progress.framesGenerated} of{" "}
                    {progress.totalFrames} frames
                    {progress.message && (
                      <span className="block mt-1 text-blue-600">
                        {progress.message}
                      </span>
                    )}
                  </p>
                </div>
              )}
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
            {progress.message && (
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
