import { Router, Request, Response } from "express";
import crypto from "crypto";
import { StoryModel } from "../models/story.js";

const router = Router();

// POST /api/v1/webhooks/deapi
router.post("/deapi", async (req: Request, res: Response) => {
  const signatureHeader = req.headers["x-deapi-signature"];
  const timestampHeader = req.headers["x-deapi-timestamp"];

  if (!signatureHeader || !timestampHeader) {
    console.error("[Webhook-Secure] Missing cryptographic signature headers.");
    return res.status(401).json({ error: "Unauthorized: Missing Signature/Timestamp headers" });
  }

  // 1. Signature Verification (Replay & Spoof Protection)
  const timestamp = parseInt(String(timestampHeader), 10);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (isNaN(timestamp) || Math.abs(nowSeconds - timestamp) > 300) {
    console.error(`[Webhook-Secure] Rejecting: Timestamp drift exceeded 300 seconds limit. Current: ${nowSeconds}, Header: ${timestamp}`);
    return res.status(401).json({ error: "Unauthorized: Timestamp drift exceeded limit" });
  }

  // 2. Extract raw body string cleanly
  const rawBodyString = req.body instanceof Buffer 
    ? req.body.toString("utf8") 
    : (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

  const secret = process.env.DEAPI_WEBHOOK_SECRET || "default_super_secret_webhook_key_32_chars_long!!";

  // Calculate the signature: hmac_sha256(timestamp + "." + raw_body, secret)
  const stringToSign = `${timestampHeader}.${rawBodyString}`;
  const computedSignature = crypto.createHmac("sha256", secret).update(stringToSign).digest("hex");

  try {
    const bufferComputed = Buffer.from(computedSignature, "hex");
    const bufferHeader = Buffer.from(String(signatureHeader), "hex");

    if (bufferComputed.length !== bufferHeader.length || !crypto.timingSafeEqual(bufferComputed, bufferHeader)) {
      console.error("[Webhook-Secure] Verification failed: Computed signature does not match header signature.");
      return res.status(401).json({ error: "Unauthorized: Signature mismatch" });
    }
  } catch (err: any) {
    console.error("[Webhook-Secure] Error during timingSafeEqual signature comparison:", err.message);
    return res.status(401).json({ error: "Unauthorized: Signature verification error" });
  }

  // Return a 200 OK immediately to satisfy deAPI delivery requirements
  res.status(200).json({ success: true, message: "Webhook payload verified and received." });

  // 3. Process webhook event asynchronously
  try {
    const payload = JSON.parse(rawBodyString);
    console.log("[Webhook-Success] Cryptographically verified payload received:", payload);

    const storyId = payload.track_id || payload.data?.track_id;
    if (!storyId) {
      console.warn("[Webhook-Process] Warning: No track_id (Story ID) found in webhook payload.");
      return;
    }

    const story = await StoryModel.findById(storyId);
    if (!story) {
      console.error(`[Webhook-Process] Error: No story document found matching ID: ${storyId}`);
      return;
    }

    if (payload.event === "job.completed") {
      const resultUrl = payload.data?.result_url;
      if (resultUrl) {
        story.videoUrl = resultUrl;
        story.reviewStatus = "approved";
        await story.save();
        console.log(`[Webhook-Process] Successfully processed job.completed for Story ${storyId}. Saved Video URL: ${resultUrl}`);
      } else {
        console.error("[Webhook-Process] Error: result_url is missing inside job.completed event data.");
      }
    } else if (payload.event === "job.failed") {
      const errMsg = payload.data?.error_message || "no error details provided";
      console.error(`[Webhook-Process] deAPI reported animation job failure for Story ${storyId}: "${errMsg}". Reverting to GSAP fallbacks.`);
      
      story.videoUrl = "";
      story.reviewStatus = "approved"; // Allow teacher to review & play using standard GSAP bobs/hops
      await story.save();
    } else {
      console.log(`[Webhook-Process] Unhandled event type: "${payload.event}"`);
    }
  } catch (error: any) {
    console.error("[Webhook-Process] Exception occurred during payload processing:", error.message || error);
  }
});

export default router;
