'use client';

import { useState } from 'react';

interface TTSPlayerBarProps {
  isPlaying: boolean;
  activeSentenceIndex: number | null;
  sentenceCount: number;
  speakingRate: number;
  onPlay(): void;
  onPause(): void;
  onPrev(): void;
  onNext(): void;
  onDownload(): Promise<void>;
}

const barStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(520px, calc(100vw - 32px))',
  background: 'var(--yg-paper-hi)',
  border: '1px solid var(--yg-rule)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
  padding: '10px 16px',
  zIndex: 30,
  animation: 'yg-slide-up 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--yg-ink)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  padding: '6px 8px',
  transition: 'opacity 0.15s',
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  alignSelf: 'stretch',
  background: 'var(--yg-rule)',
  margin: '0 4px',
};

export function TTSPlayerBar({
  isPlaying,
  activeSentenceIndex,
  sentenceCount,
  speakingRate,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onDownload,
}: TTSPlayerBarProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    try {
      await onDownload();
    } finally {
      setIsDownloading(false);
    }
  }

  const prevDisabled = activeSentenceIndex === null || activeSentenceIndex === 0;
  const nextDisabled = activeSentenceIndex !== null && activeSentenceIndex >= sentenceCount - 1;

  return (
    <div style={barStyle} role="region" aria-label="Text-to-speech player">
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          type="button"
          onClick={onPrev}
          disabled={prevDisabled}
          style={{ ...iconBtnStyle, opacity: prevDisabled ? 0.3 : 1 }}
          aria-label="Previous sentence"
        >
          <PrevIcon />
        </button>

        {/* Play / Pause */}
        <button
          type="button"
          onClick={isPlaying ? onPause : onPlay}
          style={iconBtnStyle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Next */}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          style={{ ...iconBtnStyle, opacity: nextDisabled ? 0.3 : 1 }}
          aria-label="Next sentence"
        >
          <NextIcon />
        </button>

        <div style={dividerStyle} />

        {/* Sentence counter */}
        {activeSentenceIndex !== null && (
          <span
            className="font-en text-[11px] tabular-nums"
            style={{ color: 'var(--yg-ink-soft)', minWidth: '3.5em', textAlign: 'center' }}
          >
            {activeSentenceIndex + 1} / {sentenceCount}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Speed */}
        <span
          className="font-en text-[12px]"
          style={{ color: 'var(--yg-ink-soft)' }}
          aria-label={`Speaking rate: ${speakingRate}×`}
        >
          {speakingRate}×
        </span>

        <div style={dividerStyle} />

        {/* Download */}
        <button
          type="button"
          onClick={() => { void handleDownload(); }}
          disabled={isDownloading}
          style={{ ...iconBtnStyle, opacity: isDownloading ? 0.5 : 1 }}
          aria-label={isDownloading ? 'Downloading audio…' : 'Download full audio'}
        >
          {isDownloading ? <SpinnerIcon /> : <DownloadIcon />}
        </button>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M3 2.5l11 5.5-11 5.5V2.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3" y="2" width="4" height="12" rx="1" />
      <rect x="9" y="2" width="4" height="12" rx="1" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="2" y="2" width="2.5" height="12" rx="1" />
      <path d="M13 2.5L4 8l9 5.5V2.5z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="11.5" y="2" width="2.5" height="12" rx="1" />
      <path d="M3 2.5l9 5.5-9 5.5V2.5z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v8M5 7l3 3 3-3" />
      <path d="M2 12h12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M8 2a6 6 0 0 1 6 6" opacity="0.9" />
      <path d="M8 2a6 6 0 0 0-6 6" opacity="0.3" />
    </svg>
  );
}
