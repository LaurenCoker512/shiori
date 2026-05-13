import { ImportForm } from '@/components/import/ImportForm';

export default function ImportPage() {
  return (
    <main className="max-w-[700px] mx-auto px-4 sm:px-8 py-8 sm:py-10">
      <div className="mb-1">
        <span className="font-en text-[11px] font-semibold tracking-[1.5px] uppercase" style={{ color: 'var(--yg-coral)' }}>
          取り込み · Import
        </span>
      </div>
      <h1 className="font-jp text-[36px] font-medium tracking-tight mb-1.5" style={{ color: 'var(--yg-ink)' }}>
        新しい本を加える。
      </h1>
      <p className="font-en text-sm mb-7" style={{ color: 'var(--yg-ink-soft)' }}>
        Drop in any Japanese text. Shiori will tokenize it, attach furigana, and pull definitions for every word.
      </p>
      <ImportForm />
    </main>
  );
}
