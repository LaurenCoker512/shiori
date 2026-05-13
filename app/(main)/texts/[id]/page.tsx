import { notFound, redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import type { ParsedContent, Word, FuriganaOverride, Tag } from '@/lib/types';
import { ReaderHeader } from '@/components/reader/ReaderHeader';
import { ReaderContent } from '@/components/reader/ReaderContent';

interface TextRow {
  id: number;
  title: string;
  parsed_content: ParsedContent;
  import_status: string;
}

export default async function ReaderPage({ params }: { params: { id: string } }) {
  const user = await getSession();
  if (user === null) redirect('/login');

  const id = parseInt(params.id, 10);
  if (isNaN(id)) notFound();

  const uid = user.id;

  const textResult = await query<TextRow>(
    'SELECT id, title, parsed_content, import_status FROM texts WHERE id = $1 AND user_id = $2',
    [id, uid],
  );

  if (textResult.rows.length === 0) notFound();
  if (textResult.rows[0].import_status !== 'ready') redirect('/');

  await query('UPDATE texts SET last_read_at = NOW() WHERE id = $1', [id]);

  const text = textResult.rows[0];

  const [wordsResult, tagsResult] = await Promise.all([
    query<Word>('SELECT * FROM words WHERE user_id = $1', [uid]),
    query<Tag>(
      'SELECT tg.id, tg.name, tg.color FROM text_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.text_id = $1 ORDER BY tg.name',
      [id],
    ),
  ]);
  const wordStatusMap: Record<string, Word> = {};
  for (const word of wordsResult.rows) {
    wordStatusMap[`${word.dictionary_form}|${word.reading}`] = word;
  }

  const furiganaResult = await query<FuriganaOverride>(
    'SELECT word_id, surface_form, corrected_reading FROM furigana_overrides WHERE user_id = $1',
    [uid],
  );

  return (
    <main className="max-w-[760px] mx-auto px-4 sm:px-8 py-8">
      <ReaderHeader title={text.title} textId={text.id} initialTags={tagsResult.rows} />
      <ReaderContent
        content={text.parsed_content}
        wordStatusMap={wordStatusMap}
        furiganaOverrides={furiganaResult.rows}
        textId={text.id}
        ttsEnabled={user.google_tts_api_key !== null}
        textTitle={text.title}
        ttsVoice={user.tts_voice}
        ttsSpeakingRate={user.tts_speaking_rate}
      />
    </main>
  );
}
