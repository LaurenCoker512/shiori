'use client';

import { useEffect, useState } from 'react';
import type { Tag, TagColor } from '@/lib/types';
import { TAG_COLORS, TAG_COLOR_SWATCHES, TAG_COLOR_STYLES } from '@/lib/tags';

type TagEditState =
  | { type: 'idle' }
  | { type: 'editing'; id: number; name: string; color: TagColor; error: string }
  | { type: 'deleting'; id: number; name: string }
  | { type: 'creating'; name: string; color: TagColor; error: string };

export function TagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editState, setEditState] = useState<TagEditState>({ type: 'idle' });

  useEffect(() => {
    void fetch('/api/tags')
      .then(r => r.json() as Promise<{ tags: Tag[] }>)
      .then(data => { setTags(data.tags); setIsLoading(false); });
  }, []);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editState.type !== 'editing') return;
    const name = editState.name.trim();
    if (name === '') {
      setEditState({ ...editState, error: 'Name cannot be empty' });
      return;
    }
    const res = await fetch(`/api/tags/${editState.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: editState.color }),
    });
    const data = await res.json() as { tag?: Tag; error?: string };
    if (!res.ok) {
      setEditState({ ...editState, error: data.error ?? 'Failed to save' });
      return;
    }
    setTags(prev => prev.map(t => t.id === editState.id ? data.tag! : t).sort((a, b) => a.name.localeCompare(b.name)));
    setEditState({ type: 'idle' });
  }

  async function handleDelete(id: number) {
    await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    setTags(prev => prev.filter(t => t.id !== id));
    setEditState({ type: 'idle' });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (editState.type !== 'creating') return;
    const name = editState.name.trim();
    if (name === '') {
      setEditState({ ...editState, error: 'Name cannot be empty' });
      return;
    }
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: editState.color }),
    });
    const data = await res.json() as { tag?: Tag; error?: string };
    if (!res.ok) {
      setEditState({ ...editState, error: data.error ?? 'Failed to create' });
      return;
    }
    if (data.tag !== undefined) {
      setTags(prev => [...prev, data.tag!].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setEditState({ type: 'idle' });
  }

  return (
    <div
      className="rounded-2xl px-7 py-6 border"
      style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
    >
      <div className="mb-4">
        <div className="font-en text-[14px] font-semibold mb-0.5" style={{ color: 'var(--yg-ink)' }}>Tags</div>
        <div className="font-en text-[12px]" style={{ color: 'var(--yg-ink-soft)' }}>
          Create and manage labels to organize your texts.
        </div>
      </div>

      {isLoading ? (
        <p className="font-en text-[13px]" style={{ color: 'var(--yg-ink-muted)' }}>Loading…</p>
      ) : (
        <div className="flex flex-col gap-1 mb-4">
          {tags.length === 0 && editState.type !== 'creating' && (
            <p className="font-en text-[13px]" style={{ color: 'var(--yg-ink-muted)' }}>
              No tags yet.
            </p>
          )}

          {tags.map(tag => {
            const isEditing = editState.type === 'editing' && editState.id === tag.id;
            const isDeleting = editState.type === 'deleting' && editState.id === tag.id;
            const styles = TAG_COLOR_STYLES[tag.color];

            if (isDeleting) {
              return (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--yg-rule-soft)' }}
                >
                  <span className="font-en text-[13px] flex-1" style={{ color: 'var(--yg-ink-soft)' }}>
                    Delete &ldquo;{tag.name}&rdquo;?
                  </span>
                  <button
                    type="button"
                    onClick={() => { void handleDelete(tag.id); }}
                    className="font-en text-[12px] font-semibold px-3 py-1 rounded-full"
                    style={{ background: 'var(--yg-coral-dark)', color: '#faf3df', border: 'none', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditState({ type: 'idle' })}
                    className="font-en text-[12px] px-3 py-1 rounded-full border"
                    style={{ color: 'var(--yg-ink-soft)', borderColor: 'var(--yg-rule)', background: 'transparent', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              );
            }

            if (isEditing) {
              return (
                <form
                  key={tag.id}
                  onSubmit={e => { void handleSaveEdit(e); }}
                  className="flex flex-col gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--yg-rule-soft)' }}
                >
                  <input
                    type="text"
                    value={editState.name}
                    onChange={e => setEditState({ ...editState, name: e.target.value })}
                    maxLength={32}
                    autoFocus
                    className="font-en text-[13px] rounded-xl px-3 py-2 border outline-none"
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
                        onClick={() => setEditState({ ...editState, color: c })}
                        className="w-6 h-6 rounded-full transition-transform"
                        style={{
                          background: TAG_COLOR_SWATCHES[c],
                          outline: editState.color === c ? '2px solid var(--yg-ink)' : '2px solid transparent',
                          outlineOffset: 2,
                        }}
                      />
                    ))}
                  </div>
                  {editState.error !== '' && (
                    <p className="font-en text-[11px]" style={{ color: 'var(--yg-coral-dark)' }}>{editState.error}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="font-en text-[12px] font-semibold px-4 py-1.5 rounded-full"
                      style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditState({ type: 'idle' })}
                      className="font-en text-[12px] px-4 py-1.5 rounded-full border"
                      style={{ color: 'var(--yg-ink-soft)', borderColor: 'var(--yg-rule)', background: 'transparent', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div key={tag.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl group hover:bg-[rgba(44,42,40,0.03)]">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: TAG_COLOR_SWATCHES[tag.color] }}
                  aria-hidden="true"
                />
                <span
                  className="flex-1 font-en text-[13px] px-2 py-0.5 rounded-full inline-block self-start"
                  style={{ background: styles.bg, color: styles.text }}
                >
                  {tag.name}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    aria-label={`Edit tag ${tag.name}`}
                    onClick={() => setEditState({ type: 'editing', id: tag.id, name: tag.name, color: tag.color, error: '' })}
                    className="font-en text-[11px] px-2 py-1 rounded-lg"
                    style={{ color: 'var(--yg-ink-soft)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete tag ${tag.name}`}
                    onClick={() => setEditState({ type: 'deleting', id: tag.id, name: tag.name })}
                    className="font-en text-[11px] px-2 py-1 rounded-lg"
                    style={{ color: 'var(--yg-coral-dark)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}

          {/* Create form */}
          {editState.type === 'creating' && (
            <form
              onSubmit={e => { void handleCreate(e); }}
              className="flex flex-col gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: 'var(--yg-rule-soft)' }}
            >
              <input
                type="text"
                value={editState.name}
                onChange={e => setEditState({ ...editState, name: e.target.value })}
                placeholder="Tag name"
                maxLength={32}
                autoFocus
                className="font-en text-[13px] rounded-xl px-3 py-2 border outline-none"
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
                    onClick={() => setEditState({ ...editState, color: c })}
                    className="w-6 h-6 rounded-full transition-transform"
                    style={{
                      background: TAG_COLOR_SWATCHES[c],
                      outline: editState.color === c ? '2px solid var(--yg-ink)' : '2px solid transparent',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
              {editState.error !== '' && (
                <p className="font-en text-[11px]" style={{ color: 'var(--yg-coral-dark)' }}>{editState.error}</p>
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
                  onClick={() => setEditState({ type: 'idle' })}
                  className="font-en text-[12px] px-4 py-1.5 rounded-full border"
                  style={{ color: 'var(--yg-ink-soft)', borderColor: 'var(--yg-rule)', background: 'transparent', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {!isLoading && editState.type !== 'creating' && (
        <button
          type="button"
          onClick={() => setEditState({ type: 'creating', name: '', color: 'coral', error: '' })}
          className="font-en text-[13px] font-medium px-5 py-2.5 rounded-full"
          style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
        >
          New tag
        </button>
      )}
    </div>
  );
}
