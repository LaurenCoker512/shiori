"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TTS_VOICES, TTS_SPEAKING_RATE_MIN, TTS_SPEAKING_RATE_MAX } from "@/lib/tts";
import type { TTSVoiceId } from "@/lib/tts";

const SPEAKING_RATE_OPTIONS = [0.75, 1.0, 1.25, 1.5] as const;

interface TTSFormProps {
  hasTTSKey: boolean;
  ttsVoice: string;
  ttsSpeakingRate: number;
}

export function TTSForm({ hasTTSKey, ttsVoice, ttsSpeakingRate }: TTSFormProps) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [keySaved, setKeySaved] = useState(hasTTSKey);
  const [selectedVoice, setSelectedVoice] = useState<string>(ttsVoice);
  const [selectedRate, setSelectedRate] = useState<number>(ttsSpeakingRate);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const body: Record<string, string | number> = {
      tts_voice: selectedVoice,
      tts_speaking_rate: selectedRate,
    };
    if (apiKey.trim() !== "") body.google_tts_api_key = apiKey.trim();

    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setStatus("saved");
      if (apiKey.trim() !== "") setKeySaved(true);
      setApiKey("");
      router.refresh();
    } else {
      const data = (await res.json()) as { error?: string };
      setErrorMessage(data.error ?? "Failed to save");
      setStatus("error");
    }
  }

  const voiceIsValid = (TTS_VOICES as readonly { id: string }[]).some(
    (v) => v.id === selectedVoice,
  );
  const rateIsValid =
    selectedRate >= TTS_SPEAKING_RATE_MIN && selectedRate <= TTS_SPEAKING_RATE_MAX;
  const canSubmit = status !== "saving" && voiceIsValid && rateIsValid;

  const inputStyle: React.CSSProperties = {
    background: "var(--yg-paper-hi)",
    borderColor: "var(--yg-rule)",
    color: "var(--yg-ink)",
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span
            className="font-en text-[14px] font-semibold"
            style={{ color: "var(--yg-ink)" }}
          >
            Google Text-to-Speech
          </span>
          {keySaved && (
            <span
              className="font-en text-[11px] px-2 py-0.5 rounded-full"
              style={{
                background: "var(--yg-known)",
                color: "var(--yg-bamboo-dark)",
              }}
            >
              key saved
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="tts-api-key"
            className="font-en text-[12px] font-medium"
            style={{ color: "var(--yg-ink-soft)" }}
          >
            API Key
          </label>
          <div className="flex gap-2">
            <input
              id="tts-api-key"
              type={keyRevealed ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setStatus("idle");
              }}
              placeholder={keySaved ? "••••••••••••••••" : "AIza…"}
              className="flex-1 font-mono text-[13px] rounded-xl px-4 py-2.5 border outline-none"
              style={inputStyle}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setKeyRevealed((r) => !r)}
              className="font-en text-[12px] px-3 py-2.5 rounded-xl border shrink-0"
              style={{
                borderColor: "var(--yg-rule)",
                background: "var(--yg-paper-hi)",
                color: "var(--yg-ink-soft)",
              }}
              aria-label={keyRevealed ? "Hide TTS API key" : "Reveal TTS API key"}
            >
              {keyRevealed ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span
            className="font-en text-[12px] font-medium"
            style={{ color: "var(--yg-ink-soft)" }}
          >
            Voice
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Voice selection">
            {TTS_VOICES.map((voice) => {
              const isSelected = selectedVoice === voice.id;
              return (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => {
                    setSelectedVoice(voice.id as TTSVoiceId);
                    setStatus("idle");
                  }}
                  className="font-en text-[13px] font-medium px-4 py-2 rounded-full border transition-colors"
                  style={
                    isSelected
                      ? {
                          background: "var(--yg-ink)",
                          color: "var(--yg-paper-hi)",
                          borderColor: "var(--yg-ink)",
                        }
                      : {
                          background: "var(--yg-paper-hi)",
                          color: "var(--yg-ink-soft)",
                          borderColor: "var(--yg-rule)",
                        }
                  }
                  aria-pressed={isSelected}
                >
                  {voice.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span
            className="font-en text-[12px] font-medium"
            style={{ color: "var(--yg-ink-soft)" }}
          >
            Speaking Rate
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Speaking rate selection">
            {SPEAKING_RATE_OPTIONS.map((rate) => {
              const isSelected = selectedRate === rate;
              return (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    setSelectedRate(rate);
                    setStatus("idle");
                  }}
                  className="font-en text-[13px] font-medium px-4 py-2 rounded-full border transition-colors"
                  style={
                    isSelected
                      ? {
                          background: "var(--yg-ink)",
                          color: "var(--yg-paper-hi)",
                          borderColor: "var(--yg-ink)",
                        }
                      : {
                          background: "var(--yg-paper-hi)",
                          color: "var(--yg-ink-soft)",
                          borderColor: "var(--yg-rule)",
                        }
                  }
                  aria-pressed={isSelected}
                >
                  {rate}×
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="font-en text-[13px] font-semibold px-5 py-2.5 rounded-full disabled:opacity-40 transition-opacity"
          style={{
            background: "var(--yg-ink)",
            color: "var(--yg-paper-hi)",
            border: "none",
            cursor: "pointer",
          }}
        >
          {status === "saving" ? "Saving…" : "Save settings"}
        </button>
        {status === "saved" && (
          <span
            className="font-en text-[13px]"
            style={{ color: "var(--yg-bamboo-dark)" }}
          >
            Saved.
          </span>
        )}
        {status === "error" && (
          <span
            role="alert"
            className="font-en text-[13px]"
            style={{ color: "var(--yg-coral-dark)" }}
          >
            {errorMessage}
          </span>
        )}
      </div>
    </form>
  );
}
