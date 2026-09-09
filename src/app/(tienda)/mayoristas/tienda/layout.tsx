"use client";
import { useState, useEffect } from "react";
export default function MayoristaStoreLayout({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"black"|"flash"|"ready">("black");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("flash"), 400);
    const t2 = setTimeout(() => setPhase("ready"), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (<>
    {phase !== "ready" && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none" style={{ transition: "opacity 0.6s ease-out", opacity: 1 }}>
        <div className={`absolute inset-0 transition-all duration-700 ${phase === "black" ? "bg-black" : "bg-black/0"}`} />
        {phase === "flash" && (<>
          <div className="absolute inset-0 bg-violet/20 animate-pulse" />
          <div className="relative flex flex-col items-center animate-fade-up">
            <p className="font-display text-3xl font-extrabold tracking-[0.3em] text-violet-light drop-shadow-[0_0_30px_rgba(168,85,247,0.6)]">MAYORISTAS</p>
            <div className="mt-2 h-0.5 w-32 bg-gradient-to-r from-transparent via-violet to-transparent" />
          </div>
        </>)}
      </div>
    )}
    <div className={`transition-opacity duration-500 ${phase === "ready" ? "opacity-100" : "opacity-0"}`}>{children}</div>
  </>);
}
