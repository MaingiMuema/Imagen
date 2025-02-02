import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import ImageForm from "./ImageForm";

export default function App() {
  const mountRef = useRef(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Set up scene
    const scene = new THREE.Scene();

    // Add background gradient
    const gradientTexture = new THREE.CanvasTexture(createGradientCanvas());
    scene.background = gradientTexture;

    // Set up camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    // Set up renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Add cube with texture
    const geometry = new THREE.BoxGeometry();
    const textureLoader = new THREE.TextureLoader();
    const material = new THREE.MeshStandardMaterial({
      map: textureLoader.load("/textures/wood.jpg"),
      roughness: 0.1,
      metalness: 0.5,
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Add floating particles
    const particles = createParticles();
    scene.add(particles);

    // Animation
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Cube animation
      cube.rotation.x = elapsedTime * 0.5;
      cube.rotation.y = elapsedTime * 0.3;
      cube.position.y = Math.sin(elapsedTime) * 0.5;

      // Particles animation
      particles.rotation.x = elapsedTime * 0.1;
      particles.rotation.y = elapsedTime * 0.2;

      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  // Create gradient background
  const createGradientCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(1, "#16213e");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    return canvas;
  };

  // Create floating particles
  const createParticles = () => {
    const particlesCount = 500;
    const positions = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: "#ffffff",
      size: 0.05,
      transparent: true,
      opacity: 0.5,
    });

    return new THREE.Points(geometry, material);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div
        ref={mountRef}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      />

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1000,
          background: "rgba(0, 0, 0, 0.8)",
          padding: "2rem",
          borderRadius: "15px",
          width: "90%",
          maxWidth: "500px",
          backdropFilter: "blur(10px)",
          boxShadow: "0 0 20px rgba(0, 0, 0, 0.5)",
          transition: "all 0.3s ease",
        }}
      >
        <ImageForm
          onGenerate={setGeneratedImage}
          onLoadingStateChange={setIsLoading}
        />
        {generatedImage && (
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              justifyContent: "center",
              opacity: isLoading ? 0.5 : 1,
              transition: "opacity 0.3s ease",
            }}
          >
            <img
              src={generatedImage}
              alt="Generated content"
              style={{
                maxWidth: "100%",
                maxHeight: "300px",
                objectFit: "contain",
                borderRadius: "8px",
                boxShadow: "0 0 10px rgba(0, 0, 0, 0.3)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
