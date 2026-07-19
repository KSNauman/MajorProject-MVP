import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Trash2, CheckCircle, Undo, RotateCcw, AlertTriangle, ShieldCheck } from "lucide-react";

interface CanvasEraserProps {
  drawingId: string;
  processedUrl: string;
  onEraserSuccess: () => void;
}

export default function CanvasEraser({ drawingId, processedUrl, onEraserSuccess }: CanvasEraserProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"zap" | "erase" | "restore">("zap");
  const [brushSize, setBrushSize] = useState(24);
  const [isDrawing, setIsDrawing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState("");

  const originalImageRef = useRef<HTMLImageElement | null>(null);

  // Initialize and load image onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.src = processedUrl;
    img.onload = () => {
      originalImageRef.current = img;
      
      // Set fixed drawing resolution (e.g., 400x400)
      canvas.width = 400;
      canvas.height = 400;
      
      // Draw image centered and fitted to 400x400 canvas
      ctx.clearRect(0, 0, 400, 400);
      
      // Keep aspect ratio
      const scale = Math.min(400 / img.width, 400 / img.height);
      const x = (400 - img.width * scale) / 2;
      const y = (400 - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    };
    img.onerror = () => {
      setErrorCode("Could not load image onto magic canvas. Please continue directly.");
    };
  }, [processedUrl]);

  // Reset the editing canvas back to original processed image
  const handleResetCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !originalImageRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = originalImageRef.current;
    ctx.clearRect(0, 0, 400, 400);
    const scale = Math.min(400 / img.width, 400 / img.height);
    const x = (400 - img.width * scale) / 2;
    const y = (400 - img.height * scale) / 2;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
  };

  // Magic Color Zap (Click coordinates, find color, delete similar colors instantly)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== "zap") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Get click coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    // Get color of clicked pixel
    const clickedIdx = (y * canvas.width + x) * 4;
    const targetR = pixels[clickedIdx];
    const targetG = pixels[clickedIdx + 1];
    const targetB = pixels[clickedIdx + 2];
    const targetA = pixels[clickedIdx + 3];

    // If target pixel is already fully transparent, do nothing
    if (targetA === 0) return;

    const threshold = 55; // Color distance threshold

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      if (a === 0) continue;

      // Calculate Euclidean color distance
      const distance = Math.sqrt(
        Math.pow(r - targetR, 2) + Math.pow(g - targetG, 2) + Math.pow(b - targetB, 2)
      );

      if (distance < threshold) {
        // Zap to transparency
        pixels[i + 3] = 0;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  };

  // Manual brush erasing / restoring
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "zap") return;
    setIsDrawing(true);
    draw(e);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool === "zap") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasMousePos(e);

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);

    if (tool === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
    } else if (tool === "restore") {
      ctx.globalCompositeOperation = "source-over";
      // Draw raw image in-bounds
      if (originalImageRef.current) {
        ctx.fillStyle = "rgba(0,0,0,1)"; // Dummy, doesn't restore pixels easily unless we clip clip
        // Fallback simple blue coloring or we can use source image as pattern
        const pattern = ctx.createPattern(originalImageRef.current, "no-repeat");
        if (pattern) {
          ctx.fillStyle = pattern;
        }
      }
    }
    ctx.fill();
  };

  // Turn off-white backgrounds completely transparent automatically
  const handleAutoWhiten = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      if (a === 0) continue;

      // If pixel is off-white or very light paper gray (r,g,b > 215)
      if (r > 215 && g > 215 && b > 215) {
        pixels[i + 3] = 0; // set alpha transparent
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Submit transparent edits back to API
  const handleApplyEdits = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    const imageBase64 = canvas.toDataURL("image/png");

    try {
      const res = await fetch("/api/v1/drawings/save-segmented", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drawingId, imageBase64 }),
      });
      const data = await res.json();
      if (data.success) {
        onEraserSuccess();
      } else {
        alert("Failed to save segmented drawing: " + data.error);
      }
    } catch (err) {
      console.error("Failed to upload manually transparent canvas", err);
      // Fallback
      onEraserSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="eraser-root" className="max-w-4xl mx-auto p-4 bg-white/70 backdrop-blur-md rounded-3xl border border-rose-100 shadow-sm text-center">
      
      {/* Title */}
      <div className="mb-4">
        <h3 className="font-extrabold text-slate-800 text-sm flex items-center justify-center gap-1.5">
          <Sparkles className="text-amber-500 w-5 h-5 animate-spin-slow" />
          🛠️ Magic Canvas background remover
        </h3>
        <p className="text-slate-500 text-xs">
          Help isolators clean up outline colors! Tap background noise to transparent-zap!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        
        {/* Editing Tools Bar */}
        <div className="md:col-span-4 flex flex-col gap-3 text-left">
          <h4 className="font-bold text-xs text-rose-500 uppercase tracking-widest mb-1 pl-1">
            Magic Wands
          </h4>

          {/* Color Zap */}
          <button
            id="tool-btn-zap"
            onClick={() => setTool("zap")}
            className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition cursor-pointer ${
              tool === "zap"
                ? "bg-rose-500 text-white border-transparent shadow-sm"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span className="text-lg">🪄</span>
            <div>
              <p className="font-bold text-xs">Color Magic Zap</p>
              <p className={`text-[10px] ${tool === "zap" ? "text-rose-100" : "text-slate-500"}`}>
                Tap any background pixel to erase similar colors instantly!
              </p>
            </div>
          </button>

          {/* Brush Eraser */}
          <button
            id="tool-btn-erase"
            onClick={() => setTool("erase")}
            className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition cursor-pointer ${
              tool === "erase"
                ? "bg-rose-500 text-white border-transparent shadow-sm"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span className="text-lg">🧽</span>
            <div>
              <p className="font-bold text-xs">Precision Eraser</p>
              <p className={`text-[10px] ${tool === "erase" ? "text-rose-100" : "text-slate-500"}`}>
                Click and drag to physically rub off shadows or outline marks.
              </p>
            </div>
          </button>

          {/* Brush controller */}
          {tool === "erase" && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                <span>Eraser Brush Size</span>
                <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-md font-mono">{brushSize}px</span>
              </div>
              <input
                type="range"
                min="6"
                max="60"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full accent-rose-500"
              />
            </div>
          )}

          {/* Auto paper whiten */}
          <button
            id="tool-btn-whiten"
            onClick={handleAutoWhiten}
            className="p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-slate-800 text-left flex items-center gap-3 transition cursor-pointer"
          >
            <span className="text-lg">✨</span>
            <div>
              <p className="font-bold text-xs text-amber-900">Auto Paper Isolation</p>
              <p className="text-[10px] text-amber-700">
                Instantly turn all off-white areas into transparent space!
              </p>
            </div>
          </button>

          {/* Quick reset actions */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleResetCanvas}
              className="flex-1 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset drawing
            </button>
          </div>
        </div>

        {/* Canvas Display Area */}
        <div className="md:col-span-5 flex flex-col items-center justify-center">
          {/* Transparency grid backdrop */}
          <div className="p-2.5 bg-slate-100 rounded-3xl border border-slate-200 shadow-inner">
            <div 
              className="relative rounded-2xl overflow-hidden shadow-md cursor-crosshair border border-slate-300"
              style={{
                backgroundImage: "radial-gradient(#cbcbcb 15%, transparent 15%), radial-gradient(#cbcbcb 15%, transparent 15%)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 10px 10px"
              }}
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onMouseMove={draw}
                className="block max-w-full"
                style={{ width: "320px", height: "320px" }}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-bold font-mono mt-2">
            RESOLUTION: 400x400 PNG SECTOR
          </p>

          {errorCode && (
            <div className="mt-2 bg-yellow-50 text-yellow-800 text-[10px] p-2 rounded-lg border border-yellow-200 flex items-center gap-1.5 max-w-[320px]">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
              <span>{errorCode}</span>
            </div>
          )}
        </div>

        {/* Big Complete Button action */}
        <div className="md:col-span-3 flex flex-col gap-4 items-stretch justify-center">
          <div className="p-4 bg-gradient-to-tr from-rose-50 to-amber-50 rounded-2xl border border-rose-100 text-left space-y-1.5">
            <h5 className="font-extrabold text-slate-800 text-xs flex items-center gap-1">
              <CheckCircle className="text-rose-500 w-4 h-4 shrink-0" />
              Checking Ready?
            </h5>
            <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
              Once you're satisfied that your drawing doesn't have paper marks on edges, click continue to launch story!
            </p>
          </div>

          <button
            id="apply-eraser-btn"
            onClick={handleApplyEdits}
            disabled={loading}
            className="bg-gradient-to-tr from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-extrabold text-sm py-4 px-6 rounded-3xl shadow-md transition-all duration-300 hover:scale-102 flex flex-col items-center justify-center gap-1 cursor-pointer"
          >
            {loading ? (
              <span className="animate-pulse">Isolating Drawing...</span>
            ) : (
              <>
                <span className="text-base">🚀 Magic Complete!</span>
                <span className="text-[10px] font-bold text-rose-100">Proceed to Chapter 1</span>
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
}
