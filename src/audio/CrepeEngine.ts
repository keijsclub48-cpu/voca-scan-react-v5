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
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.audioContext.createMediaStreamSource(this.stream);

      // モデルのロード完了まで Promise で待機
      await new Promise<void>((resolve, reject) => {
        this.detector = ml5.pitchDetection(
          "/model/pitch-detection/crepe/",
          this.audioContext,
          this.stream,
          () => {
            console.log("CREPE model loaded and ready");
            resolve();
          }
        );
        // タイムアウト設定（10秒以上かかる場合は異常とみなす）
        setTimeout(() => reject(new Error("Model load timeout")), 10000);
      });

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
        return reject(new Error("No active session"));
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
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
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
    //     係数の設定例	動きの印象	メリット / デメリット
    // 0.80 / 0.20	キビキビ動く	反応は速いが、数値が細かく震えやすい
    // 0.85 / 0.15	標準的（現在）	歌声に対して程よい追従性がある
    // 0.90 / 0.10	ゆったり	滑らかに見えるが、音程を変えた時に少し遅れて数値がついてくる
    // 0.95 / 0.05	かなりヌルヌル	非常に安定するが、素早いビブラートなどは捉えきれなくなる
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
        if (!result) return reject(new Error("Base64 error"));
        const parts = result.split(",");
        const base64 = parts[1];
        if (!base64) return reject(new Error("Invalid format"));
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}