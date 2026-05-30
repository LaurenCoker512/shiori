export type WordStatus = 'unseen' | 'seen' | 'known';
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type FrequencyTier = 'very-common' | 'common' | 'uncommon' | 'rare' | 'very-rare';
export type TagColor = 'coral' | 'bamboo' | 'indigo' | 'gold';

export interface Tag {
  id: number;
  name: string;
  color: TagColor;
}

export interface Token {
  surface: string;
  dictionary_form: string;
  reading: string;
  dict_reading: string;
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
  frequency_tier: FrequencyTier | null;
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

export interface JMdictSense {
  pos: string[];
  glosses: string[];
  info?: string;
}

export interface JMdictEntry {
  id: number;
  senses: JMdictSense[];
  jlpt_level: JlptLevel | null;
  canonicalForm: string;
  derivationChain?: string[];
}

export function parseTranslations(translation: string | null): string[] {
  if (!translation) return [];
  try {
    return JSON.parse(translation) as string[];
  } catch {
    return translation.split(';').map(s => s.trim()).filter(Boolean);
  }
}
