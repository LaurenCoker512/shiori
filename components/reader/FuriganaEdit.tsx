'use client';

import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';

interface FuriganaEditProps {
  wordId: number;
  surfaceForm: string;
  currentReading: string;
  onSave: (newReading: string) => void;
  onCancel: () => void;
}

export function FuriganaEdit({ wordId, surfaceForm, currentReading, onSave, onCancel }: FuriganaEditProps) {
  const [reading, setReading] = useState(currentReading);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch('/api/furigana-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_id: wordId, surface_form: surfaceForm, corrected_reading: reading }),
    });
    setSaving(false);
    onSave(reading);
  }

  return (
    <span className="inline-flex flex-col gap-1 p-2 bg-white border rounded shadow-md text-sm z-10 relative">
      <input
        aria-label={`Furigana reading for ${surfaceForm}`}
        value={reading}
        onChange={e => setReading(e.target.value)}
        className="border rounded px-1"
      />
      {saving ? (
        <Spinner />
      ) : (
        <span className="flex gap-1">
          <button type="button" onClick={handleSave} className="min-h-11 px-2 inline-flex items-center text-blue-600 hover:underline">
            Save
          </button>
          <button type="button" onClick={onCancel} className="min-h-11 px-2 inline-flex items-center text-gray-500 hover:underline">
            Cancel
          </button>
        </span>
      )}
    </span>
  );
}
