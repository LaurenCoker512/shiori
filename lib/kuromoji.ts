import 'server-only';

type Tokenizer = Awaited<ReturnType<
  import('@patdx/kuromoji').TokenizerBuilder['build']
>>;

let tokenizer: Tokenizer | null = null;

async function getTokenizer(): Promise<Tokenizer> {
  if (tokenizer) return tokenizer;
  const kuromoji = await import('@patdx/kuromoji');
  const NodeDictionaryLoader = (await import('@patdx/kuromoji/node')).default;
  const path = await import('path');
  const loader = new NodeDictionaryLoader({
    dic_path: path.join(process.cwd(), 'node_modules/@patdx/kuromoji/dict/'),
  });
  tokenizer = await new kuromoji.TokenizerBuilder({ loader }).build();
  return tokenizer;
}

export async function kuromojiTokenize(text: string): Promise<import('@patdx/kuromoji').IpadicFeatures[]> {
  const t = await getTokenizer();
  return t.tokenize(text);
}
