'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OverflowMenu } from '@/components/ui/OverflowMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ReaderHeaderProps {
  title: string;
  textId: number;
}

export function ReaderHeader({ title: initialTitle, textId }: ReaderHeaderProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  async function handleDelete() {
    await fetch(`/api/texts/${textId}`, { method: 'DELETE' });
    router.push('/');
  }

  return (
    <header className="flex items-center justify-between py-4 border-b mb-6">
      <Link href="/" className="text-blue-600 hover:underline text-sm shrink-0">
        ← Back
      </Link>
      {isRenaming ? (
        <form onSubmit={handleRenameSubmit} className="flex-1 flex items-center gap-2 px-4">
          <input
            aria-label="Text title"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            className="border rounded px-2 py-1 text-xl font-bold flex-1"
            autoFocus
          />
          {renameError !== '' && (
            <span role="alert" className="text-red-600 text-sm">{renameError}</span>
          )}
          <button type="submit" className="text-blue-600 hover:underline text-sm">
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsRenaming(false)}
            className="text-gray-500 hover:underline text-sm"
          >
            Cancel
          </button>
        </form>
      ) : (
        <h1 className="text-xl font-bold flex-1 text-center px-4">{title}</h1>
      )}
      <OverflowMenu onRename={startRename} onDelete={() => setIsDeleting(true)} />
      {isDeleting && (
        <ConfirmDialog
          message={`Delete "${title}"? This action cannot be undone.`}
          onConfirm={() => { void handleDelete(); }}
          onCancel={() => setIsDeleting(false)}
        />
      )}
    </header>
  );
}
