'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { createIndexedDBCache, makeSentenceCacheKey } from '@/lib/ttsCache';
import type { Sentence } from '@/lib/types';

export interface UseTTSPlayerOptions {
  textId: number;
  sentences: Sentence[];
  textTitle: string;
  ttsEnabled: boolean;
}

export interface UseTTSPlayerReturn {
  isPlaying: boolean;
  isLoadingAudio: boolean;
  activeSentenceIndex: number | null;
  play(): void;
  pause(): void;
  playFrom(sentenceIndex: number): void;
  goToPrev(): void;
  goToNext(): void;
  downloadAll(): Promise<void>;
}

async function fetchAudio(text: string): Promise<ArrayBuffer> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TTS fetch failed (${res.status}): ${body}`);
  }
  return res.arrayBuffer();
}

export function useTTSPlayer({
  textId,
  sentences,
  textTitle,
  ttsEnabled,
}: UseTTSPlayerOptions): UseTTSPlayerReturn {
  const cache = useRef(createIndexedDBCache());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);

  // Stable ref so playback callbacks always see the latest state without stale closures.
  const isPlayingRef = useRef(false);
  const activeSentenceIndexRef = useRef<number | null>(null);

  const setPlayingState = useCallback((playing: boolean) => {
    isPlayingRef.current = playing;
    setIsPlaying(playing);
  }, []);

  const setActiveSentence = useCallback((index: number | null) => {
    activeSentenceIndexRef.current = index;
    setActiveSentenceIndex(index);
  }, []);

  function getAudioContext(): AudioContext {
    if (audioCtxRef.current === null) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }

  const stopCurrent = useCallback(() => {
    if (currentSourceRef.current !== null) {
      currentSourceRef.current.onended = null;
      try { currentSourceRef.current.stop(); } catch { /* already stopped */ }
      currentSourceRef.current = null;
    }
  }, []);

  async function getAudio(sentenceIndex: number): Promise<ArrayBuffer> {
    const key = makeSentenceCacheKey(textId, sentenceIndex);
    const cached = await cache.current.get(key);
    if (cached !== null) return cached;
    const audio = await fetchAudio(sentences[sentenceIndex].raw);
    await cache.current.set(key, audio);
    return audio;
  }

  // Plays a sentence and, on completion, auto-advances if still playing.
  const playSentence = useCallback(async (sentenceIndex: number) => {
    if (!ttsEnabled || sentenceIndex < 0 || sentenceIndex >= sentences.length) return;

    stopCurrent();
    setActiveSentence(sentenceIndex);
    setLoadingAudio(true);

    let audioData: ArrayBuffer;
    try {
      audioData = await getAudio(sentenceIndex);
    } catch (err) {
      console.error('TTS audio fetch error:', err);
      setPlayingState(false);
      setActiveSentence(null);
      setLoadingAudio(false);
      return;
    }

    setLoadingAudio(false);

    const ctx = getAudioContext();
    let decoded: AudioBuffer;
    try {
      decoded = await ctx.decodeAudioData(audioData.slice(0));
    } catch (err) {
      console.error('TTS decode error:', err);
      setPlayingState(false);
      return;
    }

    if (!isPlayingRef.current) return;

    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.connect(ctx.destination);
    currentSourceRef.current = source;

    // Pre-fetch next sentence while current plays.
    const nextIndex = sentenceIndex + 1;
    if (nextIndex < sentences.length) {
      getAudio(nextIndex).catch(() => {/* pre-fetch best-effort */});
    }

    source.onended = () => {
      if (!isPlayingRef.current) return;
      const next = (activeSentenceIndexRef.current ?? sentenceIndex) + 1;
      if (next < sentences.length) {
        playSentence(next).catch(console.error);
      } else {
        setPlayingState(false);
        setActiveSentence(null);
      }
    };

    source.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences, textId, ttsEnabled, stopCurrent]);

  // Separate setter to avoid circular dep in playSentence.
  const setLoadingAudio = useCallback((loading: boolean) => {
    setIsLoadingAudio(loading);
  }, []);

  const play = useCallback(() => {
    if (!ttsEnabled) return;
    setPlayingState(true);
    const startIndex = activeSentenceIndexRef.current ?? 0;
    playSentence(startIndex).catch(console.error);
  }, [ttsEnabled, setPlayingState, playSentence]);

  const pause = useCallback(() => {
    setPlayingState(false);
    stopCurrent();
  }, [setPlayingState, stopCurrent]);

  const playFrom = useCallback((sentenceIndex: number) => {
    if (!ttsEnabled) return;
    setPlayingState(true);
    playSentence(sentenceIndex).catch(console.error);
  }, [ttsEnabled, setPlayingState, playSentence]);

  const goToPrev = useCallback(() => {
    if (!ttsEnabled) return;
    const current = activeSentenceIndexRef.current ?? 0;
    const target = Math.max(0, current - 1);
    setPlayingState(true);
    playSentence(target).catch(console.error);
  }, [ttsEnabled, setPlayingState, playSentence]);

  const goToNext = useCallback(() => {
    if (!ttsEnabled) return;
    const current = activeSentenceIndexRef.current ?? -1;
    const target = Math.min(sentences.length - 1, current + 1);
    setPlayingState(true);
    playSentence(target).catch(console.error);
  }, [ttsEnabled, sentences.length, setPlayingState, playSentence]);

  const downloadAll = useCallback(async () => {
    if (!ttsEnabled) return;
    setIsLoadingAudio(true);
    try {
      const buffers = await Promise.all(
        sentences.map((_, index) => getAudio(index)),
      );
      const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const buf of buffers) {
        merged.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
      }
      const blob = new Blob([merged], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${textTitle}.mp3`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('TTS download error:', err);
    } finally {
      setIsLoadingAudio(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsEnabled, sentences, textId, textTitle]);

  // Stop playback when component unmounts.
  useEffect(() => {
    return () => {
      stopCurrent();
      audioCtxRef.current?.close().catch(() => {/* ignore */});
    };
  }, [stopCurrent]);

  return {
    isPlaying,
    isLoadingAudio,
    activeSentenceIndex,
    play,
    pause,
    playFrom,
    goToPrev,
    goToNext,
    downloadAll,
  };
}
