import { useState } from "react";
import axios from "axios";

const ImageForm = ({ onGenerate }) => {
  const [prompt, setPrompt] = useState("");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);

  const generateImage = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.get(
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
        {
          params: {
            width,
            height,
            nologo: true,
            quality: 100,
          },
          responseType: "blob",
        }
      );

      const imageUrl = URL.createObjectURL(response.data);
      setGeneratedImage(imageUrl);
      onGenerate(imageUrl);
    } catch (error) {
      console.error("Error generating image:", error);
      alert("Error generating image. Please try again.");
    }
    setLoading(false);
  };

  return (
    <form
      onSubmit={generateImage}
      style={{
        color: "white",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div>
        <label>Image Prompt:</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ width: "100%", padding: "0.5rem", color: "black" }}
          required
        />
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <div>
          <label>Width:</label>
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            style={{ width: "100px", padding: "0.5rem", color: "black" }}
          />
        </div>

        <div>
          <label>Height:</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            style={{ width: "100px", padding: "0.5rem", color: "black" }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "0.5rem 1rem",
          background: loading ? "gray" : "#4CAF50",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Generating..." : "Create Image"}
      </button>

      {generatedImage && (
        <div style={{ marginTop: "1rem" }}>
          <img
            src={generatedImage}
            alt="Generated content"
            style={{ maxWidth: "200px", marginTop: "1rem" }}
          />
        </div>
      )}
    </form>
  );
};

export default ImageForm;
