'use client';

import { useState } from 'react';

const SUPPORTED_MODELS: { id: string; label: string }[] = [
  { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
];

interface ApiKeyFormProps {
  hasOpenRouterKey: boolean;
  openrouterModel: string;
}

export function ApiKeyForm({ hasOpenRouterKey, openrouterModel }: ApiKeyFormProps) {
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [openrouterKeyRevealed, setOpenrouterKeyRevealed] = useState(false);
  const [selectedModel, setSelectedModel] = useState(openrouterModel);
  const [openrouterKeySaved, setOpenrouterKeySaved] = useState(hasOpenRouterKey);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setErrorMessage('');

    const body: Record<string, string> = { openrouter_model: selectedModel.trim() };
    if (openrouterKey.trim() !== '') body.openrouter_api_key = openrouterKey.trim();

    const res = await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setStatus('saved');
      if (openrouterKey.trim() !== '') setOpenrouterKeySaved(true);
      setOpenrouterKey('');
    } else {
      const data = await res.json() as { error?: string };
      setErrorMessage(data.error ?? 'Failed to save');
      setStatus('error');
    }
  }

  const openrouterKeyValid = openrouterKey === '' || openrouterKey.trim().startsWith('sk-or-');
  const modelIsValid = SUPPORTED_MODELS.some(m => m.id === selectedModel);
  const canSubmit = status !== 'saving' && openrouterKeyValid && modelIsValid;

  const inputStyle: React.CSSProperties = {
    background: 'var(--yg-paper-hi)',
    borderColor: 'var(--yg-rule)',
    color: 'var(--yg-ink)',
  };

  const invalidInputStyle: React.CSSProperties = {
    ...inputStyle,
    borderColor: 'var(--yg-coral-dark)',
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="font-en text-[14px] font-semibold" style={{ color: 'var(--yg-ink)' }}>
            OpenRouter
          </span>
          {openrouterKeySaved && (
            <span
              className="font-en text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'var(--yg-known)', color: 'var(--yg-bamboo-dark)' }}
            >
              key saved
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="openrouter-key" className="font-en text-[12px] font-medium" style={{ color: 'var(--yg-ink-soft)' }}>
            API Key
          </label>
          <div className="flex gap-2">
            <input
              id="openrouter-key"
              type={openrouterKeyRevealed ? 'text' : 'password'}
              value={openrouterKey}
              onChange={e => { setOpenrouterKey(e.target.value); setStatus('idle'); }}
              placeholder={openrouterKeySaved ? '••••••••••••••••' : 'sk-or-v1-…'}
              className="flex-1 font-mono text-[13px] rounded-xl px-4 py-2.5 border outline-none"
              style={openrouterKeyValid ? inputStyle : invalidInputStyle}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setOpenrouterKeyRevealed(r => !r)}
              className="font-en text-[12px] px-3 py-2.5 rounded-xl border shrink-0"
              style={{ borderColor: 'var(--yg-rule)', background: 'var(--yg-paper-hi)', color: 'var(--yg-ink-soft)' }}
              aria-label={openrouterKeyRevealed ? 'Hide OpenRouter API key' : 'Reveal OpenRouter API key'}
            >
              {openrouterKeyRevealed ? 'Hide' : 'Show'}
            </button>
          </div>
          {!openrouterKeyValid && (
            <p className="font-en text-[12px]" style={{ color: 'var(--yg-coral-dark)' }}>
              Key must start with <span className="font-mono">sk-or-</span>.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-en text-[12px] font-medium" style={{ color: 'var(--yg-ink-soft)' }}>
            Model
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Model selection">
            {SUPPORTED_MODELS.map(model => {
              const isSelected = selectedModel === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => { setSelectedModel(model.id); setStatus('idle'); }}
                  className="font-en text-[13px] font-medium px-4 py-2 rounded-full border transition-colors"
                  style={isSelected
                    ? { background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', borderColor: 'var(--yg-ink)' }
                    : { background: 'var(--yg-paper-hi)', color: 'var(--yg-ink-soft)', borderColor: 'var(--yg-rule)' }
                  }
                  aria-pressed={isSelected}
                >
                  {model.label}
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
          style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
        >
          {status === 'saving' ? 'Saving…' : 'Save settings'}
        </button>
        {status === 'saved' && (
          <span className="font-en text-[13px]" style={{ color: 'var(--yg-bamboo-dark)' }}>
            Saved.
          </span>
        )}
        {status === 'error' && (
          <span role="alert" className="font-en text-[13px]" style={{ color: 'var(--yg-coral-dark)' }}>
            {errorMessage}
          </span>
        )}
      </div>
    </form>
  );
}
