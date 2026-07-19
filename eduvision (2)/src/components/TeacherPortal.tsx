import { useState, useEffect } from "react";
import { Drawing, Story } from "../types";
import { 
  ShieldCheck, Check, X, Bookmark, Edit2, Trash2, 
  Eye, FileText, AlertCircle, RefreshCw, Layers 
} from "lucide-react";

export default function TeacherPortal() {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingTitle, setEditingTitle] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const drawingsRes = await fetch("/api/v1/drawings");
      const storiesRes = await fetch("/api/v1/stories");
      
      const drawingsData = await drawingsRes.json();
      const storiesData = await storiesRes.json();

      if (drawingsData.success) setDrawings(drawingsData.drawings);
      if (storiesData.success) setStories(storiesData.stories);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (storyId: string, status: "pending" | "approved" | "rejected") => {
    try {
      const res = await fetch(`/api/v1/stories/${storyId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: status }),
      });
      const data = await res.json();
      if (data.success) {
        setStories((prev) => prev.map((s) => (s._id === storyId ? data.story : s)));
        if (selectedStory && selectedStory._id === storyId) {
          setSelectedStory(data.story);
        }
      }
    } catch (err) {
      console.error("Failed to moderate story status", err);
    }
  };

  const handleSaveNotes = async (storyId: string) => {
    try {
      const res = await fetch(`/api/v1/stories/${storyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherNotes: editingNotes, title: editingTitle }),
      });
      const data = await res.json();
      if (data.success) {
        setStories((prev) => prev.map((s) => (s._id === storyId ? data.story : s)));
        setSelectedStory(data.story);
        alert("Teacher changes saved successfully!");
      }
    } catch (err) {
      console.error("Failed to update custom notes", err);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!confirm("Are you sure you want to delete this story?")) return;
    try {
      const res = await fetch(`/api/v1/stories/${storyId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setStories((prev) => prev.filter((s) => s._id !== storyId));
        if (selectedStory?._id === storyId) {
          setSelectedStory(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete story", err);
    }
  };

  const handleDeleteDrawing = async (drawingId: string) => {
    if (!confirm("Deleting this drawing will also delete its associated stories. Proceed?")) return;
    try {
      const res = await fetch(`/api/v1/drawings/${drawingId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDrawings((prev) => prev.filter((d) => d._id !== drawingId));
        setStories((prev) => prev.filter((s) => s.drawingId !== drawingId));
        if (selectedStory?.drawingId === drawingId) {
          setSelectedStory(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete drawing", err);
    }
  };

  const filteredStories = stories.filter((s) => {
    if (filter === "all") return true;
    return s.reviewStatus === filter;
  });

  return (
    <div id="teacher-portal-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto px-4 py-2 font-sans">
      
      {/* Sidebar: Dashboard stats & story index */}
      <div className="lg:col-span-5 bg-white/90 rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col h-[750px]">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <ShieldCheck className="text-rose-500 w-5 h-5 animate-pulse" />
              Moderation Pipeline
            </h3>
            <p className="text-xs text-slate-500">Approve and edit stories before child access</p>
          </div>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition duration-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 mb-4 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          {(["all", "pending", "approved", "rejected"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`flex-1 py-1 rounded-lg capitalize transition ${
                filter === item 
                  ? "bg-white text-rose-500 shadow-sm" 
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              {item === "all" ? "All Stories" : item}
            </button>
          ))}
        </div>

        {/* Story submission list */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
          {filteredStories.length === 0 ? (
            <div className="text-center py-10">
              <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No stories found matching your filter.</p>
            </div>
          ) : (
            filteredStories.map((story) => {
              const linkedDrawing = drawings.find((d) => d._id === story.drawingId);
              return (
                <div
                  key={story._id}
                  onClick={() => {
                    setSelectedStory(story);
                    setEditingNotes(story.teacherNotes || "");
                    setEditingTitle(story.title || "");
                  }}
                  className={`p-3.5 rounded-2xl cursor-pointer border transition-all duration-200 text-left ${
                    selectedStory?._id === story._id
                      ? "bg-rose-50 border-rose-200 ring-2 ring-rose-50"
                      : "bg-slate-50/50 hover:bg-slate-50 border-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Character thumbnail preview */}
                    <div className="w-11 h-11 bg-amber-50 rounded-xl border border-rose-100 overflow-hidden flex items-center justify-center p-0.5 relative shrink-0">
                      {linkedDrawing ? (
                        <img 
                          src={linkedDrawing.processedUrl} 
                          alt="Drawing preview" 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Layers className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          ID: {story._id}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          story.reviewStatus === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : story.reviewStatus === "rejected"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {story.reviewStatus}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-700 text-xs truncate mt-0.5">
                        {story.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Target Level: {story.languageLevel}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Panel: Side-by-side comparison, story details, notes editing */}
      <div className="lg:col-span-7 flex flex-col h-[750px]">
        {selectedStory ? (
          <div className="bg-white/90 rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col h-full overflow-y-auto scrollbar-thin">
            
            {/* Story Header */}
            <div className="flex flex-col md:flex-row items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-rose-50 text-rose-500 font-bold px-2 py-0.5 rounded-lg">
                    {selectedStory.languageLevel}
                  </span>
                </div>
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="font-black text-slate-800 text-lg tracking-tight mt-1 focus:ring-1 focus:ring-rose-200 outline-none p-1 rounded border border-slate-100 w-full md:w-[320px]"
                />
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  Linked Drawing ID: {selectedStory.drawingId}
                </p>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-1.5 w-full md:w-auto justify-end">
                <button
                  onClick={() => handleUpdateStatus(selectedStory._id, "approved")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedStory.reviewStatus === "approved"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedStory._id, "rejected")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedStory.reviewStatus === "rejected"
                      ? "bg-rose-500 text-white shadow-sm"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
                <button
                  onClick={() => handleDeleteStory(selectedStory._id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                  title="Delete Story"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawing Preview & Extraction Metadata */}
            <div className="bg-slate-50 rounded-2xl p-4 my-4 border border-slate-100 grid grid-cols-2 gap-4 text-left">
              <div>
                <h5 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Bookmark className="w-3 h-3 text-amber-500" />
                  Drawing Original vs Processed
                </h5>
                <div className="flex gap-2">
                  {(() => {
                    const linked = drawings.find((d) => d._id === selectedStory.drawingId);
                    if (!linked) return <div className="text-xs text-slate-400">Loading asset files...</div>;
                    return (
                      <>
                        <div className="flex-1 h-24 bg-white border border-slate-200 rounded-xl overflow-hidden relative flex items-center justify-center">
                          <img 
                            src={linked.originalUrl} 
                            alt="Original sketch" 
                            className="max-h-full max-w-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute bottom-1 left-1 font-bold text-[8px] px-1 py-0.5 rounded bg-slate-800/60 text-white">Original</span>
                        </div>
                        <div className="flex-1 h-24 bg-white border border-rose-200 rounded-xl overflow-hidden relative flex items-center justify-center p-1">
                          <img 
                            src={linked.processedUrl} 
                            alt="WASM Segmented drawing" 
                            className="max-h-full max-w-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute bottom-1 left-1 font-bold text-[8px] px-1 py-0.5 rounded bg-rose-800/60 text-white">WASM Isolated</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div>
                <h5 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-2">
                  AI Segmented Properties
                </h5>
                {(() => {
                  const linked = drawings.find((d) => d._id === selectedStory.drawingId);
                  if (!linked) return <p className="text-xs text-slate-400 italic">No drawing links</p>;
                  return (
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium font-sans">AI Class Classification: </span>
                        <span className="text-slate-700 font-bold capitalize">{linked.classification}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium font-sans">GSAP Motion Profile: </span>
                        <span className="text-slate-700 font-bold capitalize font-mono bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">
                          {linked.motionProfile}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteDrawing(linked._id)}
                        className="text-[10px] text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 mt-3"
                      >
                        <Trash2 className="w-3 h-3" /> Remove Asset & Cleanup
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Chapters / script overview */}
            <div className="flex-1 space-y-4 pr-1">
              <h5 className="font-bold text-xs text-slate-600 uppercase tracking-wide text-left mb-2">
                Curation Story Chapters Draft
              </h5>
              
              {selectedStory.chapters.map((ch, idx) => (
                <div key={idx} className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 text-left text-xs">
                  <div className="font-bold text-rose-500 mb-1">
                    📖 Chapter {ch.chapterNumber}
                  </div>
                  <p className="text-slate-700 italic leading-relaxed font-serif">
                    "{ch.narrativeText}"
                  </p>
                  
                  {/* Checkpoint */}
                  {ch.checkpoint && (
                    <div className="mt-2 pt-2 border-t border-slate-100 pl-2 bg-rose-50/30 rounded-xl max-w-lg">
                      <div className="font-bold text-slate-600 font-mono text-[10px]">
                        COMPREHENSION QUIZ:
                      </div>
                      <p className="font-bold text-slate-700 mt-0.5">
                        Q: {ch.checkpoint.question}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {ch.checkpoint.options.map((opt, oIdx) => (
                          <span
                            key={oIdx}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                              oIdx === ch.checkpoint.correctIndex
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-white border-slate-200 text-slate-500"
                            }`}
                          >
                            {opt} {oIdx === ch.checkpoint.correctIndex ? "✓" : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Teacher Notes edit form */}
            <div className="pt-4 border-t border-slate-100 flex flex-col gap-2 mt-4 text-left">
              <label className="font-bold text-xs text-slate-600">
                Teacher Notes & Educational Goals Guidance:
              </label>
              <textarea
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="Add pedagogical feedback, correct spellings, or class notes here..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-400 bg-slate-50/50"
              />
              <button
                onClick={() => handleSaveNotes(selectedStory._id)}
                className="self-end bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-1.5 rounded-xl text-xs transition duration-200 mt-1 shadow-sm"
              >
                Save Teacher Notes & Updates
              </button>
            </div>

          </div>
        ) : (
          <div className="bg-white/95 rounded-3xl p-10 border border-slate-100 shadow-sm flex flex-col items-center justify-center h-full">
            <ShieldCheck className="w-16 h-16 text-rose-200 mb-3 animate-pulse" />
            <h4 className="font-black text-slate-700 text-base">Select a Story Draft</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1 text-center">
              Please click any child submission card from the left panel index to inspect segmented original images, edit titles, verify quizzes, and add pedagogical notes.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
