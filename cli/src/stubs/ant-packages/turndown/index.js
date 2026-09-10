/**
 * TurndownService stub - Basic HTML to Markdown conversion
 * Provides lightweight HTML→Markdown without external dependencies
 */

class TurndownService {
  constructor(options = {}) {
    this.options = {
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      ...options
    }
  }

  /**
   * Convert HTML to Markdown
   */
  turndown(html) {
    if (!html || typeof html !== 'string') return ''

    let md = html

    // Remove script and style tags
    md = md.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    md = md.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

    // Headings
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')

    // Bold and italic
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')

    // Code
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```\n')

    // Links
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')

    // Images
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')

    // Lists
    md = md.replace(/<ul[^>]*>(.*?)<\/ul>/gis, '$1\n')
    md = md.replace(/<ol[^>]*>(.*?)<\/ol>/gis, '$1\n')
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')

    // Paragraphs and line breaks
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    md = md.replace(/<br\s*\/?>/gi, '\n')

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, (match, content) => {
      return content.split('\n').map(line => `> ${line}`).join('\n') + '\n'
    })

    // Horizontal rules
    md = md.replace(/<hr\s*\/?>/gi, '---\n')

    // Tables (basic)
    md = md.replace(/<table[^>]*>(.*?)<\/table>/gis, (match, content) => {
      const rows = content.match(/<tr[^>]*>(.*?)<\/tr>/gis) || []
      const result = rows.map(row => {
        const cells = row.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/gi) || []
        return cells.map(cell => cell.replace(/<[^>]+>/g, '').trim()).join(' | ')
      })
      if (result.length > 1) {
        result.splice(1, 0, result[0].split('|').map(() => '---').join(' | '))
      }
      return result.join('\n') + '\n'
    })

    // Remove remaining HTML tags
    md = md.replace(/<[^>]+>/g, '')

    // Decode HTML entities
    md = md.replace(/&amp;/g, '&')
    md = md.replace(/&lt;/g, '<')
    md = md.replace(/&gt;/g, '>')
    md = md.replace(/&quot;/g, '"')
    md = md.replace(/&#39;/g, "'")
    md = md.replace(/&nbsp;/g, ' ')

    // Clean up whitespace
    md = md.replace(/\n{3,}/g, '\n\n')
    md = md.trim()

    return md
  }

  /**
   * Add custom rule
   */
  addRule() {
    // No-op for stub
    return this
  }

  /**
   * Use plugin
   */
  use() {
    // No-op for stub
    return this
  }
}

export default TurndownService
