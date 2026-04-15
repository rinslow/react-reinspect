import * as Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-json'

type SupportedPrismLanguage = 'javascript' | 'json'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function getLanguageGrammar(language: SupportedPrismLanguage): Prism.Grammar | null {
  const grammar = Prism.languages[language]
  return grammar ?? null
}

export function highlightCode(
  value: string,
  language: SupportedPrismLanguage,
): string {
  const grammar = getLanguageGrammar(language)
  if (!grammar) {
    return escapeHtml(value)
  }

  try {
    return Prism.highlight(value, grammar, language)
  } catch {
    return escapeHtml(value)
  }
}
