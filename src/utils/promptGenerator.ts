import Together from "together-ai";

export interface StoryFrame {
  frameNumber: number;
  prompt: string;
  context: string;
}

export class PromptGenerator {
  private together: Together;
  private memory: StoryFrame[] = [];
  private baseContext: string = "";
  private initialized: boolean = false;
  private fps: number = 30;
  private duration: number = 0;
  private frameTimeMs: number = 0;

  constructor() {
    this.together = new Together({
      apiKey:
        "e2a90d8189c5ba3818cbb80124a00341c01179a3f895739ee5220c35fbca5196",
      maxRetries: 3,
    });
  }

  private async generateSystemPrompt(
    userPrompt: string,
    totalFrames: number
  ): Promise<string> {
    const previousContext = this.memory
      .slice(-3) // Get last 3 frames for context
      .map((frame) => `Frame ${frame.frameNumber}: ${frame.context}`)
      .join("\n");

    const currentTimeMs = (this.memory.length + 1) * this.frameTimeMs;
    const totalTimeMs = totalFrames * this.frameTimeMs;
    const currentTimeSec = (currentTimeMs / 1000).toFixed(2);
    const totalTimeSec = (totalTimeMs / 1000).toFixed(2);

    return `You are a creative visual storyteller. Create a detailed scene description for frame ${
      this.memory.length + 1
    } of ${totalFrames} (at ${currentTimeSec}s of ${totalTimeSec}s, ${
      this.fps
    }fps)
        based on this story concept: "${userPrompt}".
        
        Temporal Context:
        - Each frame represents ${(this.frameTimeMs / 1000).toFixed(3)} seconds
        - Frame transition should be smooth and match the timing
        - Consider the frame rate (${
          this.fps
        }fps) when describing motion and changes
        
        Previous frames context:
        ${previousContext}

        Generate a coherent next scene that progresses the story naturally, considering:
        
        Visual Elements and VFX:
        - Scene composition with dynamic camera work (dolly, pan, tracking shots)
        - Character actions with dramatic expressions and motion trails
        - Advanced lighting (volumetric rays, lens flares, dynamic shadows)
        - Atmospheric effects (mist, particles, energy fields)
        - Cinematic color grading and mood enhancement
        - VFX elements (glowing auras, particle systems, magical effects)
        - Environmental effects (rain, snow, fog, dust storms)
        - Motion blur and speed lines for dynamic action
        - Reflective and refractive surfaces with distortion
        
        Temporal Guidelines and VFX Timing:
        - Ensure movement and changes are physically possible within ${(
          this.frameTimeMs / 1000
        ).toFixed(3)} seconds
        - Maintain consistent motion across frames
        - Scale action intensity to match the frame timing
        
        Response format: Provide only the scene description, no explanations or additional text.
        Keep the description concise but vivid (50-100 words).`;
  }

  public async initializeStory(
    basePrompt: string,
    fps: number = 30,
    duration: number = 0
  ): Promise<void> {
    this.baseContext = basePrompt;
    this.memory = [];
    this.fps = fps;
    this.duration = duration;
    this.frameTimeMs =
      duration > 0 ? (duration * 1000) / (fps * duration) : 1000 / fps;
    this.initialized = true;
    console.log(
      `Story initialized with prompt: ${basePrompt}, FPS: ${fps}, Duration: ${duration}s`
    );
  }

  public async generateFramePrompt(
    frameNumber: number,
    totalFrames: number
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error("Story not initialized. Call initializeStory first.");
    }

    try {
      const systemPrompt = await this.generateSystemPrompt(
        this.baseContext,
        totalFrames
      );

      const messages = [
        { role: "system" as const, content: systemPrompt },
        {
          role: "user" as const,
          content: `Generate detailed visual description for frame ${frameNumber}/${totalFrames}`,
        },
      ];

      let framePrompt = "";

      // Create completion with streaming
      const stream = await this.together.chat.completions.create({
        messages,
        model: "deepseek-ai/DeepSeek-V3",
        max_tokens: 200,
        temperature: 0.7,
        top_p: 0.7,
        top_k: 50,
        repetition_penalty: 1,
        stop: ["<｜end▁of▁sentence｜>"],
        stream: true,
      });

      try {
        // Handle streaming response
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) framePrompt += content;
        }
      } catch (error) {
        console.error("Error processing stream:", error);
        throw error;
      }

      // Store in memory if we got a valid response
      if (framePrompt.trim()) {
        const newFrame: StoryFrame = {
          frameNumber,
          prompt: framePrompt,
          context: framePrompt.substring(0, 150) + "...", // Store abbreviated version for context
        };

        this.memory.push(newFrame);
        console.log(
          `Added frame ${frameNumber} to story memory. Total frames: ${this.memory.length}`
        );
      } else {
        throw new Error("Empty response from AI");
      }

      return framePrompt;
    } catch (error) {
      console.error("Error generating frame prompt:", error);
      // Fallback to base prompt if AI generation fails
      const fallbackPrompt = `${this.baseContext} - Scene ${frameNumber}`;

      // Still store the fallback in memory
      this.memory.push({
        frameNumber,
        prompt: fallbackPrompt,
        context: `Fallback scene ${frameNumber}`,
      });

      return fallbackPrompt;
    }
  }

  public getFrameHistory(): StoryFrame[] {
    return [...this.memory];
  }

  public getCurrentContext(): string {
    return this.memory.length > 0
      ? this.memory[this.memory.length - 1].prompt
      : this.baseContext;
  }

  public clearMemory(): void {
    this.memory = [];
    this.baseContext = "";
    this.initialized = false;
    console.log("Story memory cleared");
  }
}

// Create a singleton instance
export const promptGenerator = new PromptGenerator();
