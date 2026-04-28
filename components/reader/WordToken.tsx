import type { Token, Word } from '@/lib/types';

interface WordTokenProps {
  token: Token;
  word: Word | null;
  furiganaOverride: string | null;
  showFurigana: boolean;
  onWordClick?: (word: Word) => void;
}

export function WordToken({ token, word, furiganaOverride, showFurigana, onWordClick }: WordTokenProps) {
  if (!token.is_content_word) {
    return <span>{token.surface}</span>;
  }

  const reading = furiganaOverride ?? token.reading;
  const statusClass = word !== null ? statusToUnderlineClass(word.status) : '';
  const showRt = showFurigana || word === null || word.status !== 'known';

  function handleClick() {
    if (word !== null && onWordClick !== undefined) {
      onWordClick(word);
    }
  }

  return (
    <ruby aria-label={reading} className={statusClass} data-word onClick={handleClick}>
      {token.surface}
      <rt aria-hidden="true" className={showRt ? '' : 'hidden'}>{reading}</rt>
    </ruby>
  );
}

function statusToUnderlineClass(status: string): string {
  switch (status) {
    case 'seen': return 'underline decoration-blue-400';
    case 'known': return 'underline decoration-green-400';
    default: return 'underline decoration-gray-300';
  }
}
