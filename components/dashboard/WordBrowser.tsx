'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Word, WordStatus, JlptLevel } from '@/lib/types';
import { parseTranslations } from '@/lib/types';
import { Spinner } from '@/components/ui/Spinner';

const PAGE_SIZE = 21;

const STATUS_OPTIONS: { status: WordStatus; label: string }[] = [
  { status: 'unseen', label: 'New' },
  { status: 'seen',   label: 'Seen' },
  { status: 'known',  label: 'Known' },
];

const STATUS_FILTERS: { value: '' | WordStatus; label: string }[] = [
  { value: '',        label: 'All'    },
  { value: 'unseen',  label: 'New'    },
  { value: 'seen',    label: 'Seen'   },
  { value: 'known',   label: 'Known'  },
];

function statusDotColor(status: WordStatus): string {
  if (status === 'known') return 'var(--yg-bamboo)';
  if (status === 'seen')  return 'var(--yg-coral)';
  return 'var(--yg-ink-muted)';
}

function statusBg(status: WordStatus): string {
  if (status === 'known') return 'var(--yg-known)';
  if (status === 'seen')  return 'var(--yg-seen)';
  return 'transparent';
}

export function WordBrowser() {
  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [knownCount, setKnownCount] = useState(0);
  const [seenCount, setSeenCount] = useState(0);
  const [unseenCount, setUnseenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | WordStatus>('');
  const [jlpt, setJlpt] = useState<'' | JlptLevel>('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [fetchingTranslationIds, setFetchingTranslationIds] = useState<Set<number>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const prevSearchRef = useRef('');
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchWords = useCallback(async (q: string, st: string, jp: string, pg: number) => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(pg) });
    if (q) params.set('search', q);
    if (st) params.set('status', st);
    if (jp) params.set('jlpt_level', jp);
    const res = await fetch(`/api/words?${params.toString()}`);
    const data = await res.json() as { words: Word[]; total: number; knownCount: number; seenCount: number; unseenCount: number };
    setWords(data.words);
    setTotal(data.total);
    setKnownCount(data.knownCount);
    setSeenCount(data.seenCount);
    setUnseenCount(data.unseenCount);
    setLoading(false);
  }, []);

  useEffect(() => {
    const isSearchChange = prevSearchRef.current !== search;
    prevSearchRef.current = search;

    if (isSearchChange) {
      const timer = setTimeout(() => { void fetchWords(search, status, jlpt, page); }, 300);
      return () => clearTimeout(timer);
    }

    void fetchWords(search, status, jlpt, page);
  }, [search, status, jlpt, page, fetchWords]);

  async function lookUpTranslation(word: Word) {
    setFetchingTranslationIds(prev => new Set(prev).add(word.id));
    try {
      const res = await fetch(`/api/words/${word.id}/translation`);
      if (res.ok) {
        const data = await res.json() as { translations: string[]; jlpt_level: string | null };
        const translationJson = JSON.stringify(data.translations);
        setWords(prev => prev.map(w =>
          w.id === word.id
            ? { ...w, translation: translationJson, jlpt_level: (data.jlpt_level as Word['jlpt_level']) ?? w.jlpt_level }
            : w,
        ));
      }
    } finally {
      setFetchingTranslationIds(prev => {
        const next = new Set(prev);
        next.delete(word.id);
        return next;
      });
    }
  }

  async function updateStatus(word: Word, newStatus: WordStatus) {
    setOpenMenuId(null);
    setWords(prev => prev.map(w => w.id === word.id ? { ...w, status: newStatus } : w));
    await fetch(`/api/words/${word.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {
      setWords(prev => prev.map(w => w.id === word.id ? { ...w, status: word.status } : w));
    });
  }

  async function saveTranslation(word: Word) {
    const updated = editValue.trim() !== '' ? editValue.trim() : null;
    await fetch(`/api/words/${word.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_translation: updated }),
    });
    setWords(prev => prev.map(w => w.id === word.id ? { ...w, user_translation: updated } : w));
    setEditingId(null);
  }

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-7">
        <StatCard label="Total" value={total} sub="in library" />
        <StatCard label="Known" value={knownCount} sub="recognized" tintColor="var(--yg-bamboo)" bg="var(--yg-known)" />
        <StatCard label="Seen" value={seenCount} sub="learning" tintColor="var(--yg-coral)" bg="var(--yg-seen)" />
        <StatCard label="New" value={unseenCount} sub="to discover" />
      </div>

      {/* Search + filter row */}
      <div className="flex gap-2.5 mb-4">
        <div
          className="flex-1 flex items-center px-3 rounded-[10px] border"
          style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
        >
          <span className="font-jp mr-2" style={{ color: 'var(--yg-ink-muted)' }} aria-hidden="true">🔍</span>
          <input
            type="search"
            placeholder="検索 — search words, readings, meanings"
            aria-label="Search words"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-transparent border-none outline-none py-2.5 font-jp text-[13px]"
            style={{ color: 'var(--yg-ink)' }}
          />
        </div>
        <div
          className="flex p-1 gap-0.5 rounded-[10px]"
          style={{ background: 'rgba(42, 36, 28, 0.06)' }}
        >
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => { setStatus(f.value); setPage(1); }}
              className="px-3.5 py-1.5 rounded-[7px] font-en text-[11px] font-semibold tracking-[0.4px] capitalize transition-all"
              style={{
                background: status === f.value ? '#fff' : 'transparent',
                boxShadow: status === f.value ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                color: status === f.value ? '#2c2a28' : 'var(--yg-ink-soft)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Filter by JLPT level"
          value={jlpt}
          onChange={e => { setJlpt(e.target.value as '' | JlptLevel); setPage(1); }}
          className="border rounded-[10px] px-3 py-2 font-en text-[11px]"
          style={{
            background: 'var(--yg-paper-hi)',
            borderColor: 'var(--yg-rule)',
            color: 'var(--yg-ink)',
          }}
        >
          <option value="">All JLPT</option>
          <option value="N5">N5</option>
          <option value="N4">N4</option>
          <option value="N3">N3</option>
          <option value="N2">N2</option>
          <option value="N1">N1</option>
        </select>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center"><Spinner /></div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {words.map(word => {
            const claudeGloss = parseTranslations(word.translation).join('; ');
            const dot = statusDotColor(word.status);
            const bg = statusBg(word.status);
            return (
              <div
                key={word.id}
                className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl border"
                style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
              >
                {/* Word + reading */}
                <div className="shrink-0 w-[130px] text-center">
                  <div
                    className="font-jp text-[22px] font-medium leading-[1.2] rounded-[6px] px-0.5 py-0.5"
                    style={{ color: 'var(--yg-ink)', background: bg }}
                  >
                    {word.dictionary_form}
                  </div>
                  <div className="font-jp text-[11px] mt-0.5 tracking-[0.5px]" style={{ color: 'var(--yg-ink-soft)' }}>
                    {word.reading}
                  </div>
                </div>
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="relative flex items-center gap-1.5 mb-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: dot, opacity: word.status === 'unseen' ? 0.45 : 1 }}
                      aria-hidden="true"
                    />
                    <span className="font-en text-[10px] tracking-[0.6px] uppercase font-semibold" style={{ color: 'var(--yg-ink-muted)' }}>
                      {word.status} · {word.jlpt_level ?? '—'}
                    </span>
                    <button
                      type="button"
                      aria-label={`Change status for ${word.dictionary_form}`}
                      aria-expanded={openMenuId === word.id}
                      onClick={() => setOpenMenuId(prev => prev === word.id ? null : word.id)}
                      className="ml-auto font-en text-[11px] px-1 rounded leading-none transition-colors"
                      style={{
                        color: 'var(--yg-ink-muted)',
                        background: openMenuId === word.id ? 'var(--yg-rule-soft)' : 'transparent',
                        letterSpacing: '2px',
                      }}
                    >
                      · · ·
                    </button>
                    {openMenuId === word.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} aria-hidden="true" />
                        <div
                          role="menu"
                          aria-label="Change word status"
                          className="absolute right-0 top-full mt-1 w-36 rounded-xl overflow-hidden z-20"
                          style={{
                            background: 'var(--yg-paper-hi)',
                            border: '1px solid var(--yg-rule)',
                            boxShadow: '0 8px 28px rgba(0,0,0,0.10)',
                          }}
                        >
                          {STATUS_OPTIONS.map(({ status: s, label }) => (
                            <button
                              key={s}
                              type="button"
                              role="menuitem"
                              onClick={() => { void updateStatus(word, s); }}
                              className="w-full text-left min-h-10 px-4 py-2 font-en text-[13px] flex items-center gap-2 hover:bg-[rgba(44,42,40,0.04)]"
                              style={{ color: word.status === s ? 'var(--yg-ink-muted)' : 'var(--yg-ink)' }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: statusDotColor(s), opacity: s === 'unseen' ? 0.45 : 1 }}
                                aria-hidden="true"
                              />
                              {label}
                              {word.status === s && (
                                <span className="ml-auto font-en text-[10px]" style={{ color: 'var(--yg-ink-muted)' }} aria-label="current status">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="font-en text-[13px] leading-[1.4]" style={{ color: 'var(--yg-ink)' }}>
                    {editingId === word.id ? (
                      <div className="flex flex-col gap-1">
                        {claudeGloss !== '' && (
                          <span className="block text-xs" style={{ color: 'var(--yg-ink-muted)' }}>{claudeGloss}</span>
                        )}
                        <input
                          type="text"
                          aria-label={`Edit translation for ${word.dictionary_form}`}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => { void saveTranslation(word); }}
                          onKeyDown={e => { if (e.key === 'Enter') void saveTranslation(word); }}
                          autoFocus
                          className="border rounded px-1 text-sm w-full"
                          style={{ borderColor: 'var(--yg-rule)', background: 'var(--yg-paper)', color: 'var(--yg-ink)' }}
                        />
                      </div>
                    ) : (
                      <div className="flex items-start gap-1">
                        <div className="flex-1 min-w-0">
                          {word.user_translation !== null ? (
                            <>
                              <span className="block">{word.user_translation}</span>
                              {claudeGloss !== '' && (
                                <span className="block text-xs text-gray-500">{claudeGloss}</span>
                              )}
                            </>
                          ) : claudeGloss !== '' ? (
                            <span className="block" style={{ color: 'var(--yg-ink-soft)' }}>{claudeGloss}</span>
                          ) : (
                            <button
                              type="button"
                              aria-label={`Look up translation for ${word.dictionary_form}`}
                              disabled={fetchingTranslationIds.has(word.id)}
                              onClick={() => { void lookUpTranslation(word); }}
                              className="font-en text-[11px] px-2 py-0.5 rounded border transition-opacity disabled:opacity-50"
                              style={{
                                color: 'var(--yg-ink-muted)',
                                borderColor: 'var(--yg-rule)',
                                background: 'var(--yg-paper)',
                                cursor: 'pointer',
                              }}
                            >
                              {fetchingTranslationIds.has(word.id) ? '…' : 'Look up'}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`Edit translation for ${word.dictionary_form}`}
                          className="text-xs shrink-0"
                          style={{ color: 'var(--yg-ink-muted)' }}
                          onClick={() => {
                            setEditingId(word.id);
                            setEditValue(word.user_translation ?? '');
                          }}
                        >
                          ✎
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 mt-5 items-center">
        <button
          type="button"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className="px-4 py-1.5 rounded-full font-en text-[12px] font-medium border disabled:opacity-40 transition-all"
          style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)', color: 'var(--yg-ink)' }}
        >
          Prev
        </button>
        <span className="font-en text-sm" style={{ color: 'var(--yg-ink-soft)' }}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="px-4 py-1.5 rounded-full font-en text-[12px] font-medium border disabled:opacity-40 transition-all"
          style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)', color: 'var(--yg-ink)' }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, tintColor, bg,
}: {
  label: string;
  value: number;
  sub: string;
  tintColor?: string;
  bg?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: bg ?? 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
    >
      <div className="font-en text-[11px] tracking-[1px] uppercase font-semibold" style={{ color: 'var(--yg-ink-muted)' }}>
        {label}
      </div>
      <div
        className="font-jp text-[28px] font-medium tracking-tight leading-[1.1] mt-1"
        style={{ color: tintColor ?? 'var(--yg-ink)' }}
      >
        {value}
      </div>
      <div className="font-en text-[11px] mt-0.5" style={{ color: 'var(--yg-ink-soft)' }}>{sub}</div>
    </div>
  );
}
