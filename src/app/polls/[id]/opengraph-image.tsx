import { ImageResponse } from 'next/og'

import { pollPreview } from '+/lib/linkPreview'
import { DISPLAY_FONT, loadPreviewFonts, PREVIEW_COLORS, PREVIEW_SIZE, PreviewMark, PreviewSheet, titleSize } from '+/lib/previewImage'

export const alt = 'A poll to find the time of a practice'
export const size = PREVIEW_SIZE
export const contentType = 'image/png'

// The picture a chat app shows under the link of a poll: what it is about and what people answer.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const preview = await pollPreview(id)
  const fonts = await loadPreviewFonts(
    `Practices Finding a time Time chosen A poll 0123456789 ${preview?.title ?? ''}`,
    `${preview?.choices ?? ''} Asked by ${preview?.host ?? ''} Answer yes, if needed or no, with or without an account.`
  )

  return new ImageResponse(
    <PreviewSheet>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28, gap: 22, flexGrow: 1 }}>
        <PreviewMark color={preview?.isClosed ? PREVIEW_COLORS.green : PREVIEW_COLORS.yellow}>
          {preview?.isClosed ? 'Time chosen' : 'Finding a time'}
        </PreviewMark>
        <div
          style={{
            display: 'flex',
            fontSize: titleSize(preview?.title ?? ''),
            fontFamily: DISPLAY_FONT,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1.5,
          }}
        >
          {preview?.title ?? 'A poll'}
        </div>
        {preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 32 }}>
            <div style={{ display: 'flex' }}>{preview.choices}</div>
            <div style={{ display: 'flex', color: PREVIEW_COLORS.muted }}>Asked by {preview.host}</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', fontSize: 28, color: PREVIEW_COLORS.muted }}>Answer yes, if needed or no, with or without an account.</div>
    </PreviewSheet>,
    { ...size, fonts }
  )
}
