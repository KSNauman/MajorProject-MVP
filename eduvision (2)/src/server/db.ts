import fs from "fs";
import path from "path";

export interface Drawing {
  _id: string;
  filename: string;
  originalUrl: string;
  processedUrl: string;
  classification: string;
  motionProfile: string;
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
  processedUrl: string;
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
  backgroundTheme: 'ocean' | 'forest' | 'space' | 'park';
  chapters: Chapter[];
  reviewStatus: "pending" | "approved" | "rejected";
  teacherNotes: string;
  motionPrompt?: string;
  videoUrl?: string;
  deapiRequestId?: string;
  createdAt: string;
}

const DB_FILE = path.join(process.cwd(), "data", "db.json");

interface DBStructure {
  drawings: Drawing[];
  stories: Story[];
}

function ensureDB() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ drawings: [], stories: [] }, null, 2), "utf-8");
  }
}

function readDB(): DBStructure {
  ensureDB();
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read database file, returning default structure", err);
    return { drawings: [], stories: [] };
  }
}

function writeDB(db: DBStructure) {
  ensureDB();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write database file", err);
  }
}

export const dbService = {
  // Drawings Collection
  async findDrawings(): Promise<Drawing[]> {
    const db = readDB();
    return db.drawings;
  },

  async findDrawingById(id: string): Promise<Drawing | null> {
    const db = readDB();
    return db.drawings.find((d) => d._id === id) || null;
  },

  async createDrawing(drawing: Omit<Drawing, "_id" | "createdAt">): Promise<Drawing> {
    const db = readDB();
    const newDrawing: Drawing = {
      ...drawing,
      _id: "drw_" + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    db.drawings.push(newDrawing);
    writeDB(db);
    return newDrawing;
  },

  // Stories Collection
  async findStories(): Promise<Story[]> {
    const db = readDB();
    return db.stories;
  },

  async findStoryById(id: string): Promise<Story | null> {
    const db = readDB();
    return db.stories.find((s) => s._id === id) || null;
  },

  async createStory(story: Omit<Story, "_id" | "createdAt">): Promise<Story> {
    const db = readDB();
    const newStory: Story = {
      ...story,
      _id: "sty_" + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    db.stories.push(newStory);
    writeDB(db);
    return newStory;
  },

  async updateStory(id: string, updates: Partial<Story>): Promise<Story | null> {
    const db = readDB();
    const index = db.stories.findIndex((s) => s._id === id);
    if (index === -1) return null;
    const updated = { ...db.stories[index], ...updates };
    db.stories[index] = updated;
    writeDB(db);
    return updated;
  },
  
  async deleteStory(id: string): Promise<boolean> {
    const db = readDB();
    const len = db.stories.length;
    db.stories = db.stories.filter((s) => s._id !== id);
    writeDB(db);
    return db.stories.length < len;
  },

  async deleteDrawing(id: string): Promise<boolean> {
    const db = readDB();
    const len = db.drawings.length;
    db.drawings = db.drawings.filter((d) => d._id !== id);
    // Also cleanup linked stories
    db.stories = db.stories.filter((s) => s.drawingId !== id);
    writeDB(db);
    return db.drawings.length < len;
  }
};
