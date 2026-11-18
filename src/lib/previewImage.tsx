import type { ReactNode } from 'react'

// The colors of the app, written out because the preview images are drawn without its stylesheet.
export const PREVIEW_COLORS = {
  desk: '#e9ecf3',
  sheet: '#ffffff',
  ink: '#151b33',
  muted: '#5a6282',
  line: '#d5d9e6',
  pen: '#2440d8',
  yellow: '#ffe873',
  green: '#a8f0c6',
  pink: '#ffc4d2',
} as const

export const PREVIEW_SIZE = { width: 1200, height: 630 }

// A white sheet on the gray desk, with the name of the app on top, as every page of the app looks.
export function PreviewSheet({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: PREVIEW_COLORS.desk, padding: 48 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: PREVIEW_COLORS.sheet,
          border: `2px solid ${PREVIEW_COLORS.line}`,
          borderRadius: 28,
          padding: '44px 56px',
          color: PREVIEW_COLORS.ink,
          fontFamily: TEXT_FONT,
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, fontFamily: DISPLAY_FONT, fontWeight: 700, letterSpacing: -0.5 }}>Practices</div>
        {children}
      </div>
    </div>
  )
}

// The status written with a highlighter, as on the page of the practice.
export function PreviewMark({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignSelf: 'flex-start',
        background: color,
        borderRadius: '16px 8px 18px 9px',
        padding: '6px 18px',
        fontSize: 28,
        fontFamily: DISPLAY_FONT,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  )
}

// Long titles shrink so they fit in two lines.
export const titleSize = (title: string) => (title.length > 48 ? 54 : title.length > 28 ? 64 : 76)

// The two typefaces of the app: Bricolage Grotesque for titles and Instrument Sans for the rest. Google Fonts serves a TTF
// to a request with no browser agent, with only the letters asked for. Without them the picture keeps the default typeface.
const loadGoogleFont = async (family: string, weight: 400 | 700, text: string) => {
  const query = `family=${family.replaceAll(' ', '+')}:wght@${weight}&text=${encodeURIComponent(text)}`
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${query}`)).text()
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
  if (!url) throw new Error(`No font file for ${family}`)
  return { name: family, data: await (await fetch(url)).arrayBuffer(), weight, style: 'normal' as const }
}

// The letters every picture uses, so one download of each typeface serves every practice and poll on a warm server.
const DISPLAY_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚÑÜáéíóúñü0123456789 .,:;!?¿¡()&-+/\'"'
const BODY_LETTERS = DISPLAY_LETTERS

let cachedFonts: Promise<Awaited<ReturnType<typeof loadGoogleFont>>[]> | null = null

// The typefaces for a picture. A title with letters outside the common set asks for them on its own.
export const loadPreviewFonts = async (displayText: string, bodyText: string) => {
  const commonLetters = new Set(DISPLAY_LETTERS)
  const fitsCommonSet = [...displayText, ...bodyText].every((letter) => commonLetters.has(letter))
  try {
    if (!fitsCommonSet) {
      return await Promise.all([loadGoogleFont('Bricolage Grotesque', 700, displayText), loadGoogleFont('Instrument Sans', 400, bodyText)])
    }
    cachedFonts ??= Promise.all([loadGoogleFont('Bricolage Grotesque', 700, DISPLAY_LETTERS), loadGoogleFont('Instrument Sans', 400, BODY_LETTERS)])
    return await cachedFonts
  } catch {
    // A failed download is tried again on the next picture.
    cachedFonts = null
    return []
  }
}

// Chat apps give up on a slow picture. The CDN keeps each one a few minutes and serves the old one while it draws a new one.
export const PREVIEW_HEADERS = { 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400' }

export const DISPLAY_FONT = "'Bricolage Grotesque'"
const TEXT_FONT = "'Instrument Sans'"
