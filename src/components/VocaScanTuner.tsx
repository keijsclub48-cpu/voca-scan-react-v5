import React, { useState } from "react";
import { usePitchEngine } from "../hooks/usePitchEngine";

const VocaScanTuner: React.FC = () => {
  const [sessionInfo] = useState(() => {
    const query = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return {
      userId: query.get("userId") || "guest_user",
      sessionId: query.get("sessionId") || "direct_access",
    };
  });

  const hubUrl = import.meta.env.DEV 
    ? "http://localhost:5173" 
    : "https://app.voca-nical.com";

  const { 
    isRunning, 
    isPreparing, 
    isAnalyzing, 
    pitch, 
    note, 
    confidence, 
    diagnosis, 
    error, 
    start, 
    stop 
  } = usePitchEngine();

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 relative overflow-hidden border border-gray-100">
        <div className="absolute top-0 left-0 right-0 px-8 py-1.5 bg-gray-50 flex justify-between text-[9px] text-gray-400 font-mono border-b border-gray-100/50">
          <span>UID: {sessionInfo.userId}</span>
          <span>SID: {sessionInfo.sessionId.slice(0, 8)}...</span>
        </div>

        <header className="text-center mb-8 mt-4">
          <h1 className="text-3xl font-black text-blue-600 italic tracking-tighter">VocaScan Tuner V5</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Professional Pitch Analyzer</p>
        </header>

        {/* ピッチ表示エリア：非稼働時は値をリセットして表示 */}
        <div className={`rounded-3xl p-10 text-center mb-8 transition-all duration-500
          ${isRunning ? "bg-blue-50 ring-8 ring-blue-50/50 scale-105" : "bg-gray-50"}`}>
          <div className="text-7xl font-mono font-black text-slate-800 tracking-tighter">
            {isRunning ? (note || "---") : "---"}
          </div>
          <div className="text-xl text-blue-500 font-bold mt-2">
            {isRunning && pitch ? `${pitch.toFixed(1)} Hz` : "--- Hz"}
          </div>
          <div className="mt-6 h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${isRunning ? (confidence * 100).toFixed(0) : 0}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase">
            Confidence: {isRunning ? (confidence * 100).toFixed(0) : 0}%
          </p>
        </div>

        <div className="space-y-4">
          {!isRunning ? (
            <button 
              onClick={start} 
              disabled={isPreparing}
              className={`w-full py-5 rounded-2xl font-black text-xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3
                ${isPreparing 
                  ? "bg-slate-400 cursor-not-allowed text-white" 
                  : "bg-slate-900 text-white hover:bg-black"}`}
            >
              {isPreparing && (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isPreparing ? "マイクを起動中..." : "診断スタート"}
            </button>
          ) : (
            <button 
              onClick={stop} 
              disabled={isAnalyzing} 
              className={`w-full py-5 rounded-2xl font-black text-xl text-white transition-all shadow-xl
                ${isAnalyzing ? "bg-gray-400 cursor-not-allowed" : "bg-red-500 hover:bg-red-600 animate-pulse active:scale-95"}`}
            >
              {isAnalyzing ? "解析中…" : "停止して解析"}
            </button>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-gray-100">
          {isAnalyzing && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-center text-blue-500 font-bold text-sm">データを解析しています…</p>
            </div>
          )}
          
          {error && <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center text-red-500 font-bold text-sm">{error}</div>}

          {diagnosis && !error && !isAnalyzing && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 text-center">
              <div className="p-6 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-3xl text-white shadow-lg shadow-blue-200">
                <p className="text-[10px] font-bold uppercase opacity-70 tracking-widest">Total Score</p>
                <div className="text-6xl font-black tracking-tighter">{diagnosis.score}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Pitch Avg</p>
                  <p className="text-xl font-black text-slate-700">{diagnosis.pitch.toFixed(1)}<span className="text-xs ml-1">Hz</span></p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Stability</p>
                  <p className="text-xl font-black text-slate-700">{(diagnosis.stability * 100).toFixed(0)}<span className="text-xs ml-1">%</span></p>
                </div>
              </div>
            </div>
          )}

          {!diagnosis && !isAnalyzing && !error && (
            <p className="text-center text-slate-300 text-xs font-medium">※停止ボタンを押すと、ここに詳細な診断結果が表示されます</p>
          )}
          
          <div className="mt-10 text-center">
            <a href={hubUrl} className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-400 hover:text-blue-600 transition-all group tracking-widest">
              <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              APPS HUB に戻る
            </a>
          </div>
        </div>
      </div>
      <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">© 2026 Voca-nical Apps</p>
    </div>
  );
};

export default VocaScanTuner;