import { sendAudioToAPI } from "../apiClient";
import { DiagnosisResult, PitchData } from "../types/pitch";

export class CrepeEngine {
  private running = false;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private detector: any = null;

  private prevPitch: number | null = null;
  private smooth: number | null = null;

  async start(ctx: AudioContext, onResult: (result: PitchData) => void): Promise<void> {
    if (this.running) return;

    this.audioContext = ctx;
    const ml5 = (window as any).ml5;
    if (!ml5) throw new Error("ml5 not loaded");

    try {
      // マイク取得
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.audioContext.createMediaStreamSource(this.stream);

      // モデルのロード（一度ロードされたら detector は使い回す）
      if (!this.detector) {
        this.detector = await ml5.pitchDetection(
          "/model/pitch-detection/crepe/",
          this.audioContext,
          this.stream,
          () => console.log("CREPE model initialized")
        );
      } else {
        // ロード済みの場合はストリームだけを更新する
        // ※ml5の型仕様により再割り当てが効かない場合は再生成されます
        this.detector = await ml5.pitchDetection(
          "/model/pitch-detection/crepe/",
          this.audioContext,
          this.stream
        );
      }

      // レコーダー設定
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: "audio/webm" });
      this.mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.start(1000);

      this.running = true;
      this.loop(onResult);
    } catch (err) {
      this.cleanup();
      throw err;
    }
  }

  private loop(callback: (result: PitchData) => void): void {
    if (!this.running || !this.detector) return;

    this.detector.getPitch((err: any, freq: number) => {
      if (this.running) {
        if (!err && freq) {
          const analyzed = this.analyze(freq);
          if (analyzed) callback(analyzed);
        }
        requestAnimationFrame(() => this.loop(callback));
      }
    });
  }

  async stop(): Promise<DiagnosisResult> {
    const wasRunning = this.running;
    this.running = false;

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !wasRunning) {
        this.cleanup();
        return reject(new Error("No active recording session"));
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.audioChunks, { type: "audio/webm" });
          const base64 = await this.blobToBase64(blob);
          const result = await sendAudioToAPI(base64);
          resolve(result);
        } catch (e) {
          reject(e);
        } finally {
          this.cleanup();
        }
      };
      this.mediaRecorder.stop();
    });
  }

  private cleanup(): void {
    this.running = false;
    
    // ソースの切断
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    // マイクストリームを完全に停止（ブラウザの録音中アイコンを消す）
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.resetAnalyzer();
  }

  private analyze(rawFreq: number): PitchData | null {
    if (!rawFreq) return null;
    if (!this.smooth) this.smooth = rawFreq;
    this.smooth = this.smooth * 0.85 + rawFreq * 0.15;
    const s = this.smooth;

    let confidence = 1;
    if (this.prevPitch) {
      confidence = Math.max(0, 1 - Math.abs(s - this.prevPitch) / this.prevPitch * 5);
    }
    this.prevPitch = s;

    return {
      pitch: s,
      note: CrepeEngine.freqToNote(s),
      confidence: Math.min(1, 0.3 + confidence * 0.7)
    };
  }

  private resetAnalyzer(): void {
    this.prevPitch = null;
    this.smooth = null;
  }

  static freqToNote(freq: number): string {
    if (!freq || freq <= 0) return "--";
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const midi = Math.round(12 * Math.log2(freq / 440) + 69);
    const name = noteNames[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${name}${octave}`;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string | null;
        if (!result) return reject(new Error("Base64 conversion failed"));
        const parts = result.split(",");
        const base64 = parts[1];
        if (!base64) return reject(new Error("Invalid base64 format"));
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}