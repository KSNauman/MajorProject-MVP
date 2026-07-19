import { Router, Request, Response } from "express";
import { generateStoryFromDrawing } from "../services/aiService.js";
import { StoryModel } from "../models/story.js";

const router = Router();

// GET /api/v1/stories/pending
router.get("/pending", async (req: Request, res: Response) => {
  try {
    const pendingStories = await StoryModel.find({ reviewStatus: "pending" }).populate("drawingId");
    return res.status(200).json({
      success: true,
      stories: pendingStories,
    });
  } catch (error: any) {
    console.error("[Stories Route] Failed to fetch pending stories:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred while fetching pending stories.",
    });
  }
});

// PATCH /api/v1/stories/:id/status
router.patch("/:id/status", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reviewStatus, teacherNotes } = req.body;

  if (!reviewStatus || !["pending", "approved", "rejected"].includes(reviewStatus)) {
    return res.status(400).json({
      success: false,
      error: "Missing or invalid reviewStatus value. Must be 'pending', 'approved', or 'rejected'.",
    });
  }

  try {
    const updates: any = { reviewStatus };
    if (typeof teacherNotes === "string") {
      updates.teacherNotes = teacherNotes;
    }

    const updatedStory = await StoryModel.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );

    if (!updatedStory) {
      return res.status(404).json({
        success: false,
        error: "Story not found.",
      });
    }

    return res.status(200).json({
      success: true,
      story: updatedStory,
    });
  } catch (error: any) {
    console.error("[Stories Route] Failed to update story status:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred while updating story status.",
    });
  }
});

// POST /api/v1/stories/generate
router.post("/generate", async (req: Request, res: Response) => {
  const { primaryDrawingId, drawingId, companionDrawingIds } = req.body;
  const targetDrawingId = primaryDrawingId || drawingId;

  if (!targetDrawingId) {
    return res.status(400).json({
      success: false,
      error: "Missing primaryDrawingId or drawingId query/body value.",
    });
  }

  try {
    const companions = Array.isArray(companionDrawingIds) ? companionDrawingIds : [];
    const result = await generateStoryFromDrawing(targetDrawingId, companions);

    return res.status(200).json({
      success: true,
      storyId: result.story._id.toString(),
      title: result.story.title,
      processedUrl: result.drawing.processedUrl,
      languageLevel: result.story.languageLevel,
      chapters: result.story.chapters,
      reviewStatus: result.story.reviewStatus,
      teacherNotes: result.story.teacherNotes || "",
    });
  } catch (error: any) {
    console.error(`[Stories Route] Orchestrated generation failed:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred during generative storytelling.",
    });
  }
});

export default router;
