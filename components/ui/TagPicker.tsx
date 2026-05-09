'use client';

import { useEffect, useState } from 'react';
import type { Tag, TagColor } from '@/lib/types';
import { TAG_COLORS, TAG_COLOR_STYLES, TAG_COLOR_SWATCHES } from '@/lib/tags';

interface TagPickerProps {
  textId: number;
  currentTags: Tag[];
  onClose: () => void;
  onSaved: (tags: Tag[]) => void;
}

export function TagPicker({ textId, currentTags, onClose, onSaved }: TagPickerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set(currentTags.map(t => t.id)));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<TagColor>('coral');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    void fetch('/api/tags')
      .then(r => r.json() as Promise<{ tags: Tag[] }>)
      .then(data => { setAllTags(data.tags); setIsLoading(false); });
  }, []);

  function toggleTag(id: number) {
    setSelected(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (name === '') return;
    setCreateError('');
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: newColor }),
    });
    const data = await res.json() as { tag?: Tag; error?: string };
    if (!res.ok) {
      setCreateError(data.error ?? 'Failed to create tag');
      return;
    }
    if (data.tag !== undefined) {
      setAllTags(prev => [...prev, data.tag!].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected(prev => new Set([...Array.from(prev), data.tag!.id]));
    }
    setNewName('');
    setIsCreating(false);
  }

  async function handleSave() {
    setIsSaving(true);
    const tagIds = Array.from(selected);
    await fetch(`/api/texts/${textId}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds }),
    });
    onSaved(allTags.filter(t => selected.has(t.id)));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage tags"
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(44,42,40,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl w-full max-w-sm mx-4 overflow-hidden"
        style={{
          background: 'var(--yg-paper-hi)',
          border: '1px solid var(--yg-rule)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--yg-rule)' }}>
          <h2 className="font-en text-[15px] font-semibold" style={{ color: 'var(--yg-ink)' }}>
            Tags
          </h2>
        </div>

        {/* Tag list */}
        <div className="px-2 py-2 max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-3 font-en text-[13px]" style={{ color: 'var(--yg-ink-muted)' }}>
              Loading…
            </p>
          ) : allTags.length === 0 && !isCreating ? (
            <p className="px-4 py-3 font-en text-[13px]" style={{ color: 'var(--yg-ink-muted)' }}>
              No tags yet. Create one below.
            </p>
          ) : (
            allTags.map(tag => {
              const isChecked = selected.has(tag.id);
              const styles = TAG_COLOR_STYLES[tag.color];
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-colors"
                  style={{ background: isChecked ? 'var(--yg-rule-soft)' : 'transparent' }}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: TAG_COLOR_SWATCHES[tag.color] }}
                    aria-hidden="true"
                  />
                  <span
                    className="flex-1 font-en text-[13px]"
                    style={{ color: isChecked ? styles.text : 'var(--yg-ink)' }}
                  >
                    {tag.name}
                  </span>
                  {isChecked && (
                    <span className="font-en text-[11px]" style={{ color: styles.text }} aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              );
            })
          )}

          {/* Inline create form */}
          {isCreating && (
            <form onSubmit={e => { void handleCreate(e); }} className="px-4 pt-3 pb-2 flex flex-col gap-3">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Tag name"
                maxLength={32}
                autoFocus
                className="w-full font-en text-[13px] rounded-xl px-3 py-2 border outline-none"
                style={{
                  background: 'var(--yg-paper-hi)',
                  borderColor: 'var(--yg-rule)',
                  color: 'var(--yg-ink)',
                }}
              />
              <div className="flex items-center gap-2">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color: ${c}`}
                    onClick={() => setNewColor(c)}
                    className="w-6 h-6 rounded-full transition-transform"
                    style={{
                      background: TAG_COLOR_SWATCHES[c],
                      outline: newColor === c ? `2px solid var(--yg-ink)` : '2px solid transparent',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
              {createError !== '' && (
                <p className="font-en text-[11px] -mt-1" style={{ color: 'var(--yg-coral-dark)' }}>
                  {createError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="font-en text-[12px] font-semibold px-4 py-1.5 rounded-full"
                  style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setNewName(''); setCreateError(''); }}
                  className="font-en text-[12px] px-4 py-1.5 rounded-full border"
                  style={{ color: 'var(--yg-ink-soft)', borderColor: 'var(--yg-rule)', background: 'transparent', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid var(--yg-rule)' }}
        >
          {!isCreating ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="font-en text-[12px] font-medium px-3 py-1.5 rounded-full border"
              style={{ color: 'var(--yg-ink-soft)', borderColor: 'var(--yg-rule)', background: 'transparent', cursor: 'pointer' }}
            >
              + New tag
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-9 px-4 py-1.5 rounded-full font-en text-[13px] font-medium border"
              style={{ color: 'var(--yg-ink-soft)', borderColor: 'var(--yg-rule)', background: 'transparent', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { void handleSave(); }}
              disabled={isSaving}
              className="min-h-9 px-4 py-1.5 rounded-full font-en text-[13px] font-semibold disabled:opacity-40"
              style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
