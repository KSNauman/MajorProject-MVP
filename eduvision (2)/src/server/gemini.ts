import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please set it under Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

const STORY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    classification: {
      type: Type.STRING,
      description: "Simple, imaginative categorization of what was drawn (e.g., 'Friendly Whale', 'Spaceship Rocket', 'Giant Dino')."
    },
    motionProfile: {
      type: Type.STRING,
      description: "Must be exactly one of: 'swim', 'fly', 'launch', or 'bounce'. Select 'swim' for ocean/water creatures or objects, 'fly' for air/aerial animals, 'launch' for space/rocket/jumping objects, and 'bounce' for land/ground animals, plants, or abstract shapes."
    },
    backgroundTheme: {
      type: Type.STRING,
      description: "Must be exactly one of: 'ocean', 'forest', 'space', 'park'. Select a decorative setting that fits the character's adventure."
    },
    title: {
      type: Type.STRING,
      description: "A fun, magical, age-appropriate title for the children's story."
    },
    chapters: {
      type: Type.ARRAY,
      description: "Exactly 3 story chapters detailing an adventure on the playground stage.",
      items: {
        type: Type.OBJECT,
        properties: {
          chapterNumber: {
            type: Type.INTEGER,
            description: "The 1-based index (e.g. 1, 2, 3)."
          },
          narrativeText: {
            type: Type.STRING,
            description: "2-4 narrative sentences written at a child-friendly level, engaging, full of wonder, and structured nicely for browser Text-to-Speech narration."
          },
          actors: {
            type: Type.ARRAY,
            description: "The list of characters present in this chapter slide. Always include at least 1 'hero' role representing the child's drawing itself. May also include 'companion' or 'helper' characters from classmates' doodles.",
            items: {
              type: Type.OBJECT,
              properties: {
                characterName: {
                  type: Type.STRING,
                  description: "Adorable name for this character role (e.g., 'Barnaby the Bear', 'Fiona the Fish')."
                },
                role: {
                  type: Type.STRING,
                  description: "Must be exactly 'hero', 'companion', or 'helper'. The drawn character is the 'hero'."
                },
                scale: {
                  type: Type.NUMBER,
                  description: "Scale of the character on stage, typically between 0.6 and 1.2."
                },
                position: {
                  type: Type.OBJECT,
                  description: "Absolute percentage position offsets (0 to 100) on the 2D stage viewport container.",
                  properties: {
                    x: { type: Type.INTEGER, description: "Percentage offset from left, from 15 to 85." },
                    y: { type: Type.INTEGER, description: "Percentage offset from top, from 30 to 80." }
                  },
                  required: ["x", "y"]
                }
              },
              required: ["characterName", "role", "scale", "position"]
            }
          },
          checkpoint: {
            type: Type.OBJECT,
            description: "A reading comprehension checkpoint at the end of the chapter.",
            properties: {
              question: {
                type: Type.STRING,
                description: "A simple comprehension question based directly on the chapter's narrative content."
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Exactly 3 distinct answer options."
              },
              correctIndex: {
                type: Type.INTEGER,
                description: "The 0-based index of the correct option (0, 1, or 2)."
              },
              correctOption: {
                type: Type.STRING,
                description: "The exact matching text of the correct option."
              },
              distractorOptions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "The other two wrong options."
              }
            },
            required: ["question", "options", "correctIndex", "correctOption", "distractorOptions"]
          }
        },
        required: ["chapterNumber", "narrativeText", "actors", "checkpoint"]
      }
    }
  },
  required: ["classification", "motionProfile", "backgroundTheme", "title", "chapters"]
};

function detectMimeType(buffer: Buffer): string {
  if (buffer && buffer.length > 4) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return "image/png";
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return "image/jpeg";
    }
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      if (buffer.toString("ascii", 8, 12) === "WEBP") {
        return "image/webp";
      }
    }
  }
  return "image/png"; // default fallback MIME type
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1500
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) {
      throw error;
    }
    const msg = String(error.message || error.status || "").toLowerCase();
    const isTransient =
      msg.includes("503") ||
      msg.includes("429") ||
      msg.includes("unavailable") ||
      msg.includes("high demand") ||
      msg.includes("resourceexhausted") ||
      msg.includes("overloaded") ||
      msg.includes("spikes in demand");

    if (isTransient) {
      console.warn(`[Gemini-Retry] Dynamic transient API issue encountered: "${error.message || error}". Waiting ${delay}ms before retrying (${retries} attempts left)...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function generateStoryFromDrawing(
  imageBuffer: Buffer,
  mimeType: string,
  ageLevel: string
): Promise<{
  classification: string;
  motionProfile: "swim" | "fly" | "launch" | "bounce";
  backgroundTheme: "ocean" | "forest" | "space" | "park";
  title: string;
  chapters: any[];
}> {
  const ai = getGeminiClient();
  const base64Data = imageBuffer.toString("base64");

  // Robustly detect original image byte format in case of background-removal fallback
  const finalMimeType = detectMimeType(imageBuffer) || mimeType || "image/png";
  console.log(`[Gemini-AI] Using verified content MIME type: ${finalMimeType}`);

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: finalMimeType,
    },
  };

  const textPrompt = `
  You are an expert children's storybook author and preschool child education cognitive specialist.
  Analyze this child's hand-drawn cartoon character. What species or object does it resemble?
  Generate an interactive story customized for a child at the following educational age level: "${ageLevel}".
  
  Make the narrative extremely positive, sparking imagination and curiosity. 
  Ensure the options and distractorOptions inside each checkpoint are highly appropriate for the specified age group, testing comprehension of that exact chapter's plot.
  `;

  const doGenerate = async (selectedModel: string) => {
    console.log(`[Gemini-AI] Prompting model: ${selectedModel}`);
    return await ai.models.generateContent({
      model: selectedModel,
      contents: [imagePart, { text: textPrompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: STORY_RESPONSE_SCHEMA,
        systemInstruction: "You specialize in children's education and translating doodles into magical, educational stories with reading comprehension checks.",
      },
    });
  };

  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  let response = null;
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      // 2 retries per model with backoff
      response = await retryWithBackoff(() => doGenerate(modelName), 2, 1000);
      if (response && response.text) {
        break; // Successfully got response
      }
    } catch (err: any) {
      console.warn(`[Gemini-AI] Model '${modelName}' failed: ${err.message || err}. Trying next candidate...`);
      lastError = err;
    }
  }

  if (!response || !response.text) {
    console.error("[Gemini-AI] All available models failed to complete content generation.", lastError);
    throw new Error(`The story generation service is currently experiencing extremely high demand on all backend channels. Please wait a moment and try again. Details: ${lastError ? (lastError.message || lastError) : "No response text received"}`);
  }

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  try {
    const rawData = JSON.parse(text);
    return rawData;
  } catch (err) {
    console.error("Failed to parse Gemini output as JSON:", text, err);
    throw new Error("Could not parse story output. Please try again.");
  }
}
