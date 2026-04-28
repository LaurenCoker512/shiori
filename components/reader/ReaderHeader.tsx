import Link from 'next/link';
import { OverflowMenu } from '@/components/ui/OverflowMenu';

interface ReaderHeaderProps {
  title: string;
  textId: number;
}

export function ReaderHeader({ title, textId: _textId }: ReaderHeaderProps) {
  return (
    <header className="flex items-center justify-between py-4 border-b mb-6">
      <Link href="/" className="text-blue-600 hover:underline text-sm shrink-0">
        ← Back
      </Link>
      <h1 className="text-xl font-bold flex-1 text-center px-4">{title}</h1>
      <OverflowMenu />
    </header>
  );
}
