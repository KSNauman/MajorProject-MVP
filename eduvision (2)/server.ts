import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { dbService } from "./src/server/db.js";
import { generateStoryFromDrawing } from "./src/server/gemini.js";

// Load environment variables
dotenv.config();

// Ensure uploads directories exist
const originalsDir = path.join(process.cwd(), "data", "uploads", "originals");
const processedDir = path.join(process.cwd(), "data", "uploads", "processed");
fs.mkdirSync(originalsDir, { recursive: true });
fs.mkdirSync(processedDir, { recursive: true });

// Configure Multer for original image savings
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, originalsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parsers

  // Mount Webhook endpoint BEFORE general parsed JSON mapping
  app.post("/api/v1/webhooks/deapi", express.raw({ type: "application/json" }), async (req, res) => {
    const signatureHeader = req.headers["x-deapi-signature"];
    const timestampHeader = req.headers["x-deapi-timestamp"];

    if (!signatureHeader || !timestampHeader) {
      console.error("[Webhook-ServerTS] Missing cryptographic signatures.");
      return res.status(401).json({ error: "Unauthorized: Missing Signature/Timestamp headers" });
    }

    const timestamp = parseInt(String(timestampHeader), 10);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (isNaN(timestamp) || Math.abs(nowSeconds - timestamp) > 300) {
      console.error(`[Webhook-ServerTS] Rejecting timestamp drift. Current: ${nowSeconds}, Header: ${timestamp}`);
      return res.status(401).json({ error: "Unauthorized: Timestamp drift exceeded" });
    }

    const rawBodyString = req.body instanceof Buffer 
      ? req.body.toString("utf8") 
      : (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

    const secret = process.env.DEAPI_WEBHOOK_SECRET || "default_super_secret_webhook_key_32_chars_long!!";

    const stringToSign = `${timestampHeader}.${rawBodyString}`;
    const computedSignature = crypto.createHmac("sha256", secret).update(stringToSign).digest("hex");

    try {
      const bufferComputed = Buffer.from(computedSignature, "hex");
      const bufferHeader = Buffer.from(String(signatureHeader), "hex");

      if (bufferComputed.length !== bufferHeader.length || !crypto.timingSafeEqual(bufferComputed, bufferHeader)) {
        console.error("[Webhook-ServerTS] Verification failed: computed signature does not match.");
        return res.status(401).json({ error: "Unauthorized: Signature mismatch" });
      }
    } catch (err: any) {
      console.error("[Webhook-ServerTS] Error in timing-safe verify:", err.message);
      return res.status(401).json({ error: "Unauthorized: Signature verify failure" });
    }

    res.status(200).json({ success: true, message: "Webhook processed." });

    // Update Story record in db.json asynchronously
    try {
      const payload = JSON.parse(rawBodyString);
      console.log("[Webhook-ServerTS] Received webhook payload:", JSON.stringify(payload));
      
      let storyId = payload.track_id || payload.data?.track_id;
      let story = null;
      
      if (storyId) {
        story = await dbService.findStoryById(storyId);
      }
      
      if (!story) {
        const requestId = payload.request_id || payload.id || payload.data?.request_id || payload.data?.id;
        if (requestId) {
          console.log(`[Webhook-ServerTS] Attempting lookup by deapiRequestId: ${requestId}`);
          const stories = await dbService.findStories();
          story = stories.find(s => s.deapiRequestId === requestId) || null;
          if (story) {
            storyId = story._id;
            console.log(`[Webhook-ServerTS] Found matching story by deapiRequestId: ${storyId}`);
          }
        }
      }

      if (!story || !storyId) {
        console.warn("[Webhook-ServerTS] Could not correlate webhook to any Story in database.");
        return;
      }

      const isCompleted = 
        payload.event === "job.completed" || 
        payload.event === "video.completed" || 
        payload.status === "completed" || 
        payload.status === "success" ||
        payload.state === "completed";

      const isFailed = 
        payload.event === "job.failed" || 
        payload.event === "video.failed" || 
        payload.status === "failed" || 
        payload.status === "error" ||
        payload.state === "failed";

      if (isCompleted) {
        const resultUrl = payload.data?.result_url || payload.data?.video_url || payload.result_url || payload.video_url || payload.url;
        if (resultUrl) {
          await dbService.updateStory(storyId, {
            videoUrl: resultUrl,
            reviewStatus: "approved"
          });
          console.log(`[Webhook-ServerTS] Completed story ${storyId} with Video URL: ${resultUrl}`);
        } else {
          console.error("[Webhook-ServerTS] Webhook reported success but no visual resultUrl found in payload.");
        }
      } else if (isFailed) {
        await dbService.updateStory(storyId, {
          videoUrl: "",
          reviewStatus: "approved"
        });
        console.warn(`[Webhook-ServerTS] Job failed for story ${storyId}. Setting empty videoUrl fallback.`);
      }
    } catch (err: any) {
      console.error("[Webhook-ServerTS] Error in processing body async:", err.message);
    }
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Static Assets mapping for drawings
  app.use("/uploads", express.static(path.join(process.cwd(), "data", "uploads")));

  // API v1: Health Check
  app.get("/api/v1/health", (req, res) => {
    res.json({ success: true, status: "ok", time: new Date() });
  });

  // API v1: Get all drawings
  app.get("/api/v1/drawings", async (req, res) => {
    try {
      const drawings = await dbService.findDrawings();
      res.json({ success: true, drawings });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API v1: Get drawings gallery (schoolmates/companion pool)
  app.get("/api/v1/drawings/gallery", async (req, res) => {
    try {
      const drawings = await dbService.findDrawings();
      // Returns mapped collection profiles with _id, processedUrl, and classification
      const gallery = drawings.map((d: any) => ({
        _id: d._id,
        processedUrl: d.processedUrl,
        classification: d.classification || "Classmate Character",
      }));
      res.json({ success: true, drawings: gallery });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API v1: Get all stories
  app.get("/api/v1/stories", async (req, res) => {
    try {
      const stories = await dbService.findStories();
      res.json({ success: true, stories });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API v1: Get pending stories
  app.get("/api/v1/stories/pending", async (req, res) => {
    try {
      const stories = await dbService.findStories();
      const pending = stories.filter((s) => s.reviewStatus === "pending");
      res.json({ success: true, stories: pending });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API v1: Update a story (Moderate reviews, teacher notes, title, etc)
  app.put("/api/v1/stories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updated = await dbService.updateStory(id, updates);
      if (!updated) {
        return res.status(404).json({ success: false, error: "Story not found." });
      }
      res.json({ success: true, story: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API v1: PATCH update story status
  app.patch("/api/v1/stories/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { reviewStatus, teacherNotes } = req.body;
      
      if (!reviewStatus || !["pending", "approved", "rejected"].includes(reviewStatus)) {
        return res.status(400).json({ success: false, error: "Missing or invalid reviewStatus." });
      }

      const updates: any = { reviewStatus };
      if (typeof teacherNotes === "string") {
        updates.teacherNotes = teacherNotes;
      }

      const updated = await dbService.updateStory(id, updates);
      if (!updated) {
        return res.status(404).json({ success: false, error: "Story not found." });
      }
      res.json({ success: true, story: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API v1: Delete a story
  app.delete("/api/v1/stories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await dbService.deleteStory(id);
      res.json({ success, message: success ? "Story deleted successfully." : "Story not found." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API v1: Delete a drawing (and cascading stories)
  app.delete("/api/v1/drawings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const drawing = await dbService.findDrawingById(id);
      if (drawing) {
        // Optionially delete files
        try {
          const origPath = path.join(process.cwd(), "data", drawing.originalUrl);
          const procPath = path.join(process.cwd(), "data", drawing.processedUrl);
          if (fs.existsSync(origPath)) fs.unlinkSync(origPath);
          if (fs.existsSync(procPath)) fs.unlinkSync(procPath);
        } catch (_) {}
      }
      const success = await dbService.deleteDrawing(id);
      res.json({ success, message: success ? "Drawing and stories deleted." : "Drawing not found." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API v1: Drawing Intake Route (with @imgly/background-removal-node processor)
  app.post("/api/v1/drawings/upload", upload.single("file"), async (req: any, res: any) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image file provided." });
    }

    const originalFilename = req.file.filename;
    const originalUrl = `/uploads/originals/${originalFilename}`;
    const processedFilename = `${path.parse(originalFilename).name}.png`;
    const processedUrl = `/uploads/processed/${processedFilename}`;

    const inputPath = req.file.path;
    const outputPath = path.join(processedDir, processedFilename);

    console.log(`Starting background removal for drawing: ${originalFilename}`);

    try {
      // Lazy-import @imgly/background-removal-node to isolate load problems
      const imgly = await import("@imgly/background-removal-node");
      const imageBuffer = fs.readFileSync(inputPath);
      
      const removedBgBlob = await imgly.removeBackground(imageBuffer, {
        output: {
          format: "image/png",
          quality: 0.85
        }
      });
      
      const arrayBuffer = await removedBgBlob.arrayBuffer();
      fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
      console.log("Background removed successfully via @imgly");
    } catch (error: any) {
      console.warn("WASM or @imgly background removal failed, falling back to original upload for client-side processing", error.message);
      // Fallback: copy original image to the processed path and let client-side magic canvas eraser fix it!
      fs.copyFileSync(inputPath, outputPath);
    }

    try {
      // Save entry to local file DB
      const drawingRecord = await dbService.createDrawing({
        filename: processedFilename,
        originalUrl,
        processedUrl,
        classification: "Unknown Character",
        motionProfile: "bounce",
      });

      return res.status(201).json({
        success: true,
        drawingId: drawingRecord._id,
        originalUrl: drawingRecord.originalUrl,
        processedUrl: drawingRecord.processedUrl,
      });
    } catch (dbErr: any) {
      console.error("Database save failed for uploaded drawing", dbErr);
      return res.status(500).json({ success: false, error: dbErr.message });
    }
  });

  // API v1: Client-Side Upload Custom Segmented PNG (Magic Canvas Eraser uploads directly)
  app.post("/api/v1/drawings/save-segmented", async (req, res) => {
    try {
      const { drawingId, imageBase64 } = req.body;
      if (!drawingId || !imageBase64) {
        return res.status(400).json({ success: false, error: "Missing drawingId or imageBase64." });
      }

      const drawing = await dbService.findDrawingById(drawingId);
      if (!drawing) {
        return res.status(404).json({ success: false, error: "Drawing entry not found." });
      }

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const outputPath = path.join(processedDir, drawing.filename);
      
      fs.writeFileSync(outputPath, buffer);
      console.log(`Saved customer-edited segmented canvas for drawing ID: ${drawingId}`);

      res.json({ success: true, processedUrl: drawing.processedUrl });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Helper function to trigger deAPI asynchronous animation jobs
  async function triggerDeapiAnimation(drawing: any, story: any, customPrompt?: string, req?: any) {
    const deapiApiKey = process.env.DEAPI_API_KEY;
    const deapiApiUrl = "https://api.deapi.ai/api/v2/videos/animations";

    // Detect backing public URL automatically
    let backendPublicUrl = process.env.BACKEND_PUBLIC_URL || "https://ais-dev-ln4b6mpxmrnbv3r3jo2adw-934605127843.asia-east1.run.app";
    if (!backendPublicUrl && req) {
      const host = req.get("host") || "localhost:3000";
      const protocol = (host.includes(".run.app") || host.includes(".asia-east1") || req.secure) ? "https" : "http";
      backendPublicUrl = `${protocol}://${host}`;
    }

    const webhookUrl = `${backendPublicUrl}/api/v1/webhooks/deapi`;

    if (!deapiApiKey) {
      console.warn("[deAPI-Dispatch] DEAPI_API_KEY is missing. Skipping dispatch.");
      return {
        success: false,
        error: "DEAPI_API_KEY is missing from environment. Please add it in Settings > Secrets.",
        config: {
          apiUrl: deapiApiUrl,
          webhookUrl,
          hasApiKey: false,
        }
      };
    }

    const promptToUse = customPrompt || story.motionPrompt || `A cute character of a ${drawing.classification || "creature"} bouncing and dancing happily, 2d cartoon animation`;

    const procPath = path.join(processedDir, drawing.filename);
    let imageBuffer: Buffer;
    try {
      imageBuffer = fs.readFileSync(procPath);
    } catch (err) {
      return {
        success: false,
        error: "Processed image file not found on disk.",
        config: { apiUrl: deapiApiUrl, webhookUrl, hasApiKey: true }
      };
    }

    const form = new FormData();
    form.append("first_frame_image", new Blob([imageBuffer], { type: "image/png" }), "first_frame_image.png");
    form.append("prompt", promptToUse.substring(0, 1000));
    form.append("model", "Ltxv_13B_0_9_8_Distilled_FP8");
    form.append("width", "512");
    form.append("height", "512");
    form.append("steps", "1");
    form.append("frames", "30");
    form.append("guidance", "7.5");
    form.append("seed", "42");
    form.append("fps", "30");
    form.append("webhook_url", webhookUrl);
    form.append("negative_prompt", "blur, low quality, static, deformed, extra limbs");

    const payload = {
      prompt: promptToUse,
      model: "Ltxv_13B_0_9_8_Distilled_FP8",
      webhook_url: webhookUrl
    };

    console.log(`[deAPI-Dispatch] Dispatching job for Story: ${story._id}`);
    console.log(`[deAPI-Dispatch] deAPI URL: ${deapiApiUrl}`);
    console.log(`[deAPI-Dispatch] Webhook URL: ${webhookUrl}`);

    try {
      const deapiResponse = await fetch(deapiApiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${deapiApiKey}`,
          "Accept": "application/json"
        },
        body: form as any,
      });

      if (!deapiResponse.ok) {
        const textErr = await deapiResponse.text();
        console.error(`[deAPI-Dispatch] Fail (${deapiResponse.status}): ${textErr}`);
        return {
          success: false,
          error: `deAPI returned status ${deapiResponse.status}`,
          details: textErr,
          config: {
            apiUrl: deapiApiUrl,
            webhookUrl,
            hasApiKey: true,
            payload
          }
        };
      } else {
        const responseData = await deapiResponse.json();
        console.log(`[deAPI-Dispatch] Dispatched successfully!`, responseData);
        // Save requestId to db
        if (responseData?.data?.request_id) {
          await dbService.updateStory(story._id, {
            deapiRequestId: responseData.data.request_id
          });
          console.log(`[deAPI] Saved tracking request_id ${responseData.data.request_id} to story ${story._id}`);
        }
        return {
          success: true,
          data: responseData,
          config: {
            apiUrl: deapiApiUrl,
            webhookUrl,
            hasApiKey: true,
            payload
          }
        };
      }
    } catch (err: any) {
      console.error(`[deAPI-Dispatch] Network error:`, err.message || err);
      return {
        success: false,
        error: `Network error: ${err.message || err}`,
        config: {
          apiUrl: deapiApiUrl,
          webhookUrl,
          hasApiKey: true,
          payload
        }
      };
    }
  }

  // API v1: Get story by ID (for progress polling in test lab or main app)
  app.get("/api/v1/stories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const story = await dbService.findStoryById(id);
      if (!story) {
        return res.status(404).json({ success: false, error: "Story not found." });
      }
      res.json({ success: true, story });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API v1: Story Generation Request Route (Gemini Multimodal)
  app.post("/api/v1/stories/generate", async (req: any, res: any) => {
    try {
      const { drawingId, languageLevel } = req.body;
      if (!drawingId) {
        return res.status(400).json({ success: false, error: "Missing drawingId." });
      }

      const ageGroup = languageLevel || "Kindergarten (Ages 5-6)";

      // Retrieve drawing metadata
      const drawing = await dbService.findDrawingById(drawingId);
      if (!drawing) {
        return res.status(404).json({ success: false, error: "Drawing asset not found." });
      }

      // Check if a story already exists for this drawing and age group
      const existingStories = await dbService.findStories();
      const duplicateStory = existingStories.find(
        (s) => s.drawingId === drawingId && s.languageLevel === ageGroup
      );

      if (duplicateStory) {
        console.log(`Returning existing story for drawing ${drawingId}`);
        return res.json({
          success: true,
          storyId: duplicateStory._id,
          title: duplicateStory.title,
          classification: drawing.classification,
          motionProfile: drawing.motionProfile,
          processedUrl: drawing.processedUrl,
          chapters: duplicateStory.chapters,
          reviewStatus: duplicateStory.reviewStatus,
          teacherNotes: duplicateStory.teacherNotes,
          videoUrl: duplicateStory.videoUrl || "",
        });
      }

      // Read transparent processed PNG image file to pass to Gemini
      const procPath = path.join(processedDir, drawing.filename);
      if (!fs.existsSync(procPath)) {
        return res.status(404).json({ success: false, error: "Processed drawing file not found on disk." });
      }

      const imageBuffer = fs.readFileSync(procPath);

      console.log(`Requesting Gemini analysis and educational story for Drawing ID ${drawingId} (${ageGroup})`);
      const { classification, motionProfile, backgroundTheme, title, chapters } = await generateStoryFromDrawing(
        imageBuffer,
        "image/png",
        ageGroup
      );

      // Save classification and motion profile to drawing metadata
      drawing.classification = classification;
      drawing.motionProfile = ["swim", "fly", "launch", "bounce"].includes(motionProfile)
        ? motionProfile
        : "bounce";
      
      // Update saved drawing
      const drawings = await dbService.findDrawings();
      const idx = drawings.findIndex((d) => d._id === drawing._id);
      if (idx !== -1) {
        drawings[idx] = drawing;
        const currentDb = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "db.json"), "utf-8"));
        currentDb.drawings = drawings;
        fs.writeFileSync(path.join(process.cwd(), "data", "db.json"), JSON.stringify(currentDb, null, 2));
      }

      // Map chapters to resolve actor drawings (from classmates pool)
      const allDrawings = drawings.filter((d) => d._id !== drawingId);
      
      const resolvedChapters = (chapters || []).map((chapter: any) => {
        const resolvedActors = (chapter.actors || []).map((actor: any) => {
          if (actor.role === "hero") {
            return {
              drawingId: drawing._id,
              processedUrl: drawing.processedUrl,
              characterName: actor.characterName || classification || "My Doodle",
              role: "hero" as const,
              scale: actor.scale || 1.0,
              position: actor.position || { x: 50, y: 60 }
            };
          } else {
            if (allDrawings.length > 0) {
              const randomIndex = Math.floor(Math.random() * allDrawings.length);
              const classmate = allDrawings[randomIndex];
              return {
                drawingId: classmate._id,
                processedUrl: classmate.processedUrl,
                characterName: actor.characterName || classmate.classification || "Classmate Doodle",
                role: actor.role || "companion",
                scale: actor.scale || 0.8,
                position: actor.position || { x: 25, y: 65 }
              };
            } else {
              return {
                drawingId: drawing._id,
                processedUrl: drawing.processedUrl,
                characterName: actor.characterName || "Buddy Doodle",
                role: actor.role || "companion",
                scale: 0.8,
                position: actor.position || { x: 25, y: 65 }
              };
            }
          }
        });

        if (!resolvedActors.some((a: any) => a.role === "hero")) {
          resolvedActors.unshift({
            drawingId: drawing._id,
            processedUrl: drawing.processedUrl,
            characterName: classification || "My Doodle",
            role: "hero" as const,
            scale: 1.0,
            position: { x: 50, y: 60 }
          });
        }

        return {
          ...chapter,
          actors: resolvedActors
        };
      });

      // Construct a premium default motion prompt for deAPI based on the classification and story title
      const motionPrompt = `A cute cartoon style 2D character of ${classification || "creature"} animated bouncing in a happy loop, clean transparent alpha screen background, educational anime style. Title: ${title}`;

      // Persist the newly created Story
      const newStoryRecord = await dbService.createStory({
        drawingId: drawing._id,
        title,
        languageLevel: ageGroup,
        backgroundTheme: backgroundTheme || "ocean",
        chapters: resolvedChapters,
        reviewStatus: "pending",
        teacherNotes: "",
        motionPrompt: motionPrompt,
        videoUrl: "",
      });

      // Trigger deAPI dispatch in the background (will not block the Gemini response)
      triggerDeapiAnimation(drawing, newStoryRecord, motionPrompt, req).catch((dispatchErr) => {
        console.error("[deAPI-Async-Generate] Background dispatch error:", dispatchErr);
      });

      return res.json({
        success: true,
        storyId: newStoryRecord._id,
        title: newStoryRecord.title,
        classification: drawing.classification,
        motionProfile: drawing.motionProfile,
        processedUrl: drawing.processedUrl,
        chapters: newStoryRecord.chapters,
        reviewStatus: newStoryRecord.reviewStatus,
        teacherNotes: newStoryRecord.teacherNotes,
        videoUrl: "",
      });

    } catch (err: any) {
      console.error("Story generation failed", err);
      res.status(500).json({ success: false, error: err.message || "An error occurred during story creation." });
    }
  });

  // API v1: Dedicated deAPI & Core pipeline tester page route (Task B)
  app.post("/api/v1/test-deapi-generation", upload.single("file"), async (req: any, res: any) => {
    try {
      const { drawingId, prompt: customPrompt, languageLevel } = req.body;
      const ageGroup = languageLevel || "Kindergarten (Ages 5-6)";

      let drawing: any = null;

      // 1. Resolve drawing asset: either via upload or via drawingId
      if (req.file) {
        const originalFilename = req.file.filename;
        const originalUrl = `/uploads/originals/${originalFilename}`;
        const processedFilename = `${path.parse(originalFilename).name}.png`;
        const processedUrl = `/uploads/processed/${processedFilename}`;

        const inputPath = req.file.path;
        const outputPath = path.join(processedDir, processedFilename);

        console.log(`[DiagnosticLab] Performing background removal for: ${originalFilename}`);
        try {
          const imgly = await import("@imgly/background-removal-node");
          const imageBuffer = fs.readFileSync(inputPath);
          const removedBgBlob = await imgly.removeBackground(imageBuffer, {
            output: { format: "image/png", quality: 0.85 }
          });
          const arrayBuffer = await removedBgBlob.arrayBuffer();
          fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
          console.log("[DiagnosticLab] Background removed via @imgly");
        } catch (error: any) {
          console.warn("[DiagnosticLab] @imgly failed, copying original raw upload),", error.message);
          fs.copyFileSync(inputPath, outputPath);
        }

        drawing = await dbService.createDrawing({
          filename: processedFilename,
          originalUrl,
          processedUrl,
          classification: "Doodle Creature",
          motionProfile: "bounce",
        });
      } else if (drawingId) {
        drawing = await dbService.findDrawingById(drawingId);
        if (!drawing) {
          return res.status(404).json({ success: false, error: "Drawing ID specified not found in db.json." });
        }
      } else {
        return res.status(400).json({ success: false, error: "Missing physical asset. Please upload an image file or provide drawingId." });
      }

      // 2. We skip Gemini in the test portal to ensure rapid response and to test *only* the deAPI link.
      let storyTitle = "My Custom Animation Test";
      let classification = drawing.classification || "Doodle Character";
      
      const storyPrompt = customPrompt || `A cute cartoon style 2D character of ${classification} moving happily in a loop, detailed visual background, transparent screen`;

      
      const debugStory = await dbService.createStory({
        drawingId: drawing._id,
        title: `Debug Animation: ${storyTitle}`,
        languageLevel: ageGroup,
        backgroundTheme: "ocean",
        chapters: [
          {
            chapterNumber: 1,
            narrativeText: `Behold! The customized ${classification} is ready to test! Let's watch the video animation.`,
            actors: [
              {
                drawingId: drawing._id,
                processedUrl: drawing.processedUrl,
                characterName: classification,
                role: "hero",
                scale: 1.0,
                position: { x: 50, y: 55 }
              }
            ],
            checkpoint: {
              question: "Is the video generation working?",
              options: ["Yes, absolutely", "Not yet", "I'm testing it right now"],
              correctIndex: 0,
              correctOption: "Yes, absolutely",
              distractorOptions: ["Not yet", "I'm testing it right now"]
            }
          }
        ],
        reviewStatus: "approved", // auto approved for developer lab
        teacherNotes: "Generated in Core deAPI & LLM Laboratory",
        motionPrompt: storyPrompt,
        videoUrl: "",
      });

      // 4. Dispatch the deAPI request and grab synchronous report logs
      const deapiReport = await triggerDeapiAnimation(drawing, debugStory, storyPrompt, req);

      res.status(200).json({
        success: true,
        drawingId: drawing._id,
        storyId: debugStory._id,
        title: debugStory.title,
        promptUsed: storyPrompt,
        classification,
        processedUrl: drawing.processedUrl,
        deapiReport: deapiReport
      });

    } catch (err: any) {
      console.error("[DiagnosticLab] Failure in diagnostic portal:", err);
      res.status(500).json({ success: false, error: err.message || "An error occurred during diagnostic testing" });
    }
  });

  // API v1: Simulation route for developers to trigger webhook completed callback locally
  app.post("/api/v1/test-deapi-simulate-webhook", async (req, res) => {
    try {
      const { storyId, videoUrl } = req.body;
      if (!storyId) {
        return res.status(400).json({ success: false, error: "Missing storyId." });
      }
      
      const fileUrl = videoUrl || "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4";
      const updated = await dbService.updateStory(storyId, {
        videoUrl: fileUrl,
        reviewStatus: "approved"
      });
      console.log(`[DiagnosticLab-Simulation] Simulated webhook completed callback for storyId: ${storyId} with URL ${fileUrl}`);
      res.json({ success: true, message: "Webhook successfully simulated! Video asset is now ready.", story: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });


  // Vite Integration: Middleware for development, or static serving in production
  if (process.env.NODE_ENV !== "production") {
    console.log("Injecting Vite middleware for HMR-less SPA delivery");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving build outputs directly");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`★ EduVision server successfully running on port http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full stack Express application", err);
});
