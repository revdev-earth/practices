import { ImageResponse } from 'next/og'

import { publicPracticePreview } from '+/lib/linkPreview'
import type { PracticeStatus } from '+/lib/practiceRules'
import {
  DISPLAY_FONT,
  loadPreviewFonts,
  PREVIEW_COLORS,
  PREVIEW_HEADERS,
  PREVIEW_SIZE,
  PreviewMark,
  PreviewSheet,
  titleSize,
} from '+/lib/previewImage'

export const alt = 'A practice on Practices'
export const size = PREVIEW_SIZE
export const contentType = 'image/png'

const HIGHLIGHT: Record<PracticeStatus, string> = {
  open: PREVIEW_COLORS.yellow,
  confirmed: PREVIEW_COLORS.green,
  full: PREVIEW_COLORS.pink,
  past: PREVIEW_COLORS.desk,
}

// The marks drawn per spot never pass this many. A bigger group shows the count alone.
const LARGEST_TRACK = 20

// The picture a chat app shows under the link of a public practice: status, title, when, where and the spots.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const preview = await publicPracticePreview(id)
  // Only the letters drawn in the display typeface are downloaded.
  const fonts = await loadPreviewFonts(
    `Practices Group practice sessions 0123456789 ${preview ? `${preview.statusLabel} ${preview.title} ${preview.day}` : ''}`,
    preview ? `${preview.time} ${preview.place} 0123456789 of spots taken` : 'Practices'
  )

  if (!preview) {
    return new ImageResponse(
      <PreviewSheet>
        <div style={{ display: 'flex', marginTop: 'auto', fontSize: 64, fontFamily: DISPLAY_FONT, fontWeight: 700 }}>Group practice sessions</div>
      </PreviewSheet>,
      { ...size, fonts, headers: PREVIEW_HEADERS }
    )
  }

  const spots = Array.from({ length: Math.min(preview.maxParticipants, LARGEST_TRACK) }, (_, index) => index)

  return new ImageResponse(
    <PreviewSheet>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28, gap: 22, flexGrow: 1 }}>
        <PreviewMark color={HIGHLIGHT[preview.status]}>{preview.statusLabel}</PreviewMark>
        <div
          style={{
            display: 'flex',
            fontSize: titleSize(preview.title),
            fontFamily: DISPLAY_FONT,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1.5,
          }}
        >
          {preview.title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 32 }}>
          <div style={{ display: 'flex', fontFamily: DISPLAY_FONT, fontWeight: 700 }}>{preview.day}</div>
          <div style={{ display: 'flex' }}>{preview.time}</div>
          <div style={{ display: 'flex', color: PREVIEW_COLORS.muted }}>{preview.place}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {preview.maxParticipants <= LARGEST_TRACK && (
          <div style={{ display: 'flex', gap: 6 }}>
            {spots.map((index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  width: 30,
                  height: 16,
                  borderRadius: 5,
                  background: index < preview.taken ? PREVIEW_COLORS.pen : PREVIEW_COLORS.sheet,
                  border: `2px solid ${index < preview.taken ? PREVIEW_COLORS.pen : PREVIEW_COLORS.line}`,
                  // A gap after the spot that confirms the practice, like the line on the sheet.
                  marginRight: index === preview.minParticipants - 1 && preview.minParticipants < preview.maxParticipants ? 10 : 0,
                }}
              />
            ))}
          </div>
        )}
        <div style={{ display: 'flex', fontSize: 28, color: PREVIEW_COLORS.muted }}>
          {preview.taken} of {preview.maxParticipants} spots taken
        </div>
      </div>
    </PreviewSheet>,
    { ...size, fonts, headers: PREVIEW_HEADERS }
  )
}
