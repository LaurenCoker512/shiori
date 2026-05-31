'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OverflowMenu } from '@/components/ui/OverflowMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TagPicker } from '@/components/ui/TagPicker';
import { useReparse } from '@/components/ui/ReparseToastProvider';
import type { Tag } from '@/lib/types';
import { TAG_COLOR_SWATCHES } from '@/lib/tags';

function TagPills({ tags }: { tags: Tag[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // null = measuring mode (all tags rendered); number = settled visible count
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const prevTagsRef = useRef<Tag[]>(tags);

  useLayoutEffect(() => {
    const tagsChanged = prevTagsRef.current !== tags;
    prevTagsRef.current = tags;

    if (tagsChanged) {
      setVisibleCount(null); // Reset to measuring mode when tags change
      return;
    }
    if (visibleCount !== null) return; // Already settled

    const container = containerRef.current;
    if (!container || tags.length === 0) { setVisibleCount(0); return; }

    const containerRight = container.getBoundingClientRect().right;
    const els = Array.from(container.querySelectorAll<HTMLElement>('[data-tag]'));

    let count = els.length;
    for (let i = 0; i < els.length; i++) {
      if (els[i].getBoundingClientRect().right > containerRight + 1) { count = i; break; }
    }
    setVisibleCount(count);
  }, [tags, visibleCount]);

  const displayCount = visibleCount ?? tags.length;
  const overflowCount = tags.length - displayCount;

  return (
    <div ref={containerRef} className="flex items-center gap-1 overflow-hidden h-full min-w-0">
      {tags.slice(0, displayCount).map(tag => (
        <span
          key={tag.id}
          data-tag
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-en text-[10px] shrink-0"
          style={{ background: 'rgba(255,255,255,0.22)', color: '#faf3df' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: TAG_COLOR_SWATCHES[tag.color] }}
            aria-hidden="true"
          />
          {tag.name}
        </span>
      ))}
      {overflowCount > 0 && (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full font-en text-[10px] shrink-0"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#faf3df', opacity: 0.85 }}
        >
          +{overflowCount}
        </span>
      )}
    </div>
  );
}

interface ComprehensionEntry {
  text_id: number;
  title: string;
  last_read_at: string | null;
  pct_known: number;
  tags: Tag[];
}

interface ProcessingEntry {
  id: number;
  title: string;
}

interface ComprehensionListProps {
  comprehension: ComprehensionEntry[];
  processingTexts?: ProcessingEntry[];
}

type CardAction =
  | { type: 'idle' }
  | { type: 'renaming'; id: number; inputValue: string; error: string }
  | { type: 'deleting'; id: number; title: string }
  | { type: 'tagging'; id: number; currentTags: Tag[] };

type SortKey = 'recent' | 'title-asc' | 'title-desc' | 'pct-asc' | 'pct-desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent',     label: 'Recently read' },
  { value: 'title-asc',  label: 'Title A → Z' },
  { value: 'title-desc', label: 'Title Z → A' },
  { value: 'pct-asc',    label: 'Comprehension ↑' },
  { value: 'pct-desc',   label: 'Comprehension ↓' },
];

function sortEntries(entries: ComprehensionEntry[], sort: SortKey): ComprehensionEntry[] {
  return [...entries].sort((a, b) => {
    switch (sort) {
      case 'recent': {
        if (a.last_read_at === null && b.last_read_at === null) return 0;
        if (a.last_read_at === null) return 1;
        if (b.last_read_at === null) return -1;
        return new Date(b.last_read_at).getTime() - new Date(a.last_read_at).getTime();
      }
      case 'title-asc':  return a.title.localeCompare(b.title, 'ja');
      case 'title-desc': return b.title.localeCompare(a.title, 'ja');
      case 'pct-asc':    return a.pct_known - b.pct_known;
      case 'pct-desc':   return b.pct_known - a.pct_known;
    }
  });
}

const MOODS = ['persimmon', 'moss', 'twilight', 'gold'];

const MOOD_GRADIENTS: Record<string, string> = {
  persimmon: 'linear-gradient(135deg, var(--yg-card-coral-hi), var(--yg-card-coral-lo))',
  moss:      'linear-gradient(135deg, var(--yg-card-bamboo-hi), var(--yg-card-bamboo-lo))',
  twilight:  'linear-gradient(135deg, var(--yg-card-indigo-hi), var(--yg-card-indigo-lo))',
  gold:      'linear-gradient(135deg, var(--yg-card-gold-hi), var(--yg-card-gold-lo))',
};

export function ComprehensionList({ comprehension, processingTexts = [] }: ComprehensionListProps) {
  const router = useRouter();
  const { reparseSingle } = useReparse();
  const [cardAction, setCardAction] = useState<CardAction>({ type: 'idle' });
  // Local tag overrides: updated optimistically after TagPicker saves
  const [localTags, setLocalTags] = useState<Map<number, Tag[]>>(new Map());
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);

  function tagsFor(entry: ComprehensionEntry): Tag[] {
    return localTags.get(entry.text_id) ?? entry.tags ?? [];
  }

  // Derive unique tags from all comprehension entries (respects localTags optimistic updates)
  const allTags: Tag[] = [];
  const seenTagIds = new Set<number>();
  for (const entry of comprehension) {
    for (const tag of tagsFor(entry)) {
      if (!seenTagIds.has(tag.id)) {
        seenTagIds.add(tag.id);
        allTags.push(tag);
      }
    }
  }

  const hasTags = allTags.length > 0;
  const showControls = hasTags || comprehension.length >= 2;

  const filteredComprehension = selectedTagId === null
    ? comprehension
    : comprehension.filter(entry => tagsFor(entry).some(t => t.id === selectedTagId));

  const sortedComprehension = sortEntries(filteredComprehension, sortKey);

  if (comprehension.length === 0 && processingTexts.length === 0) {
    return (
      <p className="font-en text-sm" style={{ color: 'var(--yg-ink-soft)' }}>
        No texts imported yet.
      </p>
    );
  }

  async function handleRenameSubmit(e: React.FormEvent, id: number) {
    e.preventDefault();
    if (cardAction.type !== 'renaming') return;
    const trimmed = cardAction.inputValue.trim();
    if (trimmed === '') {
      setCardAction({ ...cardAction, error: 'Title cannot be empty' });
      return;
    }
    await fetch(`/api/texts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    });
    setCardAction({ type: 'idle' });
    router.refresh();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/texts/${id}`, { method: 'DELETE' });
    setCardAction({ type: 'idle' });
    router.refresh();
  }

  async function handleReparse(id: number, title: string) {
    await reparseSingle(id, title);
    router.refresh();
  }

  return (
    <>
      {/* Sort & filter controls */}
      {showControls && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Tag filter pills */}
          {hasTags && (
            <div
              className="flex flex-wrap items-center gap-1 p-1 rounded-[10px]"
              style={{ background: 'rgba(42,36,28,0.06)' }}
            >
              <button
                type="button"
                onClick={() => setSelectedTagId(null)}
                className="font-en text-[12px] font-medium px-3 py-1 rounded-[7px] transition-all"
                style={{
                  background: selectedTagId === null ? '#fff' : 'transparent',
                  boxShadow: selectedTagId === null ? '0 1px 2px rgba(0,0,0,0.07)' : 'none',
                  color: selectedTagId === null ? '#2c2a28' : 'var(--yg-ink-soft)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                All
              </button>
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedTagId(tag.id)}
                  className="inline-flex items-center gap-1.5 font-en text-[12px] font-medium px-3 py-1 rounded-[7px] transition-all"
                  style={{
                    background: selectedTagId === tag.id ? '#fff' : 'transparent',
                    boxShadow: selectedTagId === tag.id ? '0 1px 2px rgba(0,0,0,0.07)' : 'none',
                    color: selectedTagId === tag.id ? '#2c2a28' : 'var(--yg-ink-soft)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: TAG_COLOR_SWATCHES[tag.color] }}
                    aria-hidden="true"
                  />
                  {tag.name}
                </button>
              ))}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Sort select */}
          {comprehension.length >= 2 && (
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              aria-label="Sort library"
              className="font-en text-[12px] px-2.5 py-1.5 rounded-[8px] border appearance-none"
              style={{
                borderColor: 'var(--yg-rule)',
                background: 'var(--yg-paper-hi)',
                color: 'var(--yg-ink)',
                cursor: 'pointer',
              }}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {processingTexts.map(entry => (
          <div
            key={`processing-${entry.id}`}
            className="relative rounded-xl overflow-hidden flex items-center gap-4 px-5 py-4 border h-[100px]"
            style={{
              background: 'var(--yg-paper-hi)',
              borderColor: 'var(--yg-rule)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
            aria-label={`${entry.title} — processing`}
          >
            <div className="flex-1 min-w-0">
              <div className="font-jp text-[18px] font-medium leading-[1.3] tracking-tight truncate" style={{ color: 'var(--yg-ink)' }}>
                {entry.title}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: 'var(--yg-coral)' }}
                  aria-hidden="true"
                />
                <span className="font-en text-[11px]" style={{ color: 'var(--yg-ink-muted)' }}>Processing…</span>
              </div>
            </div>
          </div>
        ))}

        {sortedComprehension.map((entry, idx) => {
          const gradient = MOOD_GRADIENTS[MOODS[idx % MOODS.length]];
          const lastRead = entry.last_read_at !== null
            ? new Date(entry.last_read_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })
            : 'Not started';
          const isRenaming = cardAction.type === 'renaming' && cardAction.id === entry.text_id;
          const entryTags = tagsFor(entry);

          return (
            <div key={entry.text_id} className="relative">
              {isRenaming ? (
                <div
                  className="rounded-xl overflow-hidden px-5 py-4"
                  style={{ background: gradient, color: '#faf3df', boxShadow: '0 4px 12px rgba(0,0,0,0.10)' }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none rounded-xl"
                    style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.10), transparent 50%)' }}
                    aria-hidden="true"
                  />
                  <form
                    onSubmit={e => { void handleRenameSubmit(e, entry.text_id); }}
                    className="relative flex items-center gap-2"
                  >
                    <input
                      aria-label="Text title"
                      value={cardAction.inputValue}
                      onChange={e => setCardAction({ ...cardAction, inputValue: e.target.value })}
                      className="flex-1 font-jp text-[18px] font-medium rounded px-2 py-0.5 min-w-0"
                      style={{
                        background: 'rgba(250,243,223,0.25)',
                        border: '1px solid rgba(250,243,223,0.6)',
                        color: '#faf3df',
                        outline: 'none',
                      }}
                      autoFocus
                    />
                    {cardAction.error !== '' && (
                      <span role="alert" className="font-en text-xs shrink-0" style={{ color: '#faf3df', opacity: 0.8 }}>
                        {cardAction.error}
                      </span>
                    )}
                    <button
                      type="submit"
                      className="font-en text-xs font-medium min-h-11 px-2 shrink-0"
                      style={{ color: '#faf3df', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.9 }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardAction({ type: 'idle' })}
                      className="font-en text-xs min-h-11 px-2 shrink-0"
                      style={{ color: '#faf3df', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href={`/texts/${entry.text_id}`}
                  className="block"
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    className="relative rounded-xl overflow-hidden flex items-center gap-4 px-5 py-4 pr-12 h-[100px]"
                    style={{ background: gradient, color: '#faf3df', boxShadow: '0 4px 12px rgba(0,0,0,0.10)' }}
                  >
                    {/* Sheen */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.10), transparent 50%)' }}
                      aria-hidden="true"
                    />
                    {/* Title + tags */}
                    <div className="relative flex-1 min-w-0">
                      <div className="font-jp text-[18px] font-medium leading-[1.3] tracking-tight truncate">
                        {entry.title}
                      </div>
                      <div className="font-en text-[11px] opacity-70 mt-0.5">
                        {lastRead}
                      </div>
                      <div className="h-5 mt-1.5 min-w-0">
                        <TagPills tags={entryTags} />
                      </div>
                    </div>
                    {/* Progress */}
                    <div className="relative shrink-0 text-right">
                      <div className="font-en text-[22px] font-semibold leading-none">{entry.pct_known}%</div>
                      <div className="font-en text-[10px] opacity-70 mt-0.5">known</div>
                      <div
                        className="h-1 rounded-sm mt-2"
                        style={{ width: 64, background: 'rgba(250,243,223,0.25)' }}
                      >
                        <div
                          className="h-full rounded-sm"
                          style={{ width: `${entry.pct_known}%`, background: '#faf3df' }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {/* Overflow menu — sits outside the Link to avoid triggering navigation */}
              {!isRenaming && (
                <div className="absolute top-2 right-1" onClick={e => e.stopPropagation()}>
                  <OverflowMenu
                    variant="light"
                    onTags={() => setCardAction({ type: 'tagging', id: entry.text_id, currentTags: tagsFor(entry) })}
                    onRename={() => setCardAction({ type: 'renaming', id: entry.text_id, inputValue: entry.title, error: '' })}
                    onDelete={() => setCardAction({ type: 'deleting', id: entry.text_id, title: entry.title })}
                    onReparse={() => { void handleReparse(entry.text_id, entry.title); }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state when tag filter yields no results */}
      {selectedTagId !== null && sortedComprehension.length === 0 && processingTexts.length === 0 && (
        <p className="font-en text-sm" style={{ color: 'var(--yg-ink-soft)' }}>
          No texts with this tag.
        </p>
      )}

      {cardAction.type === 'deleting' && (
        <ConfirmDialog
          message={`Delete "${cardAction.title}"? This action cannot be undone.`}
          onConfirm={() => { void handleDelete(cardAction.id); }}
          onCancel={() => setCardAction({ type: 'idle' })}
        />
      )}

      {cardAction.type === 'tagging' && (
        <TagPicker
          textId={cardAction.id}
          currentTags={cardAction.currentTags}
          onClose={() => setCardAction({ type: 'idle' })}
          onSaved={savedTags => {
            setLocalTags(prev => new Map(prev).set(cardAction.id, savedTags));
            setCardAction({ type: 'idle' });
          }}
        />
      )}
    </>
  );
}
