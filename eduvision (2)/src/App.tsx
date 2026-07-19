import { useState } from "react";
import RoleSelector from "./components/RoleSelector";
import TeacherPortal from "./components/TeacherPortal";
import DrawingUploader from "./components/DrawingUploader";
import CanvasEraser from "./components/CanvasEraser";
import StoryPlayer from "./components/StoryPlayer";
import SVGFilters from "./components/SVGFilters";
import DeapiLab from "./components/DeapiLab";
import { UserRole, AgeLevel, Story } from "./types";
import { Sparkles, BookOpen, Layers, Laptop, PenTool, Flame } from "lucide-react";

export default function App() {
  const [role, setRole] = useState<UserRole>("child");
  const [childState, setChildState] = useState<"upload" | "eraser" | "generating" | "playroom">("upload");

  // Active asset states
  const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);
  const [activeOriginalUrl, setActiveOriginalUrl] = useState("");
  const [activeProcessedUrl, setActiveProcessedUrl] = useState("");
  const [activeAgeLevel, setActiveAgeLevel] = useState<AgeLevel>("Kindergarten (Ages 5-6)");
  
  // Story result
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [storyLoadingError, setStoryLoadingError] = useState("");

  const handleUploadSuccess = (
    drawingId: string,
    originalUrl: string,
    processedUrl: string,
    ageLevel: AgeLevel
  ) => {
    setActiveDrawingId(drawingId);
    setActiveOriginalUrl(originalUrl);
    setActiveProcessedUrl(processedUrl);
    setActiveAgeLevel(ageLevel);
    setChildState("eraser"); // Transition to Magic Canvas Eraser cleanup
  };

  const handleEraserSuccess = async () => {
    if (!activeDrawingId) return;

    setChildState("generating");
    setStoryLoadingError("");

    try {
      console.log(`Starting story generation request for Drawing ${activeDrawingId} (${activeAgeLevel})`);
      const response = await fetch("/api/v1/stories/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drawingId: activeDrawingId,
          languageLevel: activeAgeLevel,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Construct the full story details
        const storyPayload: Story = {
          _id: data.storyId,
          drawingId: activeDrawingId,
          title: data.title,
          languageLevel: activeAgeLevel,
          chapters: data.chapters,
          reviewStatus: data.reviewStatus || "pending",
          teacherNotes: data.teacherNotes || "",
          createdAt: new Date().toISOString(),
        };

        setCurrentStory(storyPayload);
        
        // Dynamically append the latest saved transparency image url so story starts instantly
        // Append a timestamp to processedUrl to prevent stale browser image caches!
        const cacheBusterUrl = `${data.processedUrl}?t=${Date.now()}`;
        setActiveProcessedUrl(cacheBusterUrl);

        setChildState("playroom");
      } else {
        setStoryLoadingError(data.error || "Failed to parse illustrated narrative drawing lines.");
        setChildState("upload");
      }
    } catch (err) {
      console.error("Story API connection failed", err);
      setStoryLoadingError("Connection error calling Gemini Cog AI services.");
      setChildState("upload");
    }
  };

  const handleRestart = () => {
    setActiveDrawingId(null);
    setActiveOriginalUrl("");
    setActiveProcessedUrl("");
    setCurrentStory(null);
    setStoryLoadingError("");
    setChildState("upload");
  };

  return (
    <div id="edu-app-container" className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-50 via-amber-50 to-emerald-50 text-slate-800 p-4 md:p-6 font-sans">
      <SVGFilters />
      
      {/* Visual Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 mb-4 text-center md:text-left">
        <div>
          <h1 className="font-black text-rose-500 text-3xl md:text-4xl tracking-tight flex items-center justify-center md:justify-start gap-2.5">
            <Sparkles className="text-amber-400 w-8 h-8 animate-spin-slow rotate-12 shrink-0" />
            EduVision
          </h1>
          <p className="text-slate-500 font-medium text-xs mt-1 max-w-lg leading-relaxed">
            Converting physical children's crayon doodles and sketches into 60fps local WASM-isolated 2D characters with interactive reading stories.
          </p>
        </div>

        {/* Global Statistics Indicators */}
        <div className="flex gap-4 p-2 bg-white/50 backdrop-blur-sm rounded-2xl border border-rose-100 shadow-inner">
          <div className="text-center px-4 py-1 border-r border-rose-100">
            <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Class Engine</p>
            <p className="text-sm font-black text-rose-600">Zero-Python</p>
          </div>
          <div className="text-center px-4 py-1">
            <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Core AI LLM</p>
            <p className="text-sm font-black text-amber-600 flex items-center gap-1">
              Gemini 3.5
              <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse fill-red-500" />
            </p>
          </div>
        </div>
      </header>

      {/* Role Picker (Child vs Teacher Dashboard toggle) */}
      <RoleSelector currentRole={role} onChange={setRole} />

      {/* Active Body Views */}
      <main className="max-w-7xl mx-auto py-2">
        {role === "teacher" ? (
          /* Render Teacher Curation Dashboard Dashboard */
          <TeacherPortal />
        ) : role === "deapi-lab" ? (
          /* Render deAPI Diagnostic Laboratory */
          <DeapiLab />
        ) : (
          /* Render Playroom Child Workspaces */
          <div id="playroom-child-frame" className="relative">
            
            {/* Story loading error Banner */}
            {storyLoadingError && (
              <div className="max-w-md mx-auto mb-6 p-4 bg-rose-100 border border-rose-200 text-rose-800 rounded-3xl flex items-center gap-3.5 shadow-sm text-left animate-bounce">
                <span className="text-2xl shrink-0">🧸</span>
                <div>
                  <h4 className="font-bold text-xs">Ouch! Drawing Processing Blocked</h4>
                  <p className="text-[10px] mt-0.5 leading-snug">{storyLoadingError}</p>
                </div>
              </div>
            )}

            {/* Child State router */}
            {childState === "upload" && (
              <DrawingUploader onUploadSuccess={handleUploadSuccess} />
            )}

            {childState === "eraser" && activeDrawingId && (
              <CanvasEraser
                drawingId={activeDrawingId}
                processedUrl={activeProcessedUrl}
                onEraserSuccess={handleEraserSuccess}
              />
            )}

            {childState === "generating" && (
              <div className="max-w-xl mx-auto p-12 bg-white/95 backdrop-blur-md rounded-3xl border border-rose-100 text-center space-y-6 shadow-lg">
                <div className="relative w-20 h-20 mx-auto">
                  {/* Floating magic items */}
                  <div className="absolute top-0 right-0 text-xl animate-bounce">🦄</div>
                  <div className="absolute bottom-0 left-0 text-xl animate-pulse">✨</div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border-4 border-amber-100 border-t-amber-500 animate-spin"></div>
                </div>

                <div>
                  <h3 className="font-black text-slate-800 text-base">Reading Drawing Lines...</h3>
                  <p className="text-slate-500 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Gemini Flash is analyzing your drawing, classifying the character creature, selecting an animation motion curve, and composing an interactive reader!
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold font-mono">
                    <Laptop className="w-3.5 h-3.5 shrink-0" />
                    <span>COG-AI PIPELINE PROGRESSION:</span>
                  </div>
                  <ul className="text-[10px] space-y-1 font-bold text-slate-600">
                    <li className="flex items-center gap-1.5 text-emerald-600">✓ Image segmented locally (zero-GPU WASM)</li>
                    <li className="flex items-center gap-1.5 text-emerald-600">✓ Grid margins cropped & trimmed</li>
                    <li className="flex items-center gap-1.5 text-amber-500 animate-pulse">✦ Generative reading compilation loaded...</li>
                  </ul>
                </div>
              </div>
            )}

            {childState === "playroom" && currentStory && (
              <StoryPlayer
                story={currentStory}
                processedUrl={activeProcessedUrl}
                classification={currentStory.chapters[0] ? currentStory.chapters[0].checkpoint.correctOption.split(" ")[0] || "Isolated Character" : "Character"}
                motionProfile={currentStory.chapters[0] ? (currentStory.chapters.length > 0 ? "swim" : "bounce") : "bounce"}
                ageLevel={activeAgeLevel}
                onRestart={handleRestart}
              />
            )}

          </div>
        )}
      </main>

      {/* Humble Footer */}
      <footer id="app-footer" className="max-w-7xl mx-auto border-t border-slate-200/50 pt-6 mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 text-[11px] font-medium">
        <p className="flex items-center gap-1 justify-center sm:justify-start">
          <span>🎨 Built for pre-primary early childhood comprehensive reading centers</span>
        </p>
        <p className="font-bold font-mono tracking-wider">
          ZERO-PYTHON COGNITIVE capstone framework • PORT: 3000
        </p>
      </footer>
    </div>
  );
}
