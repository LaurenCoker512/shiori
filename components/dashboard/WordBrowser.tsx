'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Word, WordStatus, JlptLevel } from '@/lib/types';
import { parseTranslations } from '@/lib/types';
import { Spinner } from '@/components/ui/Spinner';

const PAGE_SIZE = 50;

interface WordBrowserProps {
  initialWords?: Word[];
  initialTotal?: number;
}

export function WordBrowser({ initialWords = [], initialTotal = 0 }: WordBrowserProps) {
  const [words, setWords] = useState<Word[]>(initialWords);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | WordStatus>('');
  const [jlpt, setJlpt] = useState<'' | JlptLevel>('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const isMountedRef = useRef(false);
  const prevSearchRef = useRef('');
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchWords = useCallback(async (q: string, st: string, jp: string, pg: number) => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(pg) });
    if (q) params.set('search', q);
    if (st) params.set('status', st);
    if (jp) params.set('jlpt_level', jp);
    const res = await fetch(`/api/words?${params.toString()}`);
    const data = await res.json() as { words: Word[]; total: number };
    setWords(data.words);
    setTotal(data.total);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }

    const isSearchChange = prevSearchRef.current !== search;
    prevSearchRef.current = search;

    if (isSearchChange) {
      const timer = setTimeout(() => { void fetchWords(search, status, jlpt, page); }, 300);
      return () => clearTimeout(timer);
    }

    void fetchWords(search, status, jlpt, page);
  }, [search, status, jlpt, page, fetchWords]);

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
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search words..."
          aria-label="Search words"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded px-3 py-1.5 text-sm"
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={e => { setStatus(e.target.value as '' | WordStatus); setPage(1); }}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="unseen">Unseen</option>
          <option value="seen">Seen</option>
          <option value="known">Known</option>
        </select>
        <select
          aria-label="Filter by JLPT level"
          value={jlpt}
          onChange={e => { setJlpt(e.target.value as '' | JlptLevel); setPage(1); }}
          className="border rounded px-2 py-1.5 text-sm"
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
        <Spinner />
      ) : (
        <table className="w-full text-sm" aria-label="Word list">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Word</th>
              <th className="py-2 pr-4">Reading</th>
              <th className="py-2 pr-4">JLPT</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Translation</th>
            </tr>
          </thead>
          <tbody>
            {words.map(word => {
              const claudeGloss = parseTranslations(word.translation).join('; ');
              return (
                <tr key={word.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{word.dictionary_form}</td>
                  <td className="py-2 pr-4 text-gray-600">{word.reading}</td>
                  <td className="py-2 pr-4 text-gray-600">{word.jlpt_level ?? '—'}</td>
                  <td className="py-2 pr-4 capitalize">{word.status}</td>
                  <td className="py-2">
                    {editingId === word.id ? (
                      <input
                        type="text"
                        aria-label={`Edit translation for ${word.dictionary_form}`}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => { void saveTranslation(word); }}
                        onKeyDown={e => { if (e.key === 'Enter') void saveTranslation(word); }}
                        autoFocus
                        className="border rounded px-1 text-sm w-full"
                      />
                    ) : (
                      <div className="flex items-start gap-1">
                        <div className="flex-1">
                          {word.user_translation !== null ? (
                            <>
                              <span>{word.user_translation}</span>
                              {claudeGloss !== '' && (
                                <span className="block text-xs text-gray-500">{claudeGloss}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-600">{claudeGloss}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`Edit translation for ${word.dictionary_form}`}
                          className="text-gray-400 hover:text-gray-700 text-xs shrink-0"
                          onClick={() => {
                            setEditingId(word.id);
                            setEditValue(word.user_translation ?? '');
                          }}
                        >
                          ✎
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="flex gap-2 mt-4 items-center">
        <button
          type="button"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className="px-3 py-1 border rounded text-sm disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
        <button
          type="button"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="px-3 py-1 border rounded text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
