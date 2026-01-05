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
    if (isRunning || isPreparing) return;
    
    setError(null);
    setDiagnosis(null);
    setIsPreparing(true);

    try {
      // 1. AudioContextの初期化（既存があれば閉じ、新しく作ることで安定化）
      if (audioContextRef.current) {
        await audioContextRef.current.close();
      }
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      audioContextRef.current = new AudioContextClass();
      
      // 2. エンジンのインスタンス化
      if (!engineRef.current) {
        engineRef.current = new CrepeEngine();
      }

      // 3. マイク起動と解析開始
      await engineRef.current.start(audioContextRef.current, (data: PitchData) => {
        const now = performance.now();
        if (now - lastUpdateTimeRef.current > 33) { // 約30fpsに制限してUI負荷を軽減
          setLatestPitch(data);
          lastUpdateTimeRef.current = now;
        }
      });

      setIsRunning(true);
    } catch (err: any) {
      console.error("Engine Start Error:", err);
      setError("マイクの起動に失敗しました。許可設定を確認してください。");
      setIsRunning(false);
    } finally {
      setIsPreparing(false);
    }
  }, [isRunning, isPreparing]);

  const stop = useCallback(async () => {
    if (!isRunning || !engineRef.current) return;
    
    setIsRunning(false);
    setIsAnalyzing(true);

    try {
      // 1. エンジン停止とサーバー送信
      const res = await engineRef.current.stop();
      setDiagnosis(res);
      
      // 2. AudioContextを確実に閉じてリソース解放
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch (err) {
      console.error("Engine Stop Error:", err);
      setError("解析に失敗しました。");
    } finally {
      setIsAnalyzing(false);
    }
  }, [isRunning]);

  // コンポーネント破棄時に全てをクリーンアップ
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