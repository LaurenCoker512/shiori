"use client";

import { useState } from "react";

const SUPPORTED_MODELS: { id: string; label: string }[] = [
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
];

interface ApiKeyFormProps {
  hasOpenRouterKey: boolean;
  openrouterModel: string;
  useLlmParsing: boolean;
}

export function ApiKeyForm({
  hasOpenRouterKey,
  openrouterModel,
  useLlmParsing,
}: ApiKeyFormProps) {
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openrouterKeyRevealed, setOpenrouterKeyRevealed] = useState(false);
  const [selectedModel, setSelectedModel] = useState(openrouterModel);
  const [llmParsing, setLlmParsing] = useState(useLlmParsing);
  const [openrouterKeySaved, setOpenrouterKeySaved] =
    useState(hasOpenRouterKey);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const body: Record<string, string | boolean> = {
      openrouter_model: selectedModel.trim(),
      use_llm_parsing: llmParsing,
    };
    if (openrouterKey.trim() !== "")
      body.openrouter_api_key = openrouterKey.trim();

    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setStatus("saved");
      if (openrouterKey.trim() !== "") setOpenrouterKeySaved(true);
      setOpenrouterKey("");
    } else {
      const data = (await res.json()) as { error?: string };
      setErrorMessage(data.error ?? "Failed to save");
      setStatus("error");
    }
  }

  const openrouterKeyValid =
    openrouterKey === "" || openrouterKey.trim().startsWith("sk-or-");
  const modelIsValid = SUPPORTED_MODELS.some((m) => m.id === selectedModel);
  const canSubmit = status !== "saving" && openrouterKeyValid && modelIsValid;

  const inputStyle: React.CSSProperties = {
    background: "var(--yg-paper-hi)",
    borderColor: "var(--yg-rule)",
    color: "var(--yg-ink)",
  };

  const invalidInputStyle: React.CSSProperties = {
    ...inputStyle,
    borderColor: "var(--yg-coral-dark)",
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span
            className="font-en text-[14px] font-semibold"
            style={{ color: "var(--yg-ink)" }}
          >
            OpenRouter
          </span>
          {openrouterKeySaved && (
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
            htmlFor="openrouter-key"
            className="font-en text-[12px] font-medium"
            style={{ color: "var(--yg-ink-soft)" }}
          >
            API Key
          </label>
          <div className="flex gap-2">
            <input
              id="openrouter-key"
              type={openrouterKeyRevealed ? "text" : "password"}
              value={openrouterKey}
              onChange={(e) => {
                setOpenrouterKey(e.target.value);
                setStatus("idle");
              }}
              placeholder={
                openrouterKeySaved ? "••••••••••••••••" : "sk-or-v1-…"
              }
              className="flex-1 font-mono text-[13px] rounded-xl px-4 py-2.5 border outline-none"
              style={openrouterKeyValid ? inputStyle : invalidInputStyle}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setOpenrouterKeyRevealed((r) => !r)}
              className="font-en text-[12px] px-3 py-2.5 rounded-xl border shrink-0"
              style={{
                borderColor: "var(--yg-rule)",
                background: "var(--yg-paper-hi)",
                color: "var(--yg-ink-soft)",
              }}
              aria-label={
                openrouterKeyRevealed
                  ? "Hide OpenRouter API key"
                  : "Reveal OpenRouter API key"
              }
            >
              {openrouterKeyRevealed ? "Hide" : "Show"}
            </button>
          </div>
          {!openrouterKeyValid && (
            <p
              className="font-en text-[12px]"
              style={{ color: "var(--yg-coral-dark)" }}
            >
              Key must start with <span className="font-mono">sk-or-</span>.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span
            className="font-en text-[12px] font-medium"
            style={{ color: "var(--yg-ink-soft)" }}
          >
            Model
          </span>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Model selection"
          >
            {SUPPORTED_MODELS.map((model) => {
              const isSelected = selectedModel === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    setSelectedModel(model.id);
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
                  {model.label}
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
            Parsing
          </span>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={llmParsing}
                disabled={!openrouterKeySaved}
                onChange={e => { setLlmParsing(e.target.checked); setStatus("idle"); }}
                aria-label="Use LLM for word boundary parsing"
              />
              <div
                className="w-10 h-6 rounded-full transition-colors"
                style={{
                  background: llmParsing && openrouterKeySaved ? "var(--yg-ink)" : "var(--yg-rule)",
                  opacity: openrouterKeySaved ? 1 : 0.4,
                }}
              />
              <div
                className="absolute top-1 left-1 w-4 h-4 rounded-full transition-transform"
                style={{
                  background: "var(--yg-paper-hi)",
                  transform: llmParsing && openrouterKeySaved ? "translateX(16px)" : "translateX(0)",
                }}
              />
            </div>
            <div>
              <div className="font-en text-[13px]" style={{ color: openrouterKeySaved ? "var(--yg-ink)" : "var(--yg-ink-soft)" }}>
                Use LLM for word boundary parsing
              </div>
              <div className="font-en text-[11px]" style={{ color: "var(--yg-ink-soft)" }}>
                {openrouterKeySaved
                  ? "Slower but more accurate segmentation. Re-parse texts after changing."
                  : "Requires an OpenRouter API key."}
              </div>
            </div>
          </label>
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
