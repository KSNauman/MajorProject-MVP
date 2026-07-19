"use client";

import React, { useState, useEffect, useRef } from "react";
import { Upload, Sparkles, AlertCircle, RefreshCw, Check, Library, ArrowRight, UserPlus, FileText } from "lucide-react";

interface CompanionDrawing {
  _id: string;
  processedUrl: string;
  classification: string;
}

export default function StorybookCreationWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Upload Primary Drawing States
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [primaryPreviewUrl, setPrimaryPreviewUrl] = useState<string | null>(null);
  const [primaryDrawing, setPrimaryDrawing] = useState<{ id: string; processedUrl: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Gallery & Companions States
  const [gallery, setGallery] = useState<CompanionDrawing[]>([]);
  const [selectedCompanions, setSelectedCompanions] = useState<string[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);

  // Step 3: Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<1 | 2 | 3>(1);
  const [storyResult, setStoryResult] = useState<any | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Load classmates gallery for Step 2
  const loadGallery = async () => {
    setIsLoadingGallery(true);
    try {
      const res = await fetch("/api/v1/drawings/gallery");
      const data = await res.json();
      if (data.success) {
        setGallery(data.drawings || []);
      }
    } catch (err) {
      console.error("Failed to load gallery drawings", err);
    } finally {
      setIsLoadingGallery(false);
    }
  };

  useEffect(() => {
    if (step === 2) {
      loadGallery();
    }
  }, [step]);

  // Step 1: Handle file selection and immediate background removal upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorCode(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith("image/")) {
        setErrorCode("Please upload a valid image file.");
        return;
      }
      setPrimaryFile(selectedFile);
      setPrimaryPreviewUrl(URL.createObjectURL(selectedFile));

      // Auto start upload
      await uploadPrimaryCharacter(selectedFile);
    }
  };

  const uploadPrimaryCharacter = async (file: File) => {
    setIsUploading(true);
    setErrorCode(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/drawings/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setPrimaryDrawing({
          id: data.drawingId,
          processedUrl: data.processedUrl,
        });
        // Settle upload and go to companions step
        setStep(2);
      } else {
        setErrorCode(data.error || "Failed to segment character background.");
      }
    } catch (err) {
      console.error("Upload error", err);
      setErrorCode("Network connection failed during drawing isolation.");
    } finally {
      setIsUploading(false);
    }
  };

  // Step 2: Companion Toggles
  const handleToggleCompanion = (id: string) => {
    setSelectedCompanions((prev) => {
      if (prev.includes(id)) {
        return prev.filter((existingId) => existingId !== id);
      }
      if (prev.length >= 2) {
        return [...prev.slice(1), id]; // Max 2 companion drawings
      }
      return [...prev, id];
    });
  };

  // Step 3: Trigger magic storybook compiling task
  const handleCreateMagicStory = async () => {
    if (!primaryDrawing) return;

    setIsGenerating(true);
    setErrorCode(null);
    setGenerationStep(1);

    // Interactive progress simulated timers for the visual loaders (Task B.4)
    const timer1 = setTimeout(() => setGenerationStep(2), 3500);
    const timer2 = setTimeout(() => setGenerationStep(3), 7500);

    try {
      const response = await fetch("/api/v1/stories/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryDrawingId: primaryDrawing.id,
          companionDrawingIds: selectedCompanions,
        }),
      });

      const data = await response.json();

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (data.success) {
        setStoryResult(data);
        setStep(3);
      } else {
        setErrorCode(data.error || "Generation engine returned an invalid script response.");
        setIsGenerating(false);
      }
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      console.error("Generation error", err);
      setErrorCode("Connection timeout calling generative story model pipeline.");
      setIsGenerating(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-amber-50 to-emerald-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl mx-auto bg-white/95 backdrop-blur-md p-8 rounded-3xl border border-rose-100 shadow-xl space-y-6">

        {/* Wizard Progress Track */}
        <div className="flex items-center justify-between pb-4 border-b border-rose-50 font-mono text-[10px] font-bold text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 flex items-center justify-center rounded-full text-white ${step >= 1 ? "bg-rose-500" : "bg-slate-200"}`}>1</span>
            <span className={step >= 1 ? "text-slate-700" : ""}>Drawing</span>
          </div>
          <div className="h-0.5 w-10 bg-slate-200 flex-1 mx-2" />
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 flex items-center justify-center rounded-full text-white ${step >= 2 ? "bg-rose-500" : "bg-slate-200"}`}>2</span>
            <span className={step >= 2 ? "text-slate-700" : ""}>Companions</span>
          </div>
          <div className="h-0.5 w-10 bg-slate-200 flex-1 mx-2" />
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 flex items-center justify-center rounded-full text-white ${step >= 3 ? "bg-rose-500" : "bg-slate-200"}`}>3</span>
            <span className={step >= 3 ? "text-slate-700" : ""}>Creation Complete</span>
          </div>
        </div>

        {/* Dynamic Story Compiler Loader / Interactive Progress Tracker */}
        {isGenerating && (
          <div className="py-8 text-center space-y-6 animate-pulse">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin"></div>
              <span className="absolute inset-0 flex items-center justify-center text-2xl">⚡</span>
            </div>

            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
              <div className="text-[11px] font-mono font-black text-emerald-600 uppercase tracking-widest leading-none">
                Connecting To Live Cognition Pipeline
              </div>
              <ul className="text-left text-xs space-y-2.5 font-bold text-slate-650 pl-2">
                <li className={`flex items-center gap-2 ${generationStep >= 1 ? "text-emerald-700" : "text-slate-400"}`}>
                  <span className="text-sm">{generationStep > 1 ? "✓" : "✦"}</span>
                  <span>Step 1: Extracting your drawing from the paper...</span>
                </li>
                <li className={`flex items-center gap-2 ${generationStep >= 2 ? "text-emerald-705" : "text-slate-400"}`}>
                  <span className="text-sm">{generationStep > 2 ? "✓" : "✦"}</span>
                  <span>Step 2: Gemini is writing a story about your characters...</span>
                </li>
                <li className={`flex items-center gap-2 ${generationStep >= 3 ? "text-amber-600 animate-bounce" : "text-slate-400"}`}>
                  <span className="text-sm">✦</span>
                  <span>Step 3: deAPI is breathing magical life into your drawing...</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* App Error Banner */}
        {errorCode && (
          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center gap-3 text-rose-700 text-xs">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <p className="font-extrabold text-left">{errorCode}</p>
          </div>
        )}

        {/* STAGES AREA */}
        {!isGenerating && (
          <>
            {/* Step 1: Upload Primary Drawing View */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-block bg-rose-500/10 p-3 rounded-full text-rose-500 mb-2">
                    <Sparkles className="w-8 h-8 animate-pulse text-amber-500" />
                  </div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                    Draw Your Main Character
                  </h1>
                  <p className="text-slate-500 text-xs mt-1">
                    Upload a high-contrast photo of your hand-painted or crayon character hero on plain white paper.
                  </p>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className="border-3 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 hover:border-rose-400 transition duration-200 min-h-[180px]"
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
                      <p className="font-bold text-slate-700 text-xs text-center">
                        Isolating primary drawing outline & stripping backgrounds...
                      </p>
                    </div>
                  ) : primaryPreviewUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={primaryPreviewUrl}
                        alt="Hero Thumbnail Preview"
                        className="max-h-32 object-contain rounded-xl shadow-sm border border-slate-100"
                      />
                      <span className="text-[10px] text-slate-405 font-bold">Tap to change sketch</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-slate-400 animate-bounce" />
                      <div className="text-center">
                        <p className="font-bold text-slate-705 text-sm">Upload Hero Drawing</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG, or WebP</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Gallery Companion Selector View */}
            {step === 2 && primaryDrawing && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-block bg-amber-500/10 p-3 rounded-full text-amber-650 mb-2">
                    <UserPlus className="w-7 h-7" />
                  </div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                    Add Classmate Buddies
                  </h1>
                  <p className="text-slate-500 text-xs mt-1">
                    Select up to two classmate transparent doodles to help or join your hero doodle in this adventure!
                  </p>
                </div>

                {/* Primary Hero Thumbnail Preview */}
                <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100 flex items-center gap-3.5 text-left max-w-sm mx-auto">
                  <div className="w-12 h-12 bg-white rounded-xl border border-rose-100 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                    <img
                      src={primaryDrawing.processedUrl}
                      alt="Primary Hero PNG"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div>
                    <h5 className="font-black text-xs text-slate-700">★ Primary Character</h5>
                    <p className="text-[9px] text-slate-400 font-mono">Isolated and aligned</p>
                  </div>
                </div>

                {/* Companions Grid */}
                <div>
                  <h4 className="font-black text-[10px] uppercase font-mono tracking-wider text-slate-400 text-left mb-2">
                    Classmate Drawings Gallery
                  </h4>

                  {isLoadingGallery ? (
                    <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-semibold">Scanning classroom desk folders...</span>
                    </div>
                  ) : gallery.length === 0 ? (
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                      <p className="text-xs text-slate-500 font-bold">
                        No buddy doodles uploaded yet. Doing a solo story!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {gallery.map((companion) => {
                        const isSelected = selectedCompanions.includes(companion._id);
                        return (
                          <div
                            key={companion._id}
                            onClick={() => handleToggleCompanion(companion._id)}
                            className={`p-2 rounded-2xl border cursor-pointer relative transition duration-200 text-center ${
                              isSelected
                                ? "bg-amber-50 border-amber-400 shadow-sm"
                                : "bg-slate-50/50 hover:bg-slate-50 border-slate-100"
                            }`}
                          >
                            <div className="h-16 w-full flex items-center justify-center p-0.5">
                              <img
                                src={companion.processedUrl}
                                alt={companion.classification}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                            <h5 className="font-bold text-[9px] text-slate-650 truncate mt-1 capitalize leading-none">
                              {companion.classification.replace("_", " ")}
                            </h5>

                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-amber-500 text-white rounded-full p-0.5 text-[8px] font-black leading-none">
                                <Check className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 text-xs bg-slate-100 text-slate-600 font-extrabold hover:bg-slate-200 rounded-2xl transition cursor-pointer"
                  >
                    Back to Hero
                  </button>
                  <button
                    onClick={handleCreateMagicStory}
                    className="flex-1 py-3 bg-gradient-to-tr from-rose-500 via-amber-500 to-rose-600 text-white text-xs font-black rounded-2xl hover:scale-[1.01] transition shadow-md cursor-pointer flex items-center justify-center gap-1"
                  >
                    Create Magic Story
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Success Completion Screen */}
            {step === 3 && storyResult && (
              <div className="space-y-6 text-center">
                <div className="inline-block bg-emerald-100 text-emerald-600 p-4 rounded-full animate-bounce">
                  <Check className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                    🌟 Story Compiled Successfully!
                  </h1>
                  <p className="text-slate-500 text-xs">
                    Your interactive storybook titled <span className="font-extrabold text-rose-500">"{storyResult.title}"</span> is ready!
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-2.5 max-w-md mx-auto">
                  <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Adventure Script Generated</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] uppercase font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-750 font-mono">
                      {storyResult.reviewStatus || "Pending Review"}
                    </span>
                    <p className="text-[11.5px] text-slate-600 mt-2 font-serif italic leading-relaxed">
                      "{(storyResult.chapters && storyResult.chapters[0]?.narrativeText) || "Chapter loaded."}"
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-center pt-2">
                  <button
                    onClick={() => {
                      setPrimaryFile(null);
                      setPrimaryPreviewUrl(null);
                      setPrimaryDrawing(null);
                      setSelectedCompanions([]);
                      setStoryResult(null);
                      setStep(1);
                    }}
                    className="py-3 px-6 bg-slate-800 text-white text-xs font-black rounded-2xl hover:bg-slate-900 transition shadow-sm cursor-pointer"
                  >
                    Build Another Storybook!
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
