'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OverflowMenu } from '@/components/ui/OverflowMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TagPicker } from '@/components/ui/TagPicker';
import { useReparse } from '@/components/ui/ReparseToastProvider';
import type { Tag } from '@/lib/types';
import { TAG_COLOR_SWATCHES } from '@/lib/tags';

interface ReaderHeaderProps {
  title: string;
  textId: number;
  initialTags: Tag[];
}

export function ReaderHeader({ title: initialTitle, textId, initialTags }: ReaderHeaderProps) {
  const router = useRouter();
  const { reparseSingle } = useReparse();
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTagging, setIsTagging] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [renameError, setRenameError] = useState('');

  function startRename() {
    setInputValue(title);
    setRenameError('');
    setIsRenaming(true);
  }

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed === '') {
      setRenameError('Title cannot be empty');
      return;
    }
    setRenameError('');
    await fetch(`/api/texts/${textId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    });
    setTitle(trimmed);
    setIsRenaming(false);
  }

  async function handleReparse() {
    await reparseSingle(textId, title);
    router.refresh();
  }

  async function handleDelete() {
    await fetch(`/api/texts/${textId}`, { method: 'DELETE' });
    router.push('/');
  }

  return (
    <header className="mb-6">
      {/* Back + overflow menu row */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="font-en text-[13px] font-medium inline-flex items-center gap-1"
          style={{ color: 'var(--yg-ink-soft)', textDecoration: 'none' }}
        >
          ← Library
        </Link>
        <OverflowMenu
          onTags={() => setIsTagging(true)}
          onRename={startRename}
          onDelete={() => setIsDeleting(true)}
          onReparse={() => { void handleReparse(); }}
        />
      </div>

      {/* Title card */}
      <div
        className="flex items-center gap-4 rounded-xl px-7 py-5 border"
        style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
      >
        <div
          className="w-14 h-[76px] rounded-md flex items-center justify-center shrink-0 font-jp text-[22px] font-semibold"
          style={{
            background: 'linear-gradient(160deg, var(--yg-coral), var(--yg-coral-dark))',
            color: '#faf3df',
            boxShadow: '0 3px 10px rgba(157, 90, 106, 0.24)',
          }}
          aria-hidden="true"
        >
          文
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-en text-[10px] font-semibold tracking-[1.8px] uppercase mb-1"
            style={{ color: 'var(--yg-coral)' }}
          >
            Reading
          </div>
          {isRenaming ? (
            <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
              <input
                aria-label="Text title"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                className="flex-1 font-jp text-[22px] font-medium rounded px-2 py-0.5 min-w-0"
                style={{
                  background: 'var(--yg-paper)',
                  border: '1px solid var(--yg-coral)',
                  color: 'var(--yg-ink)',
                  outline: 'none',
                }}
                autoFocus
              />
              {renameError !== '' && (
                <span role="alert" className="font-en text-xs" style={{ color: 'var(--yg-coral-dark)' }}>
                  {renameError}
                </span>
              )}
              <button
                type="submit"
                className="font-en text-xs font-medium min-h-11 px-2"
                style={{ color: 'var(--yg-bamboo-dark)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="font-en text-xs min-h-11 px-2"
                style={{ color: 'var(--yg-ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <h1 className="font-jp text-[26px] font-medium tracking-tight leading-tight" style={{ color: 'var(--yg-ink)' }}>
                {title}
              </h1>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map(tag => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-en text-[11px]"
                      style={{ background: 'var(--yg-rule-soft)', color: 'var(--yg-ink-soft)' }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: TAG_COLOR_SWATCHES[tag.color] }}
                        aria-hidden="true"
                      />
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isDeleting && (
        <ConfirmDialog
          message={`Delete "${title}"? This action cannot be undone.`}
          onConfirm={() => { void handleDelete(); }}
          onCancel={() => setIsDeleting(false)}
        />
      )}

      {isTagging && (
        <TagPicker
          textId={textId}
          currentTags={tags}
          onClose={() => setIsTagging(false)}
          onSaved={savedTags => { setTags(savedTags); setIsTagging(false); }}
        />
      )}
    </header>
  );
}
