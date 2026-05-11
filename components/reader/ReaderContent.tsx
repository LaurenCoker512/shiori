'use client';

import { useState, useEffect } from 'react';
import type { ParsedContent, Word, FuriganaOverride, GrammarPattern } from '@/lib/types';
import { SentenceBlock } from './SentenceBlock';
import { WordPopover } from './WordPopover';
import { GrammarTooltip } from './GrammarTooltip';
import { TTSPlayerBar } from './TTSPlayerBar';
import { useTTSPlayer } from '@/hooks/useTTSPlayer';

const FONT_SIZES = [15, 18, 21, 24];

interface ReaderContentProps {
  content: ParsedContent;
  wordStatusMap: Record<string, Word>;
  furiganaOverrides: FuriganaOverride[];
  textId: number;
  ttsEnabled: boolean;
  textTitle: string;
  ttsSpeakingRate: number;
}

export function ReaderContent({ content, wordStatusMap, furiganaOverrides, textId, ttsEnabled, textTitle, ttsSpeakingRate }: ReaderContentProps) {
  const [showFurigana, setShowFurigana] = useState(true);
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [fontSize, setFontSize] = useState(18);
  const [wordMap, setWordMap] = useState<Record<string, Word>>(wordStatusMap);
  const [popoverWord, setPopoverWord] = useState<Word | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const [grammarCache, setGrammarCache] = useState<Map<number, GrammarPattern[]>>(new Map());
  const [activeGrammar, setActiveGrammar] = useState<{
    sentenceIndex: number;
    phase: 'prompt' | 'showing';
  } | null>(null);
  const [popoverSurface, setPopoverSurface] = useState<string | null>(null);
  const [popoverFurigana, setPopoverFurigana] = useState<string | null>(null);
  const [overrideMap, setOverrideMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const override of furiganaOverrides) {
      map[override.surface_form] = override.corrected_reading;
    }
    return map;
  });

  const tts = useTTSPlayer({ textId, sentences: content, textTitle, ttsEnabled });

  useEffect(() => {
    const stored = localStorage.getItem('shiori-furigana');
    if (stored !== null) setShowFurigana(stored === 'true');
    const storedFont = localStorage.getItem('shiori-reader-font');
    if (storedFont === 'serif' || storedFont === 'sans') setFontFamily(storedFont);
    const storedSize = localStorage.getItem('shiori-reader-size');
    if (storedSize !== null) {
      const parsed = parseInt(storedSize, 10);
      if (FONT_SIZES.includes(parsed)) setFontSize(parsed);
    }
  }, []);

  function toggleFurigana() {
    const next = !showFurigana;
    setShowFurigana(next);
    localStorage.setItem('shiori-furigana', String(next));
  }

  function toggleFontFamily() {
    const next = fontFamily === 'serif' ? 'sans' : 'serif';
    setFontFamily(next);
    localStorage.setItem('shiori-reader-font', next);
  }

  function changeFontSize(delta: -1 | 1) {
    const idx = FONT_SIZES.indexOf(fontSize);
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= FONT_SIZES.length) return;
    const next = FONT_SIZES[nextIdx];
    setFontSize(next);
    localStorage.setItem('shiori-reader-size', String(next));
  }

  function wordKey(word: Word): string {
    return `${word.dictionary_form}|${word.reading}`;
  }

  function handleWordClick(word: Word, surface: string, furigana: string, anchor: DOMRect) {
    const key = wordKey(word);
    const originalWord = wordMap[key] ?? word;

    setPopoverAnchor(anchor);
    setPopoverSurface(surface);
    setPopoverFurigana(furigana);
    if (word.status === 'unseen') {
      const advanced: Word = { ...word, status: 'seen' };
      setWordMap(prev => ({ ...prev, [key]: advanced }));
      fetch(`/api/words/${word.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'seen' }),
      }).catch(() => {
        setWordMap(prev => ({ ...prev, [key]: originalWord }));
      });
      setPopoverWord(advanced);
    } else {
      setPopoverWord(word);
    }
  }

  function handleStatusUpdate(updated: Word) {
    setWordMap(prev => ({ ...prev, [wordKey(updated)]: updated }));
    setPopoverWord(updated);
  }

  function handleFuriganaEdit(surface: string, newReading: string) {
    setOverrideMap(prev => ({ ...prev, [surface]: newReading }));
  }

  function handleSentenceClick(sentenceIndex: number): void {
    if (activeGrammar !== null && activeGrammar.sentenceIndex === sentenceIndex) return;
    const cached = grammarCache.get(sentenceIndex);
    setActiveGrammar({ sentenceIndex, phase: cached !== undefined ? 'showing' : 'prompt' });
  }

  function handleGrammarConfirm() {
    if (activeGrammar === null) return;
    setActiveGrammar({ ...activeGrammar, phase: 'showing' });
  }

  function handlePatternsLoaded(sentenceIndex: number, patterns: GrammarPattern[]) {
    setGrammarCache(prev => new Map(prev).set(sentenceIndex, patterns));
  }

  const jpFontFamily = fontFamily === 'sans'
    ? "var(--font-noto-sans-jp), 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif"
    : "var(--font-zen-mincho), 'Yu Mincho', 'Hiragino Mincho ProN', serif";

  const sizeIdx = FONT_SIZES.indexOf(fontSize);

  const toolbarBtnStyle: React.CSSProperties = {
    background: 'var(--yg-paper-hi)',
    borderColor: 'var(--yg-rule)',
    color: 'var(--yg-ink-soft)',
  };

  return (
    <div
      style={{ '--reader-jp-font': jpFontFamily, '--reader-font-size': `${fontSize}px` } as React.CSSProperties}
    >
      {/* Grammar hint — scrolls with text, always visible until user scrolls past */}
      <p className="font-en text-[11px] italic mb-2" style={{ color: 'var(--yg-ink-muted)' }}>
        Click any sentence to analyze its grammar
      </p>

      {/*
        Buttons are sticky and rendered first. The negative bottom margin (-mb-11)
        collapses their space so the legend div below starts at the same y position,
        giving the appearance of a single shared row on load. As the user scrolls,
        the legend leaves while the buttons remain stuck.
      */}
      <div className="sticky top-[76px] z-10 flex justify-end items-center gap-2 h-11 -mb-11">
        <button
          type="button"
          onClick={toggleFontFamily}
          className="font-en text-[12px] font-medium min-h-11 px-4 rounded-full border inline-flex items-center transition-all"
          style={toolbarBtnStyle}
        >
          {fontFamily === 'serif' ? 'Serif' : 'Sans'}
        </button>
        <div className="inline-flex items-center border rounded-full overflow-hidden" style={{ borderColor: 'var(--yg-rule)', background: 'var(--yg-paper-hi)' }}>
          <button
            type="button"
            onClick={() => changeFontSize(-1)}
            disabled={sizeIdx === 0}
            aria-label="Decrease font size"
            className="font-en text-[12px] font-medium min-h-11 px-3.5 inline-flex items-center transition-all disabled:opacity-30"
            style={{ color: 'var(--yg-ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            A−
          </button>
          <span className="w-px self-stretch" style={{ background: 'var(--yg-rule)' }} />
          <button
            type="button"
            onClick={() => changeFontSize(1)}
            disabled={sizeIdx === FONT_SIZES.length - 1}
            aria-label="Increase font size"
            className="font-en text-[13px] font-medium min-h-11 px-3.5 inline-flex items-center transition-all disabled:opacity-30"
            style={{ color: 'var(--yg-ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            A+
          </button>
        </div>
        <button
          type="button"
          onClick={toggleFurigana}
          className="font-en text-[12px] font-medium min-h-11 px-4 rounded-full border inline-flex items-center transition-all"
          style={toolbarBtnStyle}
        >
          {showFurigana ? 'Hide furigana' : 'Show furigana'}
        </button>
      </div>

      {/* Legend — normal flow, same line as buttons above on load, scrolls away */}
      <div className="flex items-center gap-4 h-11 mb-5 font-en text-[11px]" style={{ color: 'var(--yg-ink-soft)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--yg-known)' }} aria-hidden="true" />
          New
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--yg-seen)' }} aria-hidden="true" />
          Seen
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm"
            style={{ border: '1.5px solid var(--yg-rule)' }}
            aria-hidden="true"
          />
          Known
        </span>
      </div>

      {/* Text body */}
      <div
        className={`leading-[2.6] tracking-[0.02em]${ttsEnabled ? ' pb-24' : ''}`}
        style={{
          color: 'var(--yg-ink)',
          fontFamily: 'var(--reader-jp-font)',
          fontSize: 'var(--reader-font-size)',
        }}
      >
        {content.map((sentence, i) => (
          <SentenceBlock
            key={i}
            sentence={sentence}
            wordStatusMap={wordMap}
            furiganaOverrides={overrideMap}
            showFurigana={showFurigana}
            onWordClick={handleWordClick}
            onSentenceClick={handleSentenceClick}
            isActiveGrammarSentence={activeGrammar?.sentenceIndex === sentence.sentence_index}
            isActiveTTS={tts.activeSentenceIndex === sentence.sentence_index}
            onPlaySentence={() => tts.playFrom(sentence.sentence_index)}
            ttsEnabled={ttsEnabled}
          />
        ))}
      </div>

      {/* End ornament */}
      <div className="flex items-center justify-center gap-3.5 mt-10 mb-3">
        <span className="flex-1 h-px max-w-[80px]" style={{ background: 'var(--yg-rule)' }} />
        <span className="font-jp text-sm tracking-[6px]" style={{ color: 'var(--yg-coral)' }}>· · ·</span>
        <span className="flex-1 h-px max-w-[80px]" style={{ background: 'var(--yg-rule)' }} />
      </div>

      {popoverWord !== null && popoverAnchor !== null && (
        <WordPopover
          word={popoverWord}
          anchorRect={popoverAnchor}
          surface={popoverSurface ?? undefined}
          currentFurigana={popoverFurigana ?? undefined}
          onClose={() => setPopoverWord(null)}
          onStatusUpdate={handleStatusUpdate}
          onFuriganaEdit={handleFuriganaEdit}
        />
      )}

      {activeGrammar?.phase === 'prompt' && (
        <div
          role="dialog"
          aria-label="Grammar analysis prompt"
          className="fixed z-40"
          style={{
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(460px, calc(100vw - 32px))',
            background: 'var(--yg-paper-hi)',
            border: '1px solid var(--yg-rule)',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.10)',
            animation: 'yg-slide-up 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
            padding: '14px 20px',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="font-en text-[13px] flex-1" style={{ color: 'var(--yg-ink-soft)' }}>
              Analyze grammar for this sentence?
            </span>
            <button
              type="button"
              className="font-en text-[12px] font-semibold px-4 py-1.5 rounded-full"
              style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
              onClick={handleGrammarConfirm}
            >
              Analyze
            </button>
            <button
              type="button"
              className="font-en text-[12px] px-4 py-1.5 rounded-full border"
              style={{ color: 'var(--yg-ink-soft)', borderColor: 'var(--yg-rule)', background: 'transparent', cursor: 'pointer' }}
              onClick={() => setActiveGrammar(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeGrammar?.phase === 'showing' && (
        <GrammarTooltip
          textId={textId}
          sentenceIndex={activeGrammar.sentenceIndex}
          initialPatterns={grammarCache.get(activeGrammar.sentenceIndex) ?? null}
          onPatternsLoaded={patterns => handlePatternsLoaded(activeGrammar.sentenceIndex, patterns)}
          onClose={() => setActiveGrammar(null)}
        />
      )}

      {ttsEnabled && (
        <TTSPlayerBar
          isPlaying={tts.isPlaying}
          activeSentenceIndex={tts.activeSentenceIndex}
          sentenceCount={content.length}
          speakingRate={ttsSpeakingRate}
          onPlay={tts.play}
          onPause={tts.pause}
          onPrev={tts.goToPrev}
          onNext={tts.goToNext}
          onDownload={tts.downloadAll}
        />
      )}
    </div>
  );
}
