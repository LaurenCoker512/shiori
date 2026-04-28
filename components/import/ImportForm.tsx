'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { detectFormat } from '@/lib/format-detection';
import { processMarkdown, processHtml } from '@/lib/text-processing';
import { Spinner } from '@/components/ui/Spinner';

const LONG_TEXT_THRESHOLD = 30000;

export function ImportForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [formatOverride, setFormatOverride] = useState<'html' | 'markdown' | null>(null);
  const [activeFormat, setActiveFormat] = useState<'html' | 'markdown'>('markdown');
  const [isLongText, setIsLongText] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fmt = formatOverride ?? detectFormat(content);
    setActiveFormat(fmt);

    if (!content) {
      setIsLongText(false);
      return;
    }

    if (fmt === 'html') {
      setIsLongText(processHtml(content).length > LONG_TEXT_THRESHOLD);
      return;
    }

    let cancelled = false;
    void processMarkdown(content).then(cleaned => {
      if (!cancelled) setIsLongText(cleaned.length > LONG_TEXT_THRESHOLD);
    });
    return () => {
      cancelled = true;
    };
  }, [content, formatOverride]);

  function toggleFormat() {
    setFormatOverride(prev => {
      if (prev === null) {
        return detectFormat(content) === 'html' ? 'markdown' : 'html';
      }
      return prev === 'html' ? 'markdown' : 'html';
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          ...(formatOverride !== null && { formatOverride }),
        }),
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
        <label htmlFor="content" className="font-medium">Content</label>
        <textarea
          id="content"
          value={content}
          onChange={e => setContent(e.target.value)}
          className="border rounded px-3 py-2 h-48 resize-y"
        />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span>
          Format: <span data-testid="format-label">{activeFormat}</span>
        </span>
        <button
          type="button"
          onClick={toggleFormat}
          className="underline text-blue-600"
        >
          Switch to {activeFormat === 'html' ? 'markdown' : 'html'}
        </button>
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
          disabled={!title.trim() || isSubmitting}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Import
        </button>
        {isSubmitting && <Spinner />}
      </div>
    </form>
  );
}
