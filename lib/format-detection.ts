const HTML_TAG_PATTERN = /<(p|div|span|br|h[1-6]|ul|ol|li|a|strong|em)[\s/>]/i;

export function detectFormat(content: string): 'html' | 'markdown' {
  return HTML_TAG_PATTERN.test(content) ? 'html' : 'markdown';
}
