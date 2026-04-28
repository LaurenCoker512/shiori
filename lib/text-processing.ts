import { remark } from 'remark';
import strip from 'strip-markdown';
import { visit } from 'unist-util-visit';
import type { Root, Heading } from 'mdast';
import { parse } from 'node-html-parser';
import type { Sentence } from './types';

export async function processMarkdown(raw: string): Promise<string> {
  const withSentinels = await remark()
    .use(() => (tree: Root) => {
      visit(tree, 'heading', (node: Heading) => {
        const textNode = node.children[0];
        if (textNode?.type === 'text') {
          textNode.value = `__HEADING_${node.depth}__${textNode.value}`;
        }
        node.type = 'paragraph' as 'heading';
      });
    })
    .use(strip)
    .process(raw);
  return String(withSentinels)
    .trim()
    .replace(/\\_\\_HEADING\\_([1-6])\\_\\_/g, '__HEADING_$1__');
}

export function processHtml(raw: string): string {
  const root = parse(raw);
  root.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li').forEach(el => {
    el.insertAdjacentHTML('afterend', '\n\n');
  });
  root.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  return (root.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

const HEADING_SENTINEL = /^__HEADING_([1-6])__(.*)$/;

export function parseHeadingSentinels(sentences: Sentence[]): Sentence[] {
  return sentences.map(s => {
    const match = HEADING_SENTINEL.exec(s.raw);
    if (!match) return s;
    const level = parseInt(match[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
    const cleanRaw = match[2].trim();
    return {
      ...s,
      raw: cleanRaw,
      is_heading: true,
      heading_level: level,
      tokens: s.tokens.map(t => ({
        ...t,
        surface: t.surface.replace(HEADING_SENTINEL, '$2'),
        dictionary_form: t.dictionary_form.replace(HEADING_SENTINEL, '$2'),
      })),
    };
  });
}
