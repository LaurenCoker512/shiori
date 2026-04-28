import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import type { ParsedContent, Word, FuriganaOverride } from '@/lib/types';
import { ReaderHeader } from '@/components/reader/ReaderHeader';
import { ReaderContent } from '@/components/reader/ReaderContent';

interface TextRow {
  id: number;
  title: string;
  parsed_content: ParsedContent;
}

export default async function ReaderPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) notFound();

  const textResult = await query<TextRow>(
    'SELECT id, title, parsed_content FROM texts WHERE id = $1 AND user_id = 1',
    [id],
  );

  if (textResult.rows.length === 0) notFound();

  await query('UPDATE texts SET last_read_at = NOW() WHERE id = $1', [id]);

  const text = textResult.rows[0];

  const wordsResult = await query<Word>('SELECT * FROM words WHERE user_id = 1');
  const wordStatusMap: Record<string, Word> = {};
  for (const word of wordsResult.rows) {
    wordStatusMap[`${word.dictionary_form}|${word.reading}`] = word;
  }

  const furiganaResult = await query<FuriganaOverride>(
    'SELECT word_id, surface_form, corrected_reading FROM furigana_overrides WHERE user_id = 1',
  );

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <ReaderHeader title={text.title} textId={text.id} />
      <ReaderContent
        content={text.parsed_content}
        wordStatusMap={wordStatusMap}
        furiganaOverrides={furiganaResult.rows}
        textId={text.id}
      />
    </main>
  );
}
