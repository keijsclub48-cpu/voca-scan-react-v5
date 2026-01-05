// src/apiClient.ts
import { DiagnosisResult } from "./types/pitch";

export async function sendAudioToAPI(base64Audio: string): Promise<DiagnosisResult> {

  // ★ ここが「先頭」です
  console.log("API BASE:", import.meta.env.VITE_API_BASE);
  console.log("API KEY:", import.meta.env.VITE_API_KEY);

  const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_API_KEY}`,
    },
    body: JSON.stringify({ audio: base64Audio }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  return res.json();
}
