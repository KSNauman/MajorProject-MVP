import { useState, useEffect, ChangeEvent, DragEvent } from "react";
import { 
  Upload, Sparkles, AlertCircle, Play, RefreshCw, 
  Terminal, ShieldCheck, CheckCircle2, Cpu, Video, 
  HelpCircle, Eye, ChevronRight, Copy, Check, FileVideo
} from "lucide-react";
import { Drawing, Story, AgeLevel } from "../types";

export default function DeapiLab() {
  // Navigation & drawings state
  const [existingDrawings, setExistingDrawings] = useState<Drawing[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string>("");
  const [selectedAgeLevel, setSelectedAgeLevel] = useState<AgeLevel>("Kindergarten (Ages 5-6)");
  
  // Custom uploaded file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragActive, setIsDragActive] = useState<boolean>(false);

  // Custom prompt edit state
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [customVideoUrl, setCustomVideoUrl] = useState<string>("https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4");

  // Loading, progress, and logs
  const [loading, setLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [deapiReport, setDeapiReport] = useState<any>(null);
  const [pollingActive, setPollingActive] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Load existing drawings on mount
  useEffect(() => {
    fetchExistingDrawings();
  }, []);

  // Webhook polling effect
  useEffect(() => {
    if (!pollingActive || !activeStory?._id) return;

    const intervalId = setInterval(async () => {
      try {
        addLog(`Polling story state for '${activeStory._id}' to verify videoUrl...`);
        const res = await fetch(`/api/v1/stories/${activeStory._id}`);
        const data = await res.json();
        
        if (data.success && data.story) {
          const fetchedStory = data.story;
          
          if (fetchedStory.videoUrl) {
            addLog(`🎉 SUCCESS! Webhook completed callback received! Video URL: ${fetchedStory.videoUrl}`);
            setActiveStory(fetchedStory);
            setPollingActive(false);
          } else {
            addLog(`... still waiting for deAPI webhook to update videoUrl (Status: ${fetchedStory.reviewStatus || 'pending'})`);
          }
        }
      } catch (err) {
        console.error("Error during status polling", err);
      }
    }, 4500);

    return () => clearInterval(intervalId);
  }, [pollingActive, activeStory?._id]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const fetchExistingDrawings = async () => {
    try {
      const res = await fetch("/api/v1/drawings");
      const data = await res.json();
      if (data.success) {
        setExistingDrawings(data.drawings || []);
      }
    } catch (err) {
      console.error("Failed to load drawings pool", err);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setupFile(e.target.files[0]);
    }
  };

  const setupFile = (file: File) => {
    setSelectedFile(file);
    setSelectedDrawingId(""); // uploading new file resets specified identifier
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    addLog(`Loaded local image file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setupFile(e.dataTransfer.files[0]);
    }
  };

  // Run the full deAPI animation pipeline
  const handleTriggerTest = async () => {
    if (!selectedFile && !selectedDrawingId) {
      addLog("❌ Error: Please upload an image file or choose an existing drawing.");
      return;
    }

    setLoading(true);
    setLogs([]);
    setDeapiReport(null);
    setActiveStory(null);
    setPollingActive(false);

    addLog("🚀 INITIALIZING GEN-VIDEO PIPELINE LAB TEST...");

    const formData = new FormData();
    if (selectedFile) {
      addLog("Step 1: Uploading brand new raw doodles to server...");
      formData.append("file", selectedFile);
    } else {
      addLog(`Step 1: Referencing selected existing drawing ID: '${selectedDrawingId}'`);
      formData.append("drawingId", selectedDrawingId);
    }

    if (customPrompt.trim()) {
      formData.append("prompt", customPrompt.trim());
    }
    formData.append("languageLevel", selectedAgeLevel);

    try {
      addLog("Step 2: Dispatching pipeline compile trigger request (Running background isolated segmenter + Gemini LLM metadata extraction + deAPI dispatcher)...");
      const res = await fetch("/api/v1/test-deapi-generation", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        addLog("Step 3: Server accepted and processed content successfully!");
        addLog(`Character classification: "${data.classification}"`);
        addLog(`Associated Story ID: "${data.storyId}" - Registered as tracking metadata!`);
        addLog(`Final motion prompt dispatched: "${data.promptUsed}"`);
        
        setDeapiReport(data.deapiReport);

        // Define backing story
        const storyPayload: Story = {
          _id: data.storyId,
          drawingId: data.drawingId,
          title: data.title,
          languageLevel: selectedAgeLevel,
          chapters: [],
          reviewStatus: "approved",
          teacherNotes: "Lab Test",
          videoUrl: "",
          createdAt: new Date().toISOString(),
        };
        setActiveStory(storyPayload);

        if (data.deapiReport?.success) {
          addLog("Step 4: deAPI Animation registered successfully! API returned status Code 200/201.");
          addLog("🔔 Transitioning to Live Webhook Callback Event Listener...");
          setPollingActive(true);
        } else {
          addLog(`⚠️ Step 4: deAPI post dispatch completed, but failed to queue. Server stated: "${data.deapiReport?.error || 'unspecified'}"`);
          if (data.deapiReport?.details) {
            addLog(`Error log response details: ${data.deapiReport.details}`);
          }
        }
      } else {
        addLog(`❌ PIPELINE EXHAUSTED: ${data.error || "Undefined server breakdown"}`);
      }
    } catch (err: any) {
      addLog(`❌ NETWORK EXCEPTION calling test pipeline api: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Simulating webhook feedback locally bypassing actual deAPI webhook dispatch
  const handleSimulateWebhook = async () => {
    if (!activeStory?._id) {
      addLog("❌ Simulation Blocked: Please trigger the generation pipeline first to register a Story ID.");
      return;
    }

    addLog(`🔧 Initiating custom webhook completion callback simulation for Story ID: '${activeStory._id}'...`);
    try {
      const res = await fetch("/api/v1/test-deapi-simulate-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: activeStory._id,
          videoUrl: customVideoUrl,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addLog("✅ Webhook injection succeeded! Simulating payload state change.");
        // Instantly force polling callback to obtain updated story state
        const fetchRes = await fetch(`/api/v1/stories/${activeStory._id}`);
        const fetchData = await fetchRes.json();
        if (fetchData.success && fetchData.story) {
          setActiveStory(fetchData.story);
          setPollingActive(false);
          addLog("🎉 Mock video player loaded successfully.");
        }
      } else {
        addLog(`❌ Webhook simulation failed: ${data.error || "unknown failure"}`);
      }
    } catch (err: any) {
      addLog(`❌ Exception simulating webhook callback: ${err.message || err}`);
    }
  };

  const selectExistingDrawing = (id: string, url: string) => {
    setSelectedDrawingId(id);
    setSelectedFile(null); // resets custom upload
    setImagePreview(`/uploads/processed/${id.startsWith("drw_") ? id.split("_")[1] : id}.png`); // guess path or load as-is
    // Fallback guess processed URL
    const drawingItem = existingDrawings.find(d => d._id === id);
    if (drawingItem) {
      setImagePreview(drawingItem.processedUrl);
    }
    addLog(`Linked test harness to existing drawing record: ${id}`);
  };

  const copyPayloadToClipboard = () => {
    if (!deapiReport?.config?.payload) return;
    navigator.clipboard.writeText(JSON.stringify(deapiReport.config.payload, null, 2));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-6" id="deapi-lab-page">
      
      {/* Intro Header Pane */}
      <div className="col-span-12 bg-white/85 backdrop-blur-md rounded-3xl p-6 border border-rose-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="bg-rose-100 text-rose-600 font-bold px-3 py-1 rounded-full text-[10px] tracking-wider uppercase font-mono">
            🧬 CORE DEVELOPER LAB
          </span>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
            deAPI & Gemini Core AI Diagnostic Board
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl font-medium leading-relaxed">
            Test and audit actual <b>Gemini Story Prompt compilations</b> and <b>deAPI Image-to-Video dispatches</b>. Analyze custom raw payloads, monitor webhook polling trackers, or simulate results.
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Webhook Listener</p>
            <p className="text-xs font-bold text-slate-700 font-mono mt-0.5">/api/v1/webhooks/deapi</p>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-amber-50/50 border border-amber-100 text-center">
            <p className="text-[9px] uppercase tracking-wider font-extrabold text-amber-600">deAPI Engine</p>
            <p className="text-xs font-black text-orange-600 flex items-center gap-1 mt-0.5">
              <span>LTX-Video</span>
            </p>
          </div>
        </div>
      </div>

      {/* LEFT SECTION: Interactive Inputs */}
      <div className="col-span-12 lg:col-span-5 space-y-6">
        
        {/* Panel 1: Image Sourcing Workspace */}
        <div className="bg-white/95 rounded-3xl p-5 border border-rose-100 shadow-md">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 mb-3">
            <Upload className="w-4 h-4 text-rose-500" />
            1. Source Children Drawing
          </h3>

          <div className="space-y-4">
            {/* File drag-drop section */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 ${
                isDragActive
                  ? "border-rose-400 bg-rose-50/50 scale-[0.99]"
                  : "border-slate-300 hover:border-rose-300 bg-slate-50/70"
              }`}
            >
              <input
                type="file"
                id="lab-file-picker"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <label htmlFor="lab-file-picker" className="cursor-pointer block space-y-2">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                  <Upload className="w-4.5 h-4.5 text-slate-400" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-700">Upload new doodle image</p>
                  <p className="text-[10px] text-slate-400 font-medium">JPEG, PNG or SVG up to 10MB</p>
                </div>
              </label>
            </div>

            {/* Splitter */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase font-mono">OR select existing drawing record</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Dropdown drawings list */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono mb-1.5">
                Saved Classroom Drawings Pool ({existingDrawings.length})
              </label>
              {existingDrawings.length === 0 ? (
                <div className="text-center p-2 text-[10px] text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                  No previous drawings recorded. Upload one to begin!
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-100">
                  {existingDrawings.map((drawing) => (
                    <button
                      key={drawing._id}
                      type="button"
                      onClick={() => selectExistingDrawing(drawing._id, drawing.processedUrl)}
                      className={`relative aspect-square rounded-lg overflow-hidden border bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition-all ${
                        selectedDrawingId === drawing._id
                          ? "ring-2 ring-rose-500 scale-95 border-rose-500"
                          : "border-slate-200 hover:opacity-85"
                      }`}
                    >
                      <img
                        src={drawing.processedUrl}
                        alt={drawing.classification}
                        className="w-full h-full object-contain p-1"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white py-0.5 text-center truncate font-extrabold px-0.5">
                        {drawing.classification || "unidentified"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel 2: Tuning Configuration parameters */}
        <div className="bg-white/95 rounded-3xl p-5 border border-rose-100 shadow-md space-y-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-amber-500" />
            2. Configure Pipeline Rules
          </h3>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Custom deAPI Motion Prompt Override
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Leave empty for auto-generated Gemini motions! Or Type: 'A cute character of a dinosaur swimming underwater with bubbles, 3D animated style'"
              rows={3}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-400/50 bg-white placeholder:text-slate-400 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Target Language Level
              </label>
              <select
                value={selectedAgeLevel}
                onChange={(e) => setSelectedAgeLevel(e.target.value as AgeLevel)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-400/50 bg-white shadow-sm font-semibold text-slate-700"
              >
                <option value="Preschool (Ages 3-4)">Preschool (3-4)</option>
                <option value="Kindergarten (Ages 5-6)">Kindergarten (5-6)</option>
                <option value="Primary (Ages 7-8)">Primary (7-8)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Trigger Diagnostic Run
              </label>
              <button
                type="button"
                onClick={handleTriggerTest}
                disabled={loading || (!selectedFile && !selectedDrawingId)}
                className="w-full h-10 font-bold bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all duration-150 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Compile & Dispatch
              </button>
            </div>
          </div>
        </div>

        {/* Panel 3: Live Image Preview */}
        {imagePreview && (
          <div className="bg-white/95 rounded-3xl p-4 border border-rose-100 shadow-md text-center">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Isolated Character Image Preview
            </span>
            <div className="aspect-square w-full max-w-xs mx-auto rounded-2xl border border-slate-200 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] flex items-center justify-center p-4">
              <img
                src={imagePreview}
                alt="Upload preview"
                className="max-h-full max-w-full object-contain drop-shadow"
                referrerPolicy="no-referrer"
              />
            </div>
            {selectedDrawingId && (
              <p className="text-[10px] text-slate-400 font-mono mt-1.5">ID: {selectedDrawingId}</p>
            )}
          </div>
        )}

      </div>

      {/* RIGHT SECTION: Pipeline Outputs & Console Logs */}
      <div className="col-span-12 lg:col-span-7 space-y-6">
        
        {/* Panel A: Console Terminal Viewer */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-lg text-slate-100 flex flex-col font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-green-400" />
              <span className="text-xs font-bold text-slate-300">Lab Diagnostic Pipeline Terminal (stdout)</span>
            </div>
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
            </div>
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-56 min-h-32 text-[10px] leading-relaxed text-slate-300 pr-1 select-text">
            {logs.length === 0 ? (
              <p className="text-slate-500 italic">Console idle. Please supply a doodle and click "Compile & Dispatch" to run the pipeline test checks...</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap font-mono">
                  {log.includes("❌") ? (
                    <span className="text-rose-400 font-bold">{log}</span>
                  ) : log.includes("🎉") || log.includes("✅") ? (
                    <span className="text-emerald-400 font-bold">{log}</span>
                  ) : log.includes("⚠️") || log.includes("...") ? (
                    <span className="text-amber-400">{log}</span>
                  ) : (
                    <span>{log}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel B: deAPI Dispatch Audit Log */}
        {deapiReport && (
          <div className="bg-white/95 rounded-3xl p-5 border border-rose-100 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
                deAPI Live Request Dispatch Audit Info
              </h3>
              <button
                type="button"
                onClick={copyPayloadToClipboard}
                className="text-xs text-slate-500 hover:text-slate-800 p-1 bg-slate-50 rounded-lg flex items-center gap-1 border border-slate-100 transition-all font-semibold font-mono"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Payload
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <p className="text-[10px] uppercase font-extrabold text-slate-400 font-mono">Target Service Endpoint</p>
                <p className="font-semibold text-slate-700 font-mono text-[10.5px] truncate">{deapiReport.config?.apiUrl || "https://api.deapi.com/v1/animations"}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <p className="text-[10px] uppercase font-extrabold text-slate-400 font-mono">Status Result Code</p>
                <div className="flex items-center gap-1.5 font-bold">
                  {deapiReport.success ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-emerald-600">201 DISPATCHED OK</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      <span className="text-rose-600">PIPELINE WARNING</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 rounded-2xl text-[10px] font-mono text-slate-300 max-h-48 overflow-y-auto select-text">
              <p className="text-[9px] uppercase font-bold text-slate-500 mb-1 border-b border-slate-800 pb-1">Registered Dispatch Body Payload:</p>
              <pre>{JSON.stringify(deapiReport.config?.payload || {}, null, 2)}</pre>
            </div>

            <div className="p-3.5 bg-slate-900 rounded-2xl text-[10px] font-mono text-slate-300 max-h-48 overflow-y-auto select-text">
              <p className="text-[9px] uppercase font-bold text-slate-500 mb-1 border-b border-slate-800 pb-1">Raw API JSON Service Response:</p>
              <pre>{JSON.stringify(deapiReport.data || deapiReport.error || {}, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Panel C: Webhook SIMULATION & Status Dashboard */}
        {activeStory && (
          <div className="bg-white/95 rounded-3xl p-5 border border-rose-100 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="space-y-0.5">
                <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wide font-mono">Live Webhook Polling Status Dashboard</h4>
                <p className="text-sm font-black text-slate-800">Tracking Active Story: '{activeStory._id}'</p>
              </div>
              <div className="flex items-center gap-2">
                {pollingActive ? (
                  <span className="flex items-center gap-1 bg-amber-50 text-amber-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-amber-100">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    POLLING CALLBACK...
                  </span>
                ) : activeStory.videoUrl ? (
                  <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-100">
                    <CheckCircle2 className="w-3 M h-3 text-emerald-500" />
                    ANIMATED VIDEO READY
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-slate-50 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-100">
                    WAITING
                  </span>
                )}
              </div>
            </div>

            {/* Video preview / completion screen */}
            {activeStory.videoUrl ? (
              <div className="rounded-2xl border border-rose-100 overflow-hidden bg-slate-950 p-1 flex flex-col justify-center text-center space-y-2">
                <div className="flex items-center gap-1.5 p-2 bg-slate-900 border-b border-slate-800 px-3 text-[10px] font-mono text-emerald-300 font-bold">
                  <Play className="w-3.5 h-3.5 shrink-0 fill-current" />
                  <span>PREVIEW GENERATED deAPI VIDEO ASSET PLAYBACK:</span>
                </div>
                <video
                  src={activeStory.videoUrl}
                  controls
                  loop
                  autoPlay
                  preload="auto"
                  className="w-full h-auto max-h-80 rounded-xl"
                  referrerPolicy="no-referrer"
                />
                <div className="p-3 text-[10px] text-slate-400 font-mono text-left truncate px-4">
                  Fully transparent LTX video url: <a href={activeStory.videoUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline hover:text-emerald-300">{activeStory.videoUrl}</a>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-100 border border-orange-200 text-orange-600 shrink-0">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-800">Testing locally or behind firewall?</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                      deAPI calls standard public webhook endpoints (`/api/v1/webhooks/deapi`) with completed video URLs. If your environment is behind firewalls, deAPI servers cannot contact localhost. 
                      <b> No worries! Inject a simulated successful webhook locally using the bypass tools below.</b>
                    </p>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-200/60 pt-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Simulated Video URL Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customVideoUrl}
                      onChange={(e) => setCustomVideoUrl(e.target.value)}
                      placeholder="Input any MP4 link (e.g. mixkit, public bucket...)"
                      className="flex-grow text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-400/50 bg-white shadow-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSimulateWebhook}
                      className="px-4 py-2 font-bold bg-slate-800 hover:bg-slate-700 active:scale-98 text-white rounded-xl text-xs shrink-0 flex items-center gap-1 shadow transition-all cursor-pointer"
                    >
                      <FileVideo className="w-4 h-4 text-emerald-400" />
                      Mock Webhook Response
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
