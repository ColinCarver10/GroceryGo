type SourceType = 'website' | 'instagram' | 'tiktok' | 'youtube'

const MAX_HTML_BYTES = 2_000_000
const MAX_RAW_TEXT_CHARS = 20_000
const FETCH_TIMEOUT_MS = 10_000

export interface ExtractedRecipeSource {
  sourceUrl: string
  sourceType: SourceType
  title?: string
  author?: string
  rawText: string
  structuredHints?: Record<string, unknown>
}

export async function extractRecipeSource(url: string): Promise<ExtractedRecipeSource> {
  const sourceType = classifySource(url)
  const html = await fetchHtml(url)

  const title = extractTitle(html)
  const author = extractMetaContent(html, 'author')
    || extractMetaContent(html, 'article:author')
    || undefined

  const jsonLdHints = extractRecipeJsonLd(html)
  const textParts: string[] = []

  if (title) textParts.push(`Title: ${title}`)
  if (author) textParts.push(`Author: ${author}`)

  const ogDescription = extractMetaContent(html, 'og:description')
  const metaDescription = extractMetaContent(html, 'description')
  if (ogDescription) textParts.push(`Description: ${ogDescription}`)
  if (metaDescription && metaDescription !== ogDescription) {
    textParts.push(`Meta Description: ${metaDescription}`)
  }

  if (jsonLdHints) {
    textParts.push('JSON-LD Recipe Data:')
    textParts.push(JSON.stringify(jsonLdHints))
  }

  const bodyText = stripHtmlToText(html)
  if (bodyText) textParts.push(bodyText)

  const rawText = textParts.join('\n\n').slice(0, MAX_RAW_TEXT_CHARS)

  return {
    sourceUrl: url,
    sourceType,
    title,
    author,
    rawText,
    structuredHints: jsonLdHints || undefined
  }
}

export function validateImportUrl(input: string): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return { ok: false, error: 'Please provide a valid URL.' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'Only HTTP(S) URLs are supported.' }
  }

  if (parsed.href.length > 2048) {
    return { ok: false, error: 'URL is too long.' }
  }

  if (!parsed.hostname) {
    return { ok: false, error: 'URL host is missing.' }
  }

  if (isBlockedHostname(parsed.hostname)) {
    return { ok: false, error: 'This URL host is not allowed.' }
  }

  return { ok: true, url: parsed }
}

export function classifySource(inputUrl: string): SourceType {
  const hostname = new URL(inputUrl).hostname.toLowerCase()
  if (hostname.includes('instagram.com')) return 'instagram'
  if (hostname.includes('tiktok.com')) return 'tiktok'
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
  return 'website'
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GroceryGoRecipeImporter/1.0)'
      }
    })

    if (!response.ok) {
      throw new Error(`Source request failed (${response.status})`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('URL does not appear to be an HTML page')
    }

    const html = await response.text()
    if (html.length > MAX_HTML_BYTES) {
      return html.slice(0, MAX_HTML_BYTES)
    }
    return html
  } finally {
    clearTimeout(timeout)
  }
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match?.[1]?.trim()
}

function extractMetaContent(html: string, key: string): string | null {
  const propertyRegex = new RegExp(`<meta[^>]+property=["']${escapeRegex(key)}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i')
  const nameRegex = new RegExp(`<meta[^>]+name=["']${escapeRegex(key)}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i')
  return propertyRegex.exec(html)?.[1]?.trim()
    || nameRegex.exec(html)?.[1]?.trim()
    || null
}

function extractRecipeJsonLd(html: string): Record<string, unknown> | null {
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = scriptRegex.exec(html)) !== null) {
    const jsonText = match[1]?.trim()
    if (!jsonText) continue

    try {
      const parsed = JSON.parse(jsonText) as unknown
      const recipe = findRecipeNode(parsed)
      if (recipe && typeof recipe === 'object') {
        return recipe as Record<string, unknown>
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }

  return null
}

function findRecipeNode(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeNode(item)
      if (found) return found
    }
    return null
  }

  const node = value as Record<string, unknown>
  const typeField = node['@type']
  if (typeof typeField === 'string' && typeField.toLowerCase() === 'recipe') {
    return node
  }
  if (Array.isArray(typeField) && typeField.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe')) {
    return node
  }

  if (node['@graph']) {
    const found = findRecipeNode(node['@graph'])
    if (found) return found
  }

  return null
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_RAW_TEXT_CHARS)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (normalized === 'localhost') return true
  if (normalized.endsWith('.local')) return true

  // Block direct/private IP targets to reduce SSRF risk.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
    const parts = normalized.split('.').map((p) => Number.parseInt(p, 10))
    const [a, b] = parts
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }

  if (normalized === '::1') return true
  return false
}
