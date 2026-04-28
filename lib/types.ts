export type WordStatus = 'unseen' | 'seen' | 'known';
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface Token {
  surface: string;
  dictionary_form: string;
  reading: string;
  pos: string;
  is_content_word: boolean;
}

export interface Sentence {
  sentence_index: number;
  raw: string;
  tokens: Token[];
  is_heading?: boolean;
  heading_level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export type ParsedContent = Sentence[];

export interface Word {
  id: number;
  user_id: number;
  dictionary_form: string;
  reading: string;
  status: WordStatus;
  translation: string | null;
  user_translation: string | null;
  jlpt_level: JlptLevel | null;
  seen_at: string | null;
  known_at: string | null;
}

export interface GrammarPattern {
  id: number;
  pattern: string;
  description_en: string;
  jlpt_level: JlptLevel | null;
  first_encountered_at: string;
  sentence_count?: number;
}

export interface FuriganaOverride {
  word_id: number;
  surface_form: string;
  corrected_reading: string;
}

export function parseTranslations(translation: string | null): string[] {
  if (!translation) return [];
  try {
    return JSON.parse(translation) as string[];
  } catch {
    return translation.split(';').map(s => s.trim()).filter(Boolean);
  }
}
