export interface Drawing {
  _id: string;
  filename: string;
  originalUrl: string;
  processedUrl: string;
  classification: string;
  motionProfile: "swim" | "fly" | "launch" | "bounce";
  createdAt: string;
}

export interface Checkpoint {
  question: string;
  options: string[];
  correctIndex: number;
  correctOption: string;
  distractorOptions: string[];
}

export interface StoryActor {
  drawingId: string;
  processedUrl: string; // The fully qualified URL of the transparent PNG character
  characterName: string;
  role: 'hero' | 'companion' | 'helper';
  scale: number;
  position: { x: number; y: number };
  motionPrompt?: string;
}

export interface Chapter {
  chapterNumber: number;
  narrativeText: string;
  actors: StoryActor[];
  checkpoint: Checkpoint;
}

export interface Story {
  _id: string;
  drawingId: string;
  title: string;
  languageLevel: string;
  backgroundTheme?: 'ocean' | 'forest' | 'space' | 'park';
  chapters: Chapter[];
  reviewStatus: "pending" | "approved" | "rejected";
  teacherNotes: string;
  motionPrompt?: string;
  videoUrl?: string;
  createdAt: string;
}

export type AgeLevel = "Preschool (Ages 3-4)" | "Kindergarten (Ages 5-6)" | "Primary (Ages 7-8)";
export type MotionProfile = "swim" | "fly" | "launch" | "bounce";
export type UserRole = "child" | "teacher";
