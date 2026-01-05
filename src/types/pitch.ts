export interface DiagnosisResult {
  pitch: number;      // API: 440
  stability: number;  // API: 0.93
  score: number;      // API: 85
  message?: string;   // 拡張用
}

export interface PitchData {
  pitch: number | null;
  note: string;
  confidence: number;
}