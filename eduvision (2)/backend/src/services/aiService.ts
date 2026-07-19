import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";
import { Drawing } from "../models/drawing.js";
import { StoryModel } from "../models/story.js";

// Lazy initialize the Gemini Client
let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in database environment secrets.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// Define the response validation schema according to Phase 3 requirements
const STORY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    classification: {
      type: Type.STRING,
      enum: ["fish", "bird", "helicopter", "rocket", "generic_bouncing"],
      description: "Simple classification of what was drawn.",
    },
    motionProfile: {
      type: Type.STRING,
      enum: ["swim", "fly", "hover", "launch", "bounce"],
      description: "The 2D transition profile mapping.",
    },
    backgroundTheme: {
      type: Type.STRING,
      enum: ["ocean", "forest", "space", "park"],
      description: "Decorative backdrop setting environment.",
    },
    title: {
      type: Type.STRING,
      description: "An engaging title for this children's illustrated story.",
    },
    motionPrompt: {
      type: Type.STRING,
      description: "A highly visual, energetic motion prompt (max 1000 chars) describing playful cartoon actions of the main character.",
    },
    chapters: {
      type: Type.ARRAY,
      description: "Exactly 3 distinct chronological chapters representing an interactive learning journey.",
      items: {
        type: Type.OBJECT,
        properties: {
          chapterNumber: {
            type: Type.INTEGER,
            description: "Step index starting from 1 (1, 2, 3).",
          },
          narrativeText: {
            type: Type.STRING,
            description: "2-4 narrative sentences written for children ages 3-8.",
          },
          actors: {
            type: Type.ARRAY,
            description: "The characters on stage. Always include the 'hero' (the main drawing), and optionally companions or helpers.",
            items: {
              type: Type.OBJECT,
              properties: {
                characterName: { type: Type.STRING, description: "Name of the actor character." },
                role: { type: Type.STRING, enum: ["hero", "companion", "helper"], description: "Role of the character on the page." },
                scale: { type: Type.NUMBER, description: "Scale of the character on stage (e.g. 0.6 to 1.2)." },
                position: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.INTEGER, description: "Horizontal percent offset (15-85)." },
                    y: { type: Type.INTEGER, description: "Vertical percent offset (30-80)." }
                  },
                  required: ["x", "y"]
                },
                motionPrompt: { type: Type.STRING, description: "Action motion prompt for this specific character in this chapter." }
              },
              required: ["characterName", "role", "scale", "position"]
            }
          },
          checkpoint: {
            type: Type.OBJECT,
            description: "Reading comprehension check.",
            properties: {
              question: {
                type: Type.STRING,
                description: "Comprehension question directly based on chapter narrative.",
              },
              correctOption: {
                type: Type.STRING,
                description: "The correct answer option.",
              },
              distractorOptions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Exactly 2 wrong but plausible answer options for children.",
              },
            },
            required: ["question", "correctOption", "distractorOptions"],
          },
        },
        required: ["chapterNumber", "narrativeText", "actors", "checkpoint"],
      },
    },
  },
  required: ["classification", "motionProfile", "backgroundTheme", "title", "motionPrompt", "chapters"],
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
      console.warn(`[Gemini-Retry-Backend] Transient API issue: "${error.message || error}". Retrying in ${delay}ms (${retries} attempts left)...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function generateStoryFromDrawing(drawingId: string, companionDrawingIds: string[] = []) {
  // 1. Fetch Drawing Document
  const drawingDoc = await Drawing.findById(drawingId);
  if (!drawingDoc) {
    throw new Error(`Drawing record with ID ${drawingId} not found.`);
  }

  // Fetch companion drawings if present
  const companionsDocs: any[] = [];
  if (Array.isArray(companionDrawingIds) && companionDrawingIds.length > 0) {
    for (const compId of companionDrawingIds) {
      try {
        const compDoc = await Drawing.findById(compId);
        if (compDoc) {
          companionsDocs.push(compDoc);
        }
      } catch (err) {
        console.warn(`[Companion-Load] Failed to load companion drawing ${compId}:`, err);
      }
    }
  }

  // 2. Convert primary image file to base64
  const processedRelativePath = drawingDoc.processedUrl.replace(/^\//, "");
  const absoluteImagePath = path.join(process.cwd(), processedRelativePath);

  if (!fs.existsSync(absoluteImagePath)) {
    throw new Error(`Processed PNG image asset is missing at expected path: ${absoluteImagePath}`);
  }

  const imageBuffer = fs.readFileSync(absoluteImagePath);
  const base64Image = imageBuffer.toString("base64");
  const finalMimeType = detectMimeType(imageBuffer);

  // 3. Prepare multimodal contents
  const contents: any[] = [];
  contents.push({
    inlineData: {
      data: base64Image,
      mimeType: finalMimeType,
    },
  });

  // Convert companions to base64 inputs for Gemini Flash
  companionsDocs.forEach((compDoc) => {
    try {
      const compRelativePath = compDoc.processedUrl.replace(/^\//, "");
      const compAbsolutePath = path.join(process.cwd(), compRelativePath);
      if (fs.existsSync(compAbsolutePath)) {
        const compBuffer = fs.readFileSync(compAbsolutePath);
        const compBase64 = compBuffer.toString("base64");
        const compMime = detectMimeType(compBuffer);
        contents.push({
          inlineData: {
            data: compBase64,
            mimeType: compMime,
          },
        });
      }
    } catch (err) {
      console.warn(`[Companion-Encode] Failed to encode companion ${compDoc._id}:`, err);
    }
  });

  // Construct structured text prompt for multimodal Gemini analysis
  let promptText = `Generate a creative children's book story based on these uploaded transparent sketches.
The first image is the main hero character. `;
  if (companionsDocs.length > 0) {
    promptText += `The following images are classmate companion characters. Include them in the story and map them inside the 'actors' array of each chapter. Their drawingIds sequentially match these values: ${companionsDocs.map((c, i) => `Image ${i+2} is drawingId: ${c._id}`).join(", ")}. `;
  }
  promptText += `Choose backgroundTheme (ocean, forest, space, or park) that best fits the setting.
Instruct Gemini to generate a highly visual, energetic motion prompt (maximum 1000 characters) for each character in the scene, and especially a root level 'motionPrompt' for the main hero. The prompt must describe playful cartoon actions (e.g., "A hand-drawn girl with pigtails in a blue shirt wiggles her hands in a happy, springy wave with floating cartoon bubbles").`;

  contents.push({ text: promptText });

  const ai = getGeminiClient();

  const systemInstruction = `
  You are an expert children's book author and early-childhood cognitive specialist.
  Analyze the provided transparent character sketches. The first image is the main drawing ('hero'). Additional images are classmate companions ('companion' or 'helper').
  Classify what the main drawing represents and select the most appropriate motion profile.
  Compose an exciting, highly educational 3-chapter narrative in simple English. Each chapter must feature the 'hero' and any 'companion'/'helper' characters in the scenic 'actors' array.
  
  Conceive highly visual, energetic, whimsical motion prompts (maximum 1000 characters per character) describing playful cartoon actions (e.g., "A hand-drawn girl with pigtails in a blue shirt wiggles her hands in a happy, springy wave with floating cartoon bubbles"). Fill the actor's 'motionPrompt' or the story-level 'motionPrompt' with this.
  Each chapter must conclude with a multiple-choice reading comprehension check containing 1 correct Option and exactly 2 distractor Options.
  `;

  console.log(`[Gemini-AI] Requesting story compilation for Drawing ID: ${drawingId} with ${companionsDocs.length} classmate companions.`);

  const doGenerate = async (selectedModel: string) => {
    return await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: STORY_RESPONSE_SCHEMA,
        systemInstruction,
      },
    });
  };

  // 4. Request Structured JSON from Gemini Flash model with dynamic backoffs + fallbacks
  let response;
  try {
    response = await retryWithBackoff(() => doGenerate("gemini-3.5-flash"), 3, 1500);
  } catch (err: any) {
    console.warn(`[Gemini-AI-Backend] 'gemini-3.5-flash' failed, trying 'gemini-flash-latest'... Error:`, err.message);
    try {
      response = await retryWithBackoff(() => doGenerate("gemini-flash-latest"), 2, 1000);
    } catch (fallbackErr: any) {
      console.error("[Gemini-AI-Backend] Primary and fallback models failed:", fallbackErr);
      throw new Error(`The story generation service is currently experiencing high demand. Details: ${fallbackErr.message || fallbackErr}`);
    }
  }

  const rawJsonText = response.text;
  if (!rawJsonText) {
    throw new Error("Gemini AI service returned an empty output.");
  }

  let parsedRaw;
  try {
    parsedRaw = JSON.parse(rawJsonText);
  } catch (err) {
    console.error("Failed to parse Gemini storytelling JSON output:", rawJsonText);
    throw new Error("LLM output is not proper JSON.");
  }

  // 5. Update MongoDB Drawing document properties
  drawingDoc.classification = parsedRaw.classification || "generic_bouncing";
  drawingDoc.motionProfile = parsedRaw.motionProfile || "bounce";
  await drawingDoc.save();

  console.log(`[Database] Updated Drawing classification: ${drawingDoc.classification}, motionProfile: ${drawingDoc.motionProfile}`);

  // 6. Create Story record inside MongoDB
  const storyDoc = new StoryModel({
    drawingId: drawingDoc._id,
    title: parsedRaw.title,
    languageLevel: "Pre-K (Ages 3-8)",
    backgroundTheme: parsedRaw.backgroundTheme || "ocean",
    motionPrompt: parsedRaw.motionPrompt,
    chapters: parsedRaw.chapters.map((ch: any) => ({
      chapterNumber: ch.chapterNumber,
      narrativeText: ch.narrativeText,
      actors: (ch.actors || []).map((actor: any) => {
        let matchedDrawingId = drawingDoc._id;
        if (actor.role === "companion" || actor.role === "helper") {
          const match = companionsDocs.find(c => 
            (c.classification || "").toLowerCase() === (actor.characterName || "").toLowerCase()
          ) || companionsDocs[0] || drawingDoc;
          matchedDrawingId = match._id;
        }
        return {
          drawingId: matchedDrawingId,
          characterName: actor.characterName || "Character",
          role: actor.role || "companion",
          scale: actor.scale || 1.0,
          position: {
            x: actor.position?.x ?? 50,
            y: actor.position?.y ?? 60,
          },
          motionPrompt: actor.motionPrompt || "",
        };
      }),
      checkpoint: {
        question: ch.checkpoint.question,
        correctOption: ch.checkpoint.correctOption,
        distractorOptions: ch.checkpoint.distractorOptions,
      },
    })),
    reviewStatus: "pending",
  });

  await storyDoc.save();
  console.log(`[Database] Created Story Record successfully! Story ID: ${storyDoc._id}`);

  // 7. Trigger the Asynchronous deAPI Animation Job (Task B)
  const deapiApiKey = process.env.DEAPI_API_KEY;
  const deapiApiUrl = process.env.DEAPI_API_URL || "https://api.deapi.com/v1/animations";
  const backendPublicUrl = process.env.BACKEND_PUBLIC_URL || "https://example.com";
  const webhookSecret = process.env.DEAPI_WEBHOOK_SECRET || "default_super_secret_webhook_key_32_chars_long!!";

  if (deapiApiKey) {
    const cleanProcessedUrl = drawingDoc.processedUrl.startsWith('/') ? drawingDoc.processedUrl : `/${drawingDoc.processedUrl}`;
    const publicImageUrl = `${backendPublicUrl}${cleanProcessedUrl}`;
    const webhookUrl = `${backendPublicUrl}/api/v1/webhooks/deapi`;

    const payload = {
      prompt: parsedRaw.motionPrompt || `A happy jumping animation of a ${parsedRaw.classification || 'character'}`,
      image: publicImageUrl,
      model: "ltx-video",
      webhook_url: webhookUrl,
      webhook_secret: webhookSecret,
      track_id: storyDoc._id.toString(),
    };

    console.log(`[deAPI-Dispatch] Triggering animation job for Story ID: ${storyDoc._id}`);
    console.log(`[deAPI-Dispatch] URL: ${deapiApiUrl}, Webhook: ${webhookUrl}`);

    try {
      const deapiResponse = await fetch(deapiApiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${deapiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!deapiResponse.ok) {
        const textErr = await deapiResponse.text();
        console.error(`[deAPI-Dispatch] deAPI returned status ${deapiResponse.status}: ${textErr}`);
      } else {
        const responseData = await deapiResponse.json();
        console.log(`[deAPI-Dispatch] deAPI job dispatched successfully. Response:`, responseData);
      }
    } catch (err: any) {
      console.error(`[deAPI-Dispatch] Error sending POST to deAPI:`, err.message || err);
    }
  } else {
    console.warn(`[deAPI-Dispatch] DEAPI_API_KEY is missing. Skipping asynchronous animation job dispatch for story ${storyDoc._id}.`);
  }

  return {
    drawing: drawingDoc,
    story: storyDoc,
  };
}

export async function sendDrawingToDeApi(imageBuffer: Buffer, motionPrompt: string, storyId: string) {
  const deapiApiKey = process.env.DEAPI_API_KEY;
  if (!deapiApiKey) {
    throw new Error("DEAPI_API_KEY is not defined");
  }

  const backendPublicUrl = process.env.BACKEND_PUBLIC_URL || "https://example.com";
  
  const form = new FormData();
  form.append("first_frame_image", new Blob([imageBuffer], { type: "image/png" }), "first_frame_image.png");
  form.append("prompt", motionPrompt.substring(0, 1000));
  form.append("model", "Ltxv_13B_0_9_8_Distilled_FP8");
  form.append("width", "512");
  form.append("height", "512");
  form.append("steps", "1");
  form.append("frames", "30");
  form.append("guidance", "7.5");
  form.append("seed", "42");
  form.append("fps", "30");
  form.append("webhook_url", `${backendPublicUrl}/api/v1/webhooks/deapi`);
  form.append("negative_prompt", "blur, low quality, static, deformed, extra limbs");

  console.log(`[deAPI-FreeTier] Dispatching distilled LTX model request for Story: ${storyId}`);

  try {
    const res = await fetch("https://api.deapi.ai/api/v2/videos/animations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${deapiApiKey}`,
        "Accept": "application/json"
      },
      body: form
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[deAPI-Error] HTTP ${res.status}: ${text}`);
      throw new Error(`deAPI returned status ${res.status}`);
    }

    const data = await res.json() as any;
    console.log(`[deAPI-Success] request_id tracking initialized:`, data);
    
    // Save to MongoDB story document
    if (data?.data?.request_id) {
      const { StoryModel } = await import("../models/story.js");
      await StoryModel.findByIdAndUpdate(storyId, {
        "deapiRequestId": data.data.request_id
      });
      console.log(`[deAPI] Saved tracking request_id ${data.data.request_id} to story ${storyId}`);
    }

    return data;
  } catch (error) {
    console.error("[deAPI] Failure sending payload:", error);
    throw error;
  }
}
