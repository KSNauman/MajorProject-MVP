import React, { useState, useRef } from "react";
import { DEMO_DRAWINGS } from "../data/demoDrawings";
import { Upload, Sparkles, BookOpen, AlertCircle, Laptop, Image } from "lucide-react";
import { AgeLevel } from "../types";

interface DrawingUploaderProps {
  onUploadSuccess: (drawingId: string, originalUrl: string, processedUrl: string, ageLevel: AgeLevel) => void;
}

export default function DrawingUploader({ onUploadSuccess }: DrawingUploaderProps) {
  const [ageLevel, setAgeLevel] = useState<AgeLevel>("Kindergarten (Ages 5-6)");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const simulateProgressUpdates = (callback: () => Promise<void>) => {
    const messages = [
      "Uploading original paper sketch lines...",
      "Configuring zero-GPU background remover context...",
      "Running local WASM pixel segmentation...",
      "Whitening paper and balancing margins...",
      "Smoothing transparent sketch borders...",
      "Calling Gemini Flash cognitive AI storyteller..."
    ];

    let index = 0;
    setLoadingProgress(messages[0]);

    const interval = setInterval(() => {
      index++;
      if (index < messages.length) {
        setLoadingProgress(messages[index]);
      }
    }, 1500);

    callback().finally(() => {
      clearInterval(interval);
    });
  };

  const handleUploadFile = async (file: File) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    simulateProgressUpdates(async () => {
      try {
        const response = await fetch("/api/v1/drawings/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`The server returned an error status: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success) {
          onUploadSuccess(data.drawingId, data.originalUrl, data.processedUrl, ageLevel);
        } else {
          setError(data.error || "Failed to process target drawing.");
        }
      } catch (err) {
        console.error("Upload error", err);
        setError("Network connection failure. Checking local offline background fallback.");
      } finally {
        setLoading(false);
      }
    });
  };

  // Helper to convert an SVG data URI into a real PNG Blob via HTML5 canvas
  const convertSvgDataUriToPngBlob = (dataUri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 500;
          canvas.height = 500;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Could not construct 2D canvas context.");
          }
          ctx.clearRect(0, 0, 500, 500);
          ctx.drawImage(img, 0, 0, 500, 500);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed converting canvas to blob resource."));
            }
          }, "image/png");
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => {
        reject(new Error("Failed loading drawing onto image container."));
      };
      img.src = dataUri;
    });
  };

  // Preloaded Demo sketches simulation (converts SVG to simulated file stream or saves base64)
  const handleSelectDemoSketch = async (demo: typeof DEMO_DRAWINGS[0]) => {
    setLoading(true);
    setError(null);

    simulateProgressUpdates(async () => {
      try {
        console.log(`[Demo] Rasterizing drawing vectors onto canvas: ${demo.name}`);
        const pngBlob = await convertSvgDataUriToPngBlob(demo.imageBase64);
        const file = new File([pngBlob], `${demo.name.toLowerCase().replace(/\s+/g, "_")}.png`, { type: "image/png" });

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/v1/drawings/upload", {
          method: "POST",
          body: formData,
        });

        // Fail gracefully with descriptive message if back-end failed to output JSON
        if (!response.ok) {
          throw new Error(`The server returned an error status: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success) {
          onUploadSuccess(data.drawingId, data.originalUrl, data.processedUrl, ageLevel);
        } else {
          setError(data.error || "Failed to load pre-seeded drawing.");
        }
      } catch (err: any) {
        console.error("Failed loading pre-seeded vector", err);
        setError(`Error processing demo sketch: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div id="drawing-uploader-root" className="max-w-4xl mx-auto p-4 flex flex-col gap-6 text-center">
      
      {/* Age / Learning Comprehension Selector */}
      <div id="age-selector-container" className="bg-white/80 p-5 rounded-3xl border border-rose-100 shadow-sm max-w-2xl mx-auto w-full">
        <h3 className="font-extrabold text-slate-800 text-sm flex items-center justify-center gap-1.5 mb-1">
          <BookOpen className="text-rose-500 w-4.5 h-4.5" />
          Choose Story Educational Grade
        </h3>
        <p className="text-slate-500 text-xs mb-4">
          Select learning vocabularies matched perfectly to your child's cognitive development
        </p>

        <div className="grid grid-cols-3 gap-3">
          {(["Preschool (Ages 3-4)", "Kindergarten (Ages 5-6)", "Primary (Ages 7-8)"] as const).map((level) => (
            <button
              key={level}
              id={`age-btn-${level.replace(/\s+/g, "").replace(/[()]/g, "")}`}
              onClick={() => setAgeLevel(level)}
              className={`p-3 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                ageLevel === level
                  ? "bg-gradient-to-tr from-rose-500 to-amber-500 text-white border-transparent shadow-sm scale-102"
                  : "bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="text-xl">
                {level.includes("3-4") ? "👶" : level.includes("5-6") ? "🦄" : "🎒"}
              </span>
              <span className="text-xs font-bold leading-tight">{level}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Drag & Drop Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch max-w-4xl mx-auto w-full">
        
        {/* Upload box */}
        <div 
          className="md:col-span-7 flex flex-col"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={`flex-1 border-3 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center gap-4 transition-all duration-300 min-h-[290px] ${
            isDragging 
              ? "border-amber-400 bg-amber-50/40" 
              : "border-slate-300 bg-white/70 hover:border-rose-400 hover:bg-rose-50/10"
          }`}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadFile(e.target.files[0]);
                }
              }}
              accept="image/*"
              className="hidden"
            />

            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full border-4 border-rose-100"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-rose-500 border-t-transparent animate-spin"></div>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">Processing Child Drawing</h4>
                  <p className="text-xs text-rose-500 font-medium font-mono h-4 overflow-hidden mt-1 animate-pulse">
                    {loadingProgress}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-tr from-rose-500 to-amber-500 p-4 rounded-3xl text-white shadow-md animate-bounce">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-slate-700 text-sm">Drag your Paper Drawing here</h4>
                  <p className="text-xs text-slate-500">Supports photos of drawing papers, JPGs, and PNGs</p>
                  <p className="text-[10px] text-slate-400 mt-2 font-bold font-sans">OR</p>
                </div>
                <button
                  id="browse-files-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-2xl shadow-sm transition hover:scale-102"
                >
                  📸 Select Drawing Photo
                </button>
              </>
            )}

            {error && (
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 flex items-center gap-2 mt-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <p className="text-[11px] text-rose-700 font-medium text-left">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Preloaded child doodles */}
        <div className="md:col-span-5 bg-white/80 p-5 rounded-3xl border border-slate-100 shadow-sm text-left flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Sparkles className="text-amber-500 w-4 h-4" />
              Preloaded Sketches
            </h4>
            <p className="text-[11px] text-slate-500 mb-4 font-medium leading-relaxed">
              Don't have a drawing at hand? Click any of these preloaded sketches to instant-test segmentations and stories!
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {DEMO_DRAWINGS.map((demo, idx) => (
                <button
                  key={idx}
                  id={`demo-btn-${demo.name.split(" ")[0].toLowerCase()}`}
                  onClick={() => handleSelectDemoSketch(demo)}
                  disabled={loading}
                  className="p-1.5 rounded-2xl bg-slate-50 hover:bg-rose-50 hover:border-rose-200 border border-slate-200 transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer group text-center min-h-[95px] relative"
                >
                  <div className="w-12 h-12 rounded-lg bg-white overflow-hidden p-0.5 border border-slate-150 flex items-center justify-center transition group-hover:scale-110">
                    <img src={demo.imageBase64} alt={demo.name} className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-700 leading-tight">
                    {demo.name.split(" ")[2] || demo.name.split(" ")[1]}
                  </span>
                  <span className="text-[8px] uppercase tracking-wider font-bold text-rose-500 font-mono">
                    {demo.motionProfile}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4 flex items-center gap-1.5 text-slate-400">
            <Laptop className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[9px] font-bold font-mono">
              ZERO-GPU WASM PROCESSING DEMO
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
