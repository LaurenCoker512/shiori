import Link from 'next/link';

interface ComprehensionEntry {
  text_id: number;
  title: string;
  last_read_at: string | null;
  pct_known: number;
}

interface ComprehensionListProps {
  comprehension: ComprehensionEntry[];
}

export function ComprehensionList({ comprehension }: ComprehensionListProps) {
  if (comprehension.length === 0) {
    return <p className="text-gray-500 text-sm">No texts imported yet.</p>;
  }

  return (
    <ul className="divide-y divide-gray-200">
      {comprehension.map(entry => (
        <li key={entry.text_id} className="py-3 flex justify-between items-center gap-4">
          <Link
            href={`/texts/${entry.text_id}`}
            className="text-blue-600 hover:underline font-medium truncate"
          >
            {entry.title}
          </Link>
          <span className="text-sm text-gray-600 shrink-0">{entry.pct_known}% known</span>
        </li>
      ))}
    </ul>
  );
}
