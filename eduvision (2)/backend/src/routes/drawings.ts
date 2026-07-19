import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Types } from "mongoose";
import { Drawing } from "../models/drawing.js";

const router = Router();

// Define public directories
const baseUploadsDir = path.join(process.cwd(), "public", "uploads");
const originalsDir = path.join(baseUploadsDir, "originals");
const processedDir = path.join(baseUploadsDir, "processed");

// Ensure physical folders exist on runtime/startup
fs.mkdirSync(originalsDir, { recursive: true });
fs.mkdirSync(processedDir, { recursive: true });

// Setup Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, originalsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}${ext}`;
    cb(null, uniqueName);
  },
});

// Configure file filters
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP images are allowed."));
    }
  },
});

// POST /api/v1/drawings/upload
router.post(
  "/upload",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image file provided." });
    }

    const inputPath = req.file.path;
    const originalFilename = req.file.filename;
    
    // Set standard path strings to keep things matching user descriptions
    const originalUrl = `/public/uploads/originals/${originalFilename}`;
    
    // Create new drawing Document ObjectId in advance to name the transparent result uniquely
    const drawingId = new Types.ObjectId();
    const processedFilename = `${drawingId.toString()}.png`;
    const outputPath = path.join(processedDir, processedFilename);
    const processedUrl = `/public/uploads/processed/${processedFilename}`;

    console.log(`[Segmentation] Starting background removal process for drawing ID: ${drawingId}`);

    try {
      // Lazy import background removal module to isolate node dependencies issues
      const imgly = await import("@imgly/background-removal-node");
      
      // Read original raw file into memory buffer
      const imageBuffer = fs.readFileSync(inputPath);

      // Perform local segmentation
      const removedBgBlob = await imgly.removeBackground(imageBuffer, {
        output: {
          format: "image/png",
          quality: 0.85,
        },
      });

      // Write transparent buffer to disk
      const arrayBuffer = await removedBgBlob.arrayBuffer();
      fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
      console.log(`[Segmentation] Background removed successfully. Saved to: ${outputPath}`);

      // Create Drawing record
      const drawingRecord = new Drawing({
        _id: drawingId,
        filename: originalFilename,
        originalUrl,
        processedUrl,
        classification: "generic_bouncing",
        motionProfile: "bounce",
      });

      await drawingRecord.save();

      return res.status(201).json({
        success: true,
        drawingId: drawingId.toString(),
        originalUrl,
        processedUrl,
        classification: "generic_bouncing",
        motionProfile: "bounce",
      });
    } catch (error: any) {
      console.error(`[Segmentation] Failed background removal or save pipeline:`, error);

      // Clean up the partially written original file if processing is broken
      if (fs.existsSync(inputPath)) {
        try {
          fs.unlinkSync(inputPath);
          console.log(`[Cleanup] Cleaned up original raw file after failure: ${inputPath}`);
        } catch (unlinkErr) {
          console.error(`[Cleanup] Failed to delete file: ${inputPath}`, unlinkErr);
        }
      }

      return res.status(500).json({
        success: false,
        error: `Image segmentation process failed: ${error.message || error}`,
      });
    }
  }
);

// GET /api/v1/drawings/gallery
router.get("/gallery", async (req: Request, res: Response) => {
  try {
    // Queries the drawings collection for classmate drawings. Since reviewStatus is requested,
    // we query with support for both approved status or any drawings if no approved exists.
    const query = { $or: [{ reviewStatus: "approved" }, { reviewStatus: { $exists: false } }] };
    let drawings = await Drawing.find(query);
    
    // If no drawings exist under query, return all drawings
    if (drawings.length === 0) {
      drawings = await Drawing.find({});
    }

    const mapped = drawings.map((d) => ({
      _id: d._id.toString(),
      processedUrl: d.processedUrl,
      classification: d.classification || "classmate_character",
    }));

    return res.status(200).json({
      success: true,
      drawings: mapped,
    });
  } catch (error: any) {
    console.error("[Gallery Route] Failed retrieving drawings gallery:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred during gallery query.",
    });
  }
});

export default router;
