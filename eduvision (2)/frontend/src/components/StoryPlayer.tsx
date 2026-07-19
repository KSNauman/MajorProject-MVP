import { useState, useEffect, useRef } from "react";
import { Chapter, Story, AgeLevel, MotionProfile, StoryActor } from "../types";
import { useSpriteAnimator } from "../hooks/useSpriteAnimator";
import gsap from "gsap";
import { 
  Volume2, VolumeX, ArrowRight, Star, Heart, Award, 
  RotateCcw, Sparkles, AlertCircle, RefreshCw, ChevronRight, Play, Pause, ChevronLeft
} from "lucide-react";

/**
 * Task E: Local Asset Resolution (Asset URL Swapper)
 * Resolves static relative image/video paths locally on backend (localhost:8000/3000)
 * rather than passing traffic through the slower ngrok secure tunnel.
 */
export function resolveAssetUrl(urlPath: string | undefined): string {
  if (!urlPath) return "";
  if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) {
    return urlPath;
  }
  const cleanPath = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
  
  // Use VITE_API_URL if configured, otherwise default to "http://localhost:8000" or same origin
  const meta = import.meta as any;
  const apiHost = (meta.env && meta.env.VITE_API_URL) || "http://localhost:8000";
  return `${apiHost}${cleanPath}`;
}

interface ActorSpriteProps {
  actor: StoryActor;
  narrativeText: string;
  triggerKey: number;
  motionProfile: MotionProfile;
  videoUrl?: string; // deAPI processed video (Task B)
}

function ActorSprite({ actor, narrativeText, triggerKey, motionProfile, videoUrl }: ActorSpriteProps) {
  const spriteRef = useRef<HTMLDivElement | null>(null);
  const { playJump, playWave, playHover } = useSpriteAnimator(spriteRef);
  const hasVideo = actor.role === "hero" && videoUrl;

  useEffect(() => {
    // Only trigger default GSAP CSS transforms if we are NOT playing a rich deAPI MP4 video
    if (hasVideo) return;

    playHover();

    const lowerText = narrativeText.toLowerCase();
    const isHero = actor.role === "hero";
    const delayMs = isHero ? 600 : 1200;

    const timer = setTimeout(() => {
      if (
        lowerText.includes("jump") ||
        lowerText.includes("hop") ||
        lowerText.includes("bounce")
      ) {
        playJump();
      } else if (
        lowerText.includes("wave") ||
        lowerText.includes("say hello") ||
        lowerText.includes("hello") ||
        lowerText.includes("wiggle")
      ) {
        playWave();
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [narrativeText, triggerKey, actor.role, hasVideo]);

  return (
    <div 
      ref={spriteRef}
      className="relative w-36 h-36 flex items-center justify-center p-1"
      style={{ filter: hasVideo ? undefined : "url(#wave-displacement)" }}
    >
      {hasVideo ? (
        <video
          src={resolveAssetUrl(videoUrl)}
          autoPlay
          loop
          muted
          playsInline
          className="max-h-full max-w-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.25)] rounded-2xl border-2 border-white/40 shadow-md"
          referrerPolicy="no-referrer"
        />
      ) : (
        <img
          src={resolveAssetUrl(actor.processedUrl)}
          alt={actor.characterName}
          className="max-h-full max-w-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.25)]"
          draggable={false}
          referrerPolicy="no-referrer"
        />
      )}
      
      {/* Visual thrust fire trail for launching profile of hero */}
      {actor.role === "hero" && motionProfile === "launch" && (
        <div className="absolute bottom-[-18px] left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none">
          <div className="w-3.5 h-8 bg-amber-400 rounded-full animate-pulse opacity-80 filter blur-[1px]"></div>
          <div className="w-2 h-5.5 bg-red-500 rounded-full animate-bounce mt-[-8px] opacity-90"></div>
        </div>
      )}

      {/* Neat clean label showing actor's name/species description */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur border border-slate-200/65 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-tight text-slate-600 shadow-sm whitespace-nowrap opacity-90 transition-opacity">
        {actor.characterName} <span className="text-[7.5px] uppercase font-black px-1 rounded bg-slate-100 text-slate-500 ml-0.5">{actor.role}</span>
      </div>
    </div>
  );
}

interface StoryPlayerProps {
  story: Story;
  processedUrl: string;
  classification: string;
  motionProfile: MotionProfile;
  ageLevel: AgeLevel;
  onRestart: () => void;
}

export default function StoryPlayer({
  story,
  processedUrl,
  classification,
  motionProfile,
  ageLevel,
  onRestart,
}: StoryPlayerProps) {
  // Task A: Declare currentPageIndex & isNarrating
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isNarrating, setIsNarrating] = useState(false);
  
  // Voice Speed & Audio Mute (Task C)
  const [voiceSpeed, setVoiceSpeed] = useState<"normal" | "slow">("normal");
  const [isMuted, setIsMuted] = useState(false);

  // Task D: Timeout Monitor & Automatic Local Fallback
  const [isVideoTimedOut, setIsVideoTimedOut] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState(story.videoUrl);

  useEffect(() => {
    if (!story.videoUrl) {
      const timer = setTimeout(() => {
        setIsVideoTimedOut(true);
        console.log("[StoryPlayer] Video generation timed out or offline, falling back to static 2D GSAP animations.");
      }, 12000); // 12 seconds
      
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/v1/stories/${story._id}`);
          const data = await res.json();
          if (data.success && data.story && data.story.videoUrl) {
            setCurrentVideoUrl(data.story.videoUrl);
            clearInterval(pollInterval);
            clearTimeout(timer);
          }
        } catch (err) {
          console.error("Poller failed:", err);
        }
      }, 2500);

      return () => {
        clearTimeout(timer);
        clearInterval(pollInterval);
      };
    } else {
      setCurrentVideoUrl(story.videoUrl);
      setIsVideoTimedOut(false);
    }
  }, [story._id, story.videoUrl]);

  // Quiz answered statuses
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizSuccess, setQuizSuccess] = useState<boolean | null>(null);
  const [childPoints, setChildPoints] = useState(0);
  const [totalStarsAwarded, setTotalStarsAwarded] = useState(0);

  const currentChapter = story.chapters[currentPageIndex];
  const ttsUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Reference for smoothly animating transitions
  const actorContainersRef = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const hasCheckpoint = currentChapter && currentChapter.checkpoint && currentChapter.checkpoint.question;

  // Derive active actors for active chapter/page with fallback
  const activeActors = currentChapter?.actors && currentChapter.actors.length > 0
    ? currentChapter.actors
    : [
        {
          drawingId: story.drawingId || "hero_legacy",
          processedUrl: processedUrl,
          characterName: classification || "My Doodle",
          role: "hero" as const,
          scale: 1.0,
          position: { x: 50, y: 60 }
        }
      ];

  // Map choices to branching options (Task A.3 & Task D.3)
  const mappedOptions = hasCheckpoint ? currentChapter.checkpoint.options.map((optionText, idx) => {
    const isCorrect = idx === currentChapter.checkpoint.correctIndex;
    // Correct selection jumps forward; distractor selection can branch/stay or loop previous route 
    const targetPageNumber = isCorrect 
      ? (currentPageIndex + 1) 
      : (currentPageIndex === 0 ? 0 : currentPageIndex - 1);
    return {
      text: optionText,
      targetPageNumber,
      isCorrect,
      originalIndex: idx
    };
  }) : [];

  // Smoothly transition actor coordinates when active chapter updates (Task B)
  useEffect(() => {
    activeActors.forEach((actor) => {
      const el = actorContainersRef.current[actor.drawingId];
      if (el) {
        gsap.to(el, {
          left: `${actor.position.x}%`,
          top: `${actor.position.y}%`,
          duration: 0.6,
          ease: "power2.out",
        });
      }
    });

    const currentIds = new Set(activeActors.map((a) => a.drawingId));
    Object.keys(actorContainersRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        delete actorContainersRef.current[id];
      }
    });
  }, [currentPageIndex, activeActors]);

  // Task C: Auto trigger Speech Narration when page index transitions
  useEffect(() => {
    stopNarration();
    const timer = setTimeout(() => {
      startNarration();
    }, 500);
    return () => {
      clearTimeout(timer);
      stopNarration();
    };
  }, [currentPageIndex]);

  // Sync vocal speed changes
  useEffect(() => {
    if (isNarrating) {
      startNarration();
    }
  }, [voiceSpeed]);

  const startNarration = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel(); // Cancel active speech

    if (isMuted || !currentChapter) return;

    const textToSpeak = `${story.title}. Chapter ${currentChapter.chapterNumber}. ${currentChapter.narrativeText}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    const voices = window.speechSynthesis.getVoices();
    const kidFriendlyVoice = voices.find(
      (v) => v.lang.startsWith("en") && 
      (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Zira") || v.name.includes("Samantha"))
    );
    if (kidFriendlyVoice) {
      utterance.voice = kidFriendlyVoice;
    }
    
    // Configure voice speed (Task C.3)
    utterance.rate = voiceSpeed === "slow" ? 0.70 : 0.95;
    utterance.pitch = 1.15; // Child attention frequency

    utterance.onstart = () => setIsNarrating(true);
    utterance.onend = () => setIsNarrating(false);
    utterance.onerror = () => setIsNarrating(false);

    ttsUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopNarration = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsNarrating(false);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      stopNarration();
    } else {
      setTimeout(() => startNarration(), 100);
    }
  };

  // State Navigation Logic (Task A.2)
  const handleNextPage = () => {
    if (currentPageIndex < story.chapters.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
      setSelectedOptionIndex(null);
      setQuizAnswered(false);
      setQuizSuccess(null);
    } else {
      setCurrentPageIndex(999); // celebration
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
      setSelectedOptionIndex(null);
      setQuizAnswered(false);
      setQuizSuccess(null);
    }
  };

  // Branching Decisions (Task A.3)
  const handleChoiceSelection = (targetPageNumber: number) => {
    const targetIdx = Math.max(0, Math.min(story.chapters.length - 1, targetPageNumber));
    setCurrentPageIndex(targetIdx);
    
    // Clear checkpoint local selections
    setSelectedOptionIndex(null);
    setQuizAnswered(false);
    setQuizSuccess(null);
  };

  const handleSelectOption = (index: number) => {
    if (quizAnswered || !currentChapter) return;
    setSelectedOptionIndex(index);
    setQuizAnswered(true);

    const isCorrect = index === currentChapter.checkpoint.correctIndex;
    setQuizSuccess(isCorrect);

    if (isCorrect) {
      setChildPoints((p) => p + 100);
      setTotalStarsAwarded((s) => s + 3);
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.24); // G5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.45);
      } catch (_) {}
    } else {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch (_) {}
    }
  };

  // Background Theme mapping (Task B.1)
  const renderStageSetting = () => {
    const rawTheme = story.backgroundTheme || '';
    let themeToUse = rawTheme;

    if (!['ocean', 'forest', 'space', 'park'].includes(rawTheme)) {
      if (motionProfile === "swim") {
        themeToUse = "ocean";
      } else if (motionProfile === "launch") {
        themeToUse = "space";
      } else if (motionProfile === "fly") {
        themeToUse = "park";
      } else {
        themeToUse = "park";
      }
    }

    switch (themeToUse) {
      case "ocean":
        return {
          title: "Coral Reef Bay Setting",
          backdropClass: "bg-gradient-to-b from-cyan-400 to-blue-600",
          effects: (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute bottom-[-20px] left-1/4 w-4 h-4 bg-white/20 rounded-full animate-[bubble_4s_infinite_ease-in]"></div>
              <div className="absolute bottom-[-20px] left-2/4 w-6 h-6 bg-white/15 rounded-full animate-[bubble_6s_infinite_ease-in_0.5s]"></div>
              <div className="absolute bottom-[-20px] left-3/4 w-3 h-3 bg-white/25 rounded-full animate-[bubble_5s_infinite_ease-in_1.2s]"></div>
              <div className="absolute top-0 right-0 left-0 h-10 bg-gradient-to-b from-sky-300/40 to-transparent"></div>
              <div className="absolute bottom-4 left-6 text-3xl opacity-50 animate-bounce">🐠</div>
              <div className="absolute bottom-2 right-8 text-2xl opacity-40">🦀</div>
            </div>
          )
        };

      case "space":
        return {
          title: "Cosmic Star Sector Setting",
          backdropClass: "bg-gradient-to-b from-slate-900 via-indigo-950 to-violet-900",
          effects: (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-12 left-1/5 text-slate-100 text-xs animate-[pulse_1s_infinite]">★</div>
              <div className="absolute top-24 left-3/4 text-slate-100 text-sm animate-[pulse_1.5s_infinite_0.4s]">★</div>
              <div className="absolute top-8 left-2/3 text-amber-200 text-xs animate-[pulse_2s_infinite_1s]">✦</div>
              <div className="absolute top-2/3 left-10 text-white/30 text-2xl animate-spin">🛸</div>
              <div className="absolute bottom-8 right-12 text-white/30 text-3xl">🪐</div>
            </div>
          )
        };

      case "forest":
        return {
          title: "Deep Redwood Forest Setting",
          backdropClass: "bg-gradient-to-b from-emerald-800 via-teal-900 to-amber-950",
          effects: (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-8 left-12 text-emerald-400 text-3xl animate-pulse">🌲</div>
              <div className="absolute top-16 right-16 text-emerald-300 text-4xl animate-pulse delay-700">🌲</div>
              <div className="absolute bottom-4 left-1/3 text-xl opacity-60">🍄</div>
              <div className="absolute bottom-5 right-11 text-lg opacity-50 animate-bounce">🐿️</div>
            </div>
          )
        };

      case "park":
      default:
        return {
          title: "Summer Play Grass Hills Setting",
          backdropClass: "bg-gradient-to-b from-sky-200 to-emerald-250",
          effects: (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-6 left-6 text-yellow-350 text-4xl animate-spin-slow">☀️</div>
              <div className="absolute top-1/3 right-1/4 text-sm animate-bounce">🦋</div>
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-emerald-500/10 rounded-t-full"></div>
              <div className="absolute bottom-5 left-10 text-xl opacity-60">🌻</div>
              <div className="absolute bottom-4 right-10 text-lg opacity-50">🌷</div>
            </div>
          )
        };
    }
  };

  const stage = renderStageSetting();

  // Celebration Finished Screen
  if (currentPageIndex === 999) {
    return (
      <div id="story-celebration-root" className="max-w-2xl mx-auto p-6 bg-white/95 rounded-3xl border border-rose-100 shadow-lg text-center font-sans space-y-6">
        <div className="py-6">
          <div className="inline-block bg-amber-100 text-amber-600 p-4 rounded-full animate-bounce mb-3 shadow-sm">
            <Award className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            🎉 Magical Storybook Complete!
          </h2>
          <p className="text-slate-500 text-xs max-w-md mx-auto mt-1 leading-relaxed">
            Congratulations! You've completed the story of{" "}
            <span className="font-extrabold text-rose-500">{classification}</span> and cruised all paths!
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex flex-col items-center justify-center">
            <span className="text-2xl">💫</span>
            <span className="font-mono font-black text-2xl text-rose-600 mt-1">+{childPoints}</span>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase">Interactive Points</span>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col items-center justify-center">
            <span className="text-2xl">⭐</span>
            <span className="font-mono font-black text-2xl text-amber-600 mt-1">{totalStarsAwarded}</span>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase">Comprehension Stars</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-4 border border-slate-100 max-w-sm mx-auto">
          <p className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-2 font-mono">
            Protagonist Canvas
          </p>
          <div className="w-24 h-24 bg-white rounded-xl border border-rose-100 p-1 flex items-center justify-center overflow-hidden">
            <img 
              src={resolveAssetUrl(processedUrl)} 
              alt="isolated final child drawing" 
              className="max-h-full max-w-full object-contain animate-pulse" 
              referrerPolicy="no-referrer" 
            />
          </div>
          <span className="text-xs font-black text-slate-700 capitalize mt-2">{classification}</span>
        </div>

        {story.teacherNotes && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-left max-w-md mx-auto">
            <h5 className="font-bold text-xs text-emerald-800 flex items-center gap-1">
              👩‍🏫 Teacher Notes:
            </h5>
            <p className="text-[11px] text-emerald-700 mt-1 italic leading-relaxed">
              "{story.teacherNotes}"
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={onRestart}
            className="bg-slate-800 hover:bg-slate-900 border border-slate-300 text-white font-black text-xs px-6 py-3 rounded-2xl flex items-center gap-2 transition hover:scale-102 cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Animate Another Drawing!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="story-player-root" className="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-7xl mx-auto px-4 py-2 font-sans items-start">
      
      {/* Dialogue & Comprehension Area (Col 7) */}
      <div className="md:col-span-7 space-y-4 flex flex-col justify-between h-[680px]">
        
        {/* Story Header */}
        <div className="bg-white/80 p-4 rounded-3xl border border-rose-100 shadow-sm flex items-center justify-between text-left">
          <div>
            <span className="text-[10px] font-bold uppercase text-rose-500 tracking-wider">
              Page {currentPageIndex + 1} of {story.chapters.length} • Grade Level
            </span>
            <h3 className="font-black text-slate-800 text-sm tracking-tight leading-none mt-1">
              {story.title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Standard manual Forward/Backward bounds checking (Task A.2) */}
            <button
              id="manual-prev-page"
              disabled={currentPageIndex === 0}
              onClick={handlePrevPage}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 rounded-xl transition cursor-pointer disabled:cursor-not-allowed"
              title="Go Back 1 page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              id="manual-next-page"
              disabled={hasCheckpoint && !quizSuccess}
              onClick={handleNextPage}
              className="p-2 bg-slate-800 text-white hover:bg-slate-900 text-white disabled:opacity-30 rounded-xl transition cursor-pointer disabled:cursor-not-allowed"
              title="Go Forward 1 page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Narrative Script Card */}
        <div className="bg-white/90 p-6 rounded-3xl border border-slate-150 shadow-sm flex-1 flex flex-col justify-between text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-8 h-8 bg-slate-100 border-l border-b border-slate-200 rounded-bl-xl shadow-sm"></div>

          <div>
            <span className="text-[10px] bg-rose-50 text-rose-600 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono animate-pulse">
              Interactive Storybook
            </span>
            <p className="text-sm md:text-base text-slate-800 leading-relaxed font-serif tracking-wide italic mt-4 border-l-4 border-amber-400 pl-3">
              "{currentChapter.narrativeText}"
            </p>
          </div>

          {/* Subtitle Sync Indicator */}
          {isNarrating && (
            <div className="flex items-center gap-1 mt-4 pl-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase font-mono animate-pulse mr-1">Voice playing:</span>
              <div className="w-1 bg-rose-500 h-3 rounded-full animate-[voice-bar_0.8s_infinite_ease-in-out_0.1s]"></div>
              <div className="w-1 bg-amber-500 h-4.5 rounded-full animate-[voice-bar_0.8s_infinite_ease-in-out_0.2s]"></div>
              <div className="w-1 bg-rose-500 h-2 rounded-full animate-[voice-bar_0.8s_infinite_ease-in-out_0.3s]"></div>
            </div>
          )}
        </div>

        {/* Dynamic Static Checkpoint Bottom Card (Fallback when Quiz solved) */}
        <div className="bg-white/90 p-5 rounded-3xl border border-rose-100 shadow-sm text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest pl-1 font-mono">
              💡 Reading Checkpoint Status
            </span>
            <span className="text-[10px] font-bold text-slate-500">Score: {childPoints}pts</span>
          </div>

          <h4 className="font-extrabold text-slate-800 text-xs mb-3 pl-1 leading-snug">
            {currentChapter.checkpoint.question}
          </h4>

          {quizSuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-amber-400 text-transparent animate-spin-slow shrink-0" />
                <span className="text-xs font-bold text-emerald-800">
                  Checkpoint Solved! Path unlocked successfully! (+3 Stars)
                </span>
              </div>
              <button
                onClick={handleNextPage}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase px-3.5 py-1.5 rounded-xl ml-4 cursor-pointer"
              >
                Continue
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic pl-1 leading-relaxed">
              Complete the decision overlay over the theater scene to steer the adventure route!
            </p>
          )}
        </div>

      </div>

      {/* 2D Theater Scene Stage (Col 5) */}
      <div className="md:col-span-5 flex flex-col gap-4">
        
        {/* Animated Theater Box */}
        <div id="theater-stage-box" className="p-2.5 bg-slate-100 rounded-3xl border border-slate-200 shadow-inner">
          <div className={`relative ${stage.backdropClass} rounded-2xl h-[480px] w-full overflow-hidden shadow-md border border-slate-300`}>
            
            {/* Setting Title Tags */}
            <div className="absolute top-3 left-3 bg-black/35 backdrop-blur-sm px-2.5 py-1 rounded-lg text-white font-mono text-[9px] uppercase tracking-wider font-bold shrink-0 z-10">
              {stage.title}
            </div>

            {!currentVideoUrl && !isVideoTimedOut && (
              <div className="absolute top-3 right-3 bg-black/45 backdrop-blur-xs px-2.5 py-1 rounded-lg text-white/90 font-mono text-[8px] uppercase tracking-wider font-bold shrink-0 z-15 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-400" />
                <span>Brewing Video (Local fallback in 12s)...</span>
              </div>
            )}

            {/* Stage Special Effects */}
            {stage.effects}

            {/* Stage Characters (Actor placement) */}
            <div className="absolute inset-0 overflow-visible rounded-2xl pointer-events-none z-10">
              {activeActors.map((actor) => (
                <div
                  key={actor.drawingId}
                  ref={(el) => {
                    actorContainersRef.current[actor.drawingId] = el;
                  }}
                  className="absolute select-none group pointer-events-auto"
                  style={{
                    left: `${actor.position.x}%`,
                    top: `${actor.position.y}%`,
                    transform: `scale(${actor.scale}) translate(-50%, -50%)`,
                    transformOrigin: "center center",
                    transition: "transform 0.3s ease",
                  }}
                >
                  <ActorSprite
                    actor={actor}
                    narrativeText={currentChapter?.narrativeText || ""}
                    triggerKey={currentPageIndex}
                    motionProfile={motionProfile}
                    videoUrl={(actor.role === "hero" && !isVideoTimedOut) ? currentVideoUrl : undefined}
                  />
                </div>
              ))}
            </div>

            {/* Task C.3: Child-Friendly Subtitle Dialogue Box Over the Stage */}
            <div id="stage-subtitles-box" className="absolute bottom-12 left-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3 shadow-lg z-20 flex flex-col gap-1.5 pointer-events-auto">
              <p className="text-[11px] md:text-xs font-bold text-slate-800 leading-snug font-serif text-center italic">
                "{currentChapter?.narrativeText}"
              </p>
              
              <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 shrink-0">
                <span className="text-[8px] font-black uppercase text-rose-500 font-mono tracking-wider">
                  Narration Controls
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={toggleMute}
                    className={`p-1 rounded-lg border text-xs flex items-center gap-0.5 transition cursor-pointer ${
                      isMuted
                        ? "bg-slate-50 border-slate-200 text-slate-400"
                        : "bg-rose-50 border-rose-100 text-rose-600"
                    }`}
                  >
                    {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    <span className="text-[9px] font-bold">{isMuted ? "Unmute" : "Mute"}</span>
                  </button>

                  <button
                    id="toggle-voice-speed-btn"
                    onClick={() => setVoiceSpeed((s) => (s === "normal" ? "slow" : "normal"))}
                    className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-bold rounded-lg border border-slate-200 transition flex items-center cursor-pointer"
                  >
                    <span>Speed: <span className="text-rose-500 font-black capitalize">{voiceSpeed}</span></span>
                  </button>

                  <button
                    id="replay-voice-btn"
                    onClick={startNarration}
                    className="px-1.5 py-1 bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Replay</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Task D: Interactive Choice Overlay (Branching Checkpoint Modal Overlay) */}
            {hasCheckpoint && !quizSuccess && (
              <div id="checkpoint-modal-overlay" className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-4 text-center pointer-events-auto">
                <div className="bg-white rounded-2xl p-4.5 max-w-sm w-full border-2 border-amber-300 shadow-2xl space-y-3">
                  <div className="inline-block bg-amber-50 text-amber-500 px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider font-mono">
                    💡 Branching Decision Route
                  </div>
                  
                  <h3 className="font-extrabold text-slate-800 text-[11px] leading-snug">
                    {currentChapter.checkpoint.question}
                  </h3>

                  <div className="space-y-1.5 pt-1">
                    {mappedOptions.map((opt, idx) => {
                      const colors = [
                        "from-rose-450 to-rose-550 hover:from-rose-500 hover:to-rose-600 ring-rose-250 text-rose-50",
                        "from-amber-450 to-amber-550 hover:from-amber-500 hover:to-amber-600 ring-amber-250 text-amber-50",
                        "from-teal-450 to-teal-550 hover:from-teal-550 hover:to-teal-600 ring-teal-250 text-teal-100",
                        "from-sky-450 to-sky-550 hover:from-sky-550 hover:to-sky-600 ring-sky-250 text-sky-50"
                      ];
                      const colorClass = colors[idx % colors.length];

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            // Run the standard choice response triggers
                            handleSelectOption(opt.originalIndex);
                            // Direct branching transitions (Task D.3)
                            setTimeout(() => {
                              handleChoiceSelection(opt.targetPageNumber);
                            }, 1100);
                          }}
                          className={`w-full py-2.5 px-3 rounded-xl bg-gradient-to-tr ${colorClass} font-black text-[10px] transition duration-200 hover:scale-101 shadow-sm cursor-pointer text-left flex items-center justify-between gap-1`}
                        >
                          <span>{opt.text}</span>
                          <span className="bg-white/10 text-[7px] uppercase px-1 py-0.5 rounded shrink-0">
                            Path {idx + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[8.5px] text-slate-400 font-bold leading-none">
                    Select a path! Correct answers advance; distractors branch other ways!
                  </p>
                </div>
              </div>
            )}

            {/* Chapter status indicator dots */}
            <div className="absolute bottom-3 right-3 flex gap-0.5 bg-black/40 backdrop-blur-sm p-1 rounded-md z-10">
              {story.chapters.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === currentPageIndex 
                      ? "bg-amber-400 w-3" 
                      : idx < currentPageIndex 
                      ? "bg-emerald-400" 
                      : "bg-white/40"
                  }`}
                />
              ))}
            </div>

          </div>
        </div>

        {/* Character info panel */}
        <div className="p-4 bg-white/80 rounded-3xl border border-rose-100 shadow-sm text-left flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-55 bg-amber-50 p-2.5 rounded-xl text-amber-500 font-extrabold uppercase text-xs border border-amber-200">
              ⭐ {totalStarsAwarded} Stars
            </div>
            <div>
              <h5 className="font-extrabold text-slate-800 text-xs capitalize leading-none">
                {classification}
              </h5>
              <p className="text-[10px] text-slate-500 mt-1">
                Active Motion: <span className="font-mono bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-bold capitalize">{motionProfile} profile</span>
              </p>
            </div>
          </div>

          <button
            onClick={onRestart}
            className="text-[10px] bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-slate-600 font-black px-3 py-1.5 rounded-xl transition cursor-pointer shadow-inner"
          >
            ↩ Re-draw Character
          </button>
        </div>

      </div>

    </div>
  );
}
