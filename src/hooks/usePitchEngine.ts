import { useRef, useState, useEffect, useCallback } from "react";
import { CrepeEngine } from "../audio/CrepeEngine";
import { PitchData, DiagnosisResult } from "../types/pitch";

export function usePitchEngine() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<CrepeEngine | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  const [isRunning, setIsRunning] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [latestPitch, setLatestPitch] = useState<PitchData | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (isRunning || isPreparing || isAnalyzing) return;
    
    setError(null);
    setDiagnosis(null);
    setIsPreparing(true); // 起動中表示スタート

    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close();
      }
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      audioContextRef.current = new AudioContextClass();
      
      if (!engineRef.current) {
        engineRef.current = new CrepeEngine();
      }

      // エンジンの開始（モデルロード完了まで await される）
      await engineRef.current.start(audioContextRef.current, (data: PitchData) => {
        const now = performance.now();
        if (now - lastUpdateTimeRef.current > 33) {
          setLatestPitch(data);
          lastUpdateTimeRef.current = now;
        }
      });

      // すべての準備が整ってからフラグを更新
      setIsRunning(true);
    } catch (err: any) {
      console.error("Engine Start Error:", err);
      setError("マイクまたはモデルの起動に失敗しました。");
      setIsRunning(false);
    } finally {
      setIsPreparing(false); // ここで「診断スタート」から「停止」にボタンが切り替わる
    }
  }, [isRunning, isPreparing, isAnalyzing]);

  const stop = useCallback(async () => {
    if (!isRunning || isAnalyzing || !engineRef.current) return;
    
    setIsAnalyzing(true);
    // 停止した瞬間に表示を初期化
    setLatestPitch({ pitch: 0, note: "--", confidence: 0 });

    try {
      const res = await engineRef.current.stop();
      setDiagnosis(res);
      
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch (err) {
      console.error("Engine Stop Error:", err);
      setError("解析に失敗しました。");
    } finally {
      setIsRunning(false); 
      setIsAnalyzing(false);
    }
  }, [isRunning, isAnalyzing]);

  useEffect(() => {
    return () => {
      engineRef.current?.stop().catch(() => {});
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isRunning,
    isPreparing,
    isAnalyzing,
    pitch: latestPitch?.pitch ?? 0,
    note: latestPitch?.note ?? "--",
    confidence: latestPitch?.confidence ?? 0,
    diagnosis,
    error,
    start,
    stop,
  };
}