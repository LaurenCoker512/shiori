import { describe, it, expect } from 'vitest';
import { detectFormat } from '@/lib/format-detection';

describe('detectFormat', () => {
  it('detects <p>text</p> as html', () => {
    expect(detectFormat('<p>text</p>')).toBe('html');
  });

  it('detects <br/> as html', () => {
    expect(detectFormat('<br/>')).toBe('html');
  });

  it('detects <h1 class="title"> as html', () => {
    expect(detectFormat('<h1 class="title">見出し</h1>')).toBe('html');
  });

  it('detects plain Japanese text as markdown', () => {
    expect(detectFormat('これは日本語のテキストです。')).toBe('markdown');
  });

  it('detects markdown with # Heading as markdown', () => {
    expect(detectFormat('# 見出し\n本文です。')).toBe('markdown');
  });

  it('detects markdown with **bold** as markdown', () => {
    expect(detectFormat('これは**太字**です。')).toBe('markdown');
  });

  it('detects mixed text with no recognized HTML tags as markdown', () => {
    expect(detectFormat('Some text with <random> tags and content')).toBe('markdown');
  });
});
