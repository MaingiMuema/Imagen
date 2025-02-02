import React, { useState } from "react";

export default function ImageForm({ onGenerate, onLoadingStateChange }) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("realistic");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    try {
      setIsLoading(true);
      onLoadingStateChange(true);

      const response = await fetch(
        "https://image.pollinations.ai/prompt/" +
          encodeURIComponent(`${prompt} ${style}`)
      );
      const imageUrl = response.url;

      onGenerate(imageUrl);
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      setIsLoading(false);
      onLoadingStateChange(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={{ position: "relative" }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          style={{
            width: "100%",
            minHeight: "100px",
            padding: "1rem",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(0, 0, 0, 0.5)",
            color: "#ffffff",
            resize: "vertical",
            fontFamily: "inherit",
            fontSize: "1rem",
          }}
          disabled={isLoading}
        />
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
            }}
          >
            <div className="spinner" />
          </div>
        )}
      </div>

      <select
        value={style}
        onChange={(e) => setStyle(e.target.value)}
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          background: "rgba(0, 0, 0, 0.5)",
          color: "#ffffff",
          cursor: "pointer",
        }}
        disabled={isLoading}
      >
        <option value="realistic">Realistic</option>
        <option value="cartoon">Cartoon</option>
        <option value="abstract">Abstract</option>
        <option value="fantasy">Fantasy</option>
      </select>

      <button
        type="submit"
        style={{
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          border: "none",
          background: "linear-gradient(45deg, #ff7eb3, #ff758c)",
          color: "#ffffff",
          fontWeight: "bold",
          cursor: "pointer",
          transition: "transform 0.2s ease",
          opacity: isLoading ? 0.7 : 1,
          pointerEvents: isLoading ? "none" : "auto",
        }}
        disabled={isLoading}
      >
        {isLoading ? "Generating..." : "Generate Image"}
      </button>
    </form>
  );
}
