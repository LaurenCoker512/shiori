'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';

const LONG_TEXT_THRESHOLD = 30000;

export function ImportForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLongText, setIsLongText] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!title) {
      setTitle(file.name.replace(/\.txt$/i, ''));
    }

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      setContent(text);
      setIsLongText(text.length > LONG_TEXT_THRESHOLD);
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setError(data.error ?? 'Import failed');
        return;
      }
      const data = await response.json() as { id: number };
      router.push(`/texts/${data.id}`);
    } catch {
      setError('Import failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="font-medium">Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="file" className="font-medium">File</label>
        <input
          id="file"
          type="file"
          accept=".txt"
          onChange={handleFileChange}
          className="border rounded px-3 py-2"
        />
      </div>
      {isLongText && (
        <p className="text-amber-600 text-sm">
          This text is long and may take a moment to process.
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-red-600 text-sm">{error}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!title.trim() || !content || isSubmitting}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Import
        </button>
        {isSubmitting && <Spinner />}
      </div>
    </form>
  );
}
