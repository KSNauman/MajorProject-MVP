import { UserRole } from "../types";
import { BookOpen, ShieldCheck } from "lucide-react";

interface RoleSelectorProps {
  currentRole: UserRole;
  onChange: (role: UserRole) => void;
}

export default function RoleSelector({ currentRole, onChange }: RoleSelectorProps) {
  return (
    <div id="role-selector-container" className="flex items-center justify-between p-4 bg-white/70 backdrop-blur-md border-b border-rose-100 rounded-3xl shadow-sm mb-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-tr from-rose-500 to-amber-400 p-2.5 rounded-2xl shadow-sm text-white">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800 text-sm leading-tight">EduVision Portal</h2>
          <p className="text-xs text-rose-500 font-medium font-sans">Creative Learning Engine</p>
        </div>
      </div>

      <div className="flex gap-1.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
        <button
          id="role-btn-child"
          onClick={() => onChange("child")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 shrink-0 ${
            currentRole === "child"
              ? "bg-white text-rose-500 shadow-sm scale-102"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          🦖 Playroom
        </button>
        <button
          id="role-btn-teacher"
          onClick={() => onChange("teacher")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 shrink-0 ${
            currentRole === "teacher"
              ? "bg-rose-500 text-white shadow-sm scale-102"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Teachers
        </button>
        <button
          id="role-btn-deapi"
          onClick={() => onChange("deapi-lab")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 shrink-0 ${
            currentRole === "deapi-lab"
              ? "bg-indigo-600 text-white shadow-sm scale-102"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          🧬 deAPI Lab
        </button>
      </div>
    </div>
  );
}
