"use client";

import React, { useState, useRef } from "react";
import { Upload, Sparkles, AlertCircle, RefreshCw } from "lucide-react";

export default function ChildUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith("image/")) {
        setError("Please select a valid image file (JPEG, PNG, or WebP).");
        return;
      }
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose a drawing photo first!");
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage("Uploading drawing & removing backgrounds locally in Node.js...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/v1/drawings/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setStatusMessage("Success! Segmented transparent drawing ready.");
        // Simulated navigation or success state
        alert(`Drawing successfully uploaded and segmented! ID: ${data.drawingId}`);
      } else {
        setError(data.error || "Failed to process target drawing.");
      }
    } catch (err) {
      console.error("Upload error", err);
      setError("Network error when uploading file to backend server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-amber-50 to-emerald-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md mx-auto bg-white/90 backdrop-blur-md p-8 rounded-3xl border border-rose-100 shadow-xl space-y-6">
        
        {/* Title */}
        <div className="text-center">
          <div className="inline-block bg-rose-500/10 p-3 rounded-full text-rose-500 mb-2">
            <Sparkles className="w-8 h-8 animate-pulse text-amber-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-805 tracking-tight">
            Playroom Drawing Desk
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Let's turn your beautiful physical drawings into a magical animated storybook!
          </p>
        </div>

        {/* Form area */}
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-3 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 hover:border-rose-400 transition duration-200 min-h-[160px]"
          >
            {previewUrl ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={previewUrl}
                  alt="Review thumbnail"
                  className="max-h-28 object-contain rounded-xl shadow-sm border border-slate-100"
                />
                <span className="text-[10px] text-slate-400 font-bold">Tap to change sketch</span>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-slate-400 animate-bounce" />
                <div className="text-center">
                  <p className="font-bold text-slate-700 text-sm">Select Original Drawing</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Supports JPG, PNG, and WebP photos</p>
                </div>
              </>
            )}
          </div>

          {/* Action button */}
          <button
            type="submit"
            disabled={loading || !file}
            className={`w-full py-3.5 px-4 rounded-2xl font-extrabold text-sm text-white shadow-md transition-all duration-300 ${
              loading || !file
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-gradient-to-tr from-rose-500 to-amber-500 hover:scale-[1.02] active:scale-98"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing...
              </span>
            ) : (
              "🚀 Bring Character to Life!"
            )}
          </button>
        </form>

        {/* Dynamic status feedback */}
        {loading && (
          <div className="text-center p-3 bg-rose-50/50 rounded-2xl border border-rose-100 text-[11px] text-rose-600 font-bold animate-pulse">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <p className="font-medium text-left">{error}</p>
          </div>
        )}

      </div>
    </div>
  );
}
