'use client';

import { useState } from 'react';

const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-4-6',        label: 'Claude Sonnet 4.6',  note: 'balanced' },
  { id: 'claude-opus-4-7',          label: 'Claude Opus 4.7',    note: 'most capable' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  note: 'fastest' },
] as const;

interface ApiKeyFormProps {
  hasAnthropicKey: boolean;
  hasOpenRouterKey: boolean;
  currentProvider: 'anthropic' | 'openrouter';
  anthropicModel: string;
  openrouterModel: string;
}

export function ApiKeyForm({
  hasAnthropicKey,
  hasOpenRouterKey,
  currentProvider,
  anthropicModel,
  openrouterModel,
}: ApiKeyFormProps) {
  const [provider, setProvider] = useState<'anthropic' | 'openrouter'>(currentProvider);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [anthropicKeyRevealed, setAnthropicKeyRevealed] = useState(false);
  const [selectedAnthropicModel, setSelectedAnthropicModel] = useState(anthropicModel);
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [openrouterKeyRevealed, setOpenrouterKeyRevealed] = useState(false);
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useState(openrouterModel);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setErrorMessage('');

    const body: Record<string, string> = { ai_provider: provider };

    if (anthropicKey.trim() !== '') body.anthropic_api_key = anthropicKey.trim();
    body.anthropic_model = selectedAnthropicModel;

    if (openrouterKey.trim() !== '') body.openrouter_api_key = openrouterKey.trim();
    if (selectedOpenRouterModel.trim() !== '') body.openrouter_model = selectedOpenRouterModel.trim();

    const res = await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setStatus('saved');
      setAnthropicKey('');
      setOpenrouterKey('');
    } else {
      const data = await res.json() as { error?: string };
      setErrorMessage(data.error ?? 'Failed to save');
      setStatus('error');
    }
  }

  const anthropicKeyValid = anthropicKey === '' || anthropicKey.trim().startsWith('sk-ant-');
  const openrouterKeyValid = openrouterKey === '' || openrouterKey.trim().startsWith('sk-or-');
  const canSubmit = status !== 'saving' && anthropicKeyValid && openrouterKeyValid;

  const inputStyle = (invalid: boolean): React.CSSProperties => ({
    background: 'var(--yg-paper-hi)',
    borderColor: invalid ? 'var(--yg-coral-dark)' : 'var(--yg-rule)',
    color: 'var(--yg-ink)',
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Provider selector */}
      <div className="flex flex-col gap-2">
        <span className="font-en text-[13px] font-medium" style={{ color: 'var(--yg-ink)' }}>
          Active provider
        </span>
        <div
          className="flex gap-1 p-1 rounded-full self-start"
          style={{ background: 'rgba(42, 36, 28, 0.05)' }}
        >
          {(['anthropic', 'openrouter'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { setProvider(p); setStatus('idle'); }}
              className="font-en text-[13px] px-4 py-1.5 rounded-full transition-all"
              style={{
                background: provider === p ? '#fff' : 'transparent',
                boxShadow: provider === p ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                color: provider === p ? '#2c2a28' : 'var(--yg-ink-soft)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: provider === p ? 600 : 500,
              }}
            >
              {p === 'anthropic' ? 'Anthropic' : 'OpenRouter'}
            </button>
          ))}
        </div>
      </div>

      <div
        className="h-px w-full"
        style={{ background: 'var(--yg-rule)' }}
        aria-hidden="true"
      />

      {/* Anthropic section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="font-en text-[14px] font-semibold" style={{ color: 'var(--yg-ink)' }}>
            Anthropic
          </span>
          {hasAnthropicKey && (
            <span
              className="font-en text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'var(--yg-known)', color: 'var(--yg-bamboo-dark)' }}
            >
              key saved
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="anthropic-key" className="font-en text-[12px] font-medium" style={{ color: 'var(--yg-ink-soft)' }}>
            API Key
          </label>
          <div className="flex gap-2">
            <input
              id="anthropic-key"
              type={anthropicKeyRevealed ? 'text' : 'password'}
              value={anthropicKey}
              onChange={e => { setAnthropicKey(e.target.value); setStatus('idle'); }}
              placeholder={hasAnthropicKey ? '••••••••••••••••' : 'sk-ant-api03-…'}
              className="flex-1 font-mono text-[13px] rounded-xl px-4 py-2.5 border outline-none"
              style={inputStyle(!anthropicKeyValid)}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setAnthropicKeyRevealed(r => !r)}
              className="font-en text-[12px] px-3 py-2.5 rounded-xl border shrink-0"
              style={{ borderColor: 'var(--yg-rule)', background: 'var(--yg-paper-hi)', color: 'var(--yg-ink-soft)' }}
              aria-label={anthropicKeyRevealed ? 'Hide Anthropic API key' : 'Reveal Anthropic API key'}
            >
              {anthropicKeyRevealed ? 'Hide' : 'Show'}
            </button>
          </div>
          {!anthropicKeyValid && (
            <p className="font-en text-[12px]" style={{ color: 'var(--yg-coral-dark)' }}>
              Key must start with <span className="font-mono">sk-ant-</span>.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="anthropic-model" className="font-en text-[12px] font-medium" style={{ color: 'var(--yg-ink-soft)' }}>
            Model
          </label>
          <select
            id="anthropic-model"
            value={selectedAnthropicModel}
            onChange={e => { setSelectedAnthropicModel(e.target.value); setStatus('idle'); }}
            className="font-en text-[13px] rounded-xl px-4 py-2.5 border outline-none appearance-none"
            style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)', color: 'var(--yg-ink)' }}
          >
            {ANTHROPIC_MODELS.map(m => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.note}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="h-px w-full"
        style={{ background: 'var(--yg-rule)' }}
        aria-hidden="true"
      />

      {/* OpenRouter section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="font-en text-[14px] font-semibold" style={{ color: 'var(--yg-ink)' }}>
            OpenRouter
          </span>
          {hasOpenRouterKey && (
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
              placeholder={hasOpenRouterKey ? '••••••••••••••••' : 'sk-or-v1-…'}
              className="flex-1 font-mono text-[13px] rounded-xl px-4 py-2.5 border outline-none"
              style={inputStyle(!openrouterKeyValid)}
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
          <label htmlFor="openrouter-model" className="font-en text-[12px] font-medium" style={{ color: 'var(--yg-ink-soft)' }}>
            Model
          </label>
          <input
            id="openrouter-model"
            type="text"
            value={selectedOpenRouterModel}
            onChange={e => { setSelectedOpenRouterModel(e.target.value); setStatus('idle'); }}
            placeholder="anthropic/claude-sonnet-4-6"
            className="font-mono text-[13px] rounded-xl px-4 py-2.5 border outline-none"
            style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)', color: 'var(--yg-ink)' }}
            spellCheck={false}
          />
          <p className="font-en text-[11px]" style={{ color: 'var(--yg-ink-muted)' }}>
            Any model ID from openrouter.ai/models, e.g.{' '}
            <span className="font-mono">google/gemini-2.5-pro</span> or{' '}
            <span className="font-mono">anthropic/claude-opus-4</span>.
          </p>
        </div>
      </div>

      {/* Save */}
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
