import type { PlatformId } from '../types'

interface PlatformPreviewCardProps {
  platform: PlatformId
  text: string
  mediaUrls?: string[]
}

function isVideoDataUrl(url: string): boolean {
  return url.startsWith('data:video/')
}

export function PlatformPreviewCard({ platform, text, mediaUrls = [] }: PlatformPreviewCardProps) {
  if (platform === 'x') {
    return (
      <div style={{ background: '#000', borderRadius: 16, padding: '16px 16px 12px', border: '1px solid #2F3336', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: '#1D9BF0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>A</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#E7E9EA', fontSize: 14 }}>AutoSocialX</span>
              <span style={{ color: '#71767B', fontSize: 13 }}>@autosocialx · just now</span>
            </div>
            <div style={{ color: '#E7E9EA', fontSize: 14, lineHeight: 1.55, marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
            {mediaUrls.length > 0 && (
              <div style={{
                marginTop: 10,
                display: 'grid',
                gridTemplateColumns: mediaUrls.length === 1 ? '1fr' : '1fr 1fr',
                gap: 2, borderRadius: 12, overflow: 'hidden',
              }}>
                {mediaUrls.slice(0, 4).map((url, i) =>
                  isVideoDataUrl(url)
                    ? <video key={i} src={url} controls style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#111', display: 'block' }} />
                    : <img key={i} src={url} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#111', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 24, marginTop: 12, color: '#71767B', fontSize: 12 }}>
              <span>♡ 0</span><span>↺ 0</span><span>❤ 0</span><span>↑ 0</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (platform === 'linkedin') {
    return (
      <div style={{ background: '#1B1F23', borderRadius: 8, padding: '14px 16px', border: '1px solid #38434F', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: '#0077B5', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>A</div>
          <div>
            <div style={{ fontWeight: 700, color: '#E7E9EA', fontSize: 14 }}>AutoSocialX</div>
            <div style={{ color: '#B0B7BC', fontSize: 12, marginTop: 1 }}>Content Creator · just now</div>
          </div>
        </div>
        <div style={{ color: '#E7E9EA', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
        {mediaUrls.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {isVideoDataUrl(mediaUrls[0])
              ? <video src={mediaUrls[0]} controls style={{ width: '100%', borderRadius: 4, maxHeight: 340, objectFit: 'contain' }} />
              : (
                <div style={{ display: 'grid', gridTemplateColumns: mediaUrls.length === 1 ? '1fr' : '1fr 1fr', gap: 2, borderRadius: 4, overflow: 'hidden' }}>
                  {mediaUrls.slice(0, 4).map((url, i) => (
                    <img key={i} src={url} alt="" style={{ width: '100%', maxHeight: 340, objectFit: 'contain', background: '#111', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ))}
                </div>
              )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 10, color: '#B0B7BC', fontSize: 12, borderTop: '1px solid #38434F', paddingTop: 8 }}>
          <span>👍 0</span><span>💬 0</span><span>↗ 0</span>
        </div>
      </div>
    )
  }

  // ── Instagram ──────────────────────────────────────────────────────────────
  if (platform === 'instagram') {
    return (
      <div style={{ background: '#121212', borderRadius: 12, overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: 'linear-gradient(135deg,#833AB4,#E1306C,#F77737)', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, color: '#F5F5F5', fontSize: 13 }}>autosocialx</span>
        </div>
        {/* Image area */}
        {mediaUrls.length > 0
          ? isVideoDataUrl(mediaUrls[0])
            ? <video src={mediaUrls[0]} controls style={{ width: '100%', maxHeight: 400, objectFit: 'contain', background: '#000', display: 'block' }} />
            : (
              <div style={{ position: 'relative' }}>
                <img src={mediaUrls[0]} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', background: '#1a1a1a', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                {mediaUrls.length > 1 && (
                  <>
                    <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,.6)', borderRadius: 8, padding: '2px 8px', color: '#fff', fontSize: 11, fontWeight: 600 }}>1 / {mediaUrls.length}</div>
                    <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4 }}>
                      {mediaUrls.slice(0, 10).map((_, i) => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i === 0 ? '#3897F0' : 'rgba(255,255,255,.5)' }} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          : <div style={{ width: '100%', aspectRatio: '1/1', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 40 }}>📷</div>
        }
        {/* Caption */}
        <div style={{ padding: '10px 14px 12px' }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 8, color: '#F5F5F5', fontSize: 20 }}>
            <span>♡</span><span>💬</span><span>✈</span>
          </div>
          <div style={{ color: '#F5F5F5', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <span style={{ fontWeight: 700 }}>autosocialx</span>{' '}{text}
          </div>
        </div>
      </div>
    )
  }

  // ── 小红书 ──────────────────────────────────────────────────────────────────
  if (platform === 'xiaohongshu') {
    return (
      <div style={{ background: '#FEFEFE', borderRadius: 12, overflow: 'hidden', maxWidth: 360, margin: '0 auto' }}>
        {mediaUrls.length > 0
          ? isVideoDataUrl(mediaUrls[0])
            ? <video src={mediaUrls[0]} controls style={{ width: '100%', maxHeight: 480, objectFit: 'contain', background: '#000', display: 'block' }} />
            : (
              <div style={{ position: 'relative' }}>
                <img src={mediaUrls[0]} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', background: '#F4F4F4', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                {mediaUrls.length > 1 && (
                  <>
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.55)', borderRadius: 10, padding: '2px 8px', color: '#fff', fontSize: 11, fontWeight: 600 }}>1 / {mediaUrls.length}</div>
                    <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4 }}>
                      {mediaUrls.slice(0, 9).map((_, i) => (
                        <div key={i} style={{ width: i === 0 ? 12 : 6, height: 6, borderRadius: 3, background: i === 0 ? '#FF2442' : 'rgba(255,255,255,.6)' }} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          : <div style={{ width: '100%', aspectRatio: '1/1', background: '#F4F4F4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 40 }}>📷</div>
        }
        {mediaUrls.length > 1 && !isVideoDataUrl(mediaUrls[0]) && (
          <div style={{ display: 'flex', gap: 2, padding: '4px 4px 0', background: '#F9F9F9' }}>
            {mediaUrls.slice(0, 9).map((url, i) => (
              <img key={i} src={url} alt="" style={{ flex: 1, minWidth: 0, aspectRatio: '1/1', objectFit: 'cover', borderRadius: 4, opacity: i === 0 ? 1 : 0.6 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ))}
          </div>
        )}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ color: '#222', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 12, color: '#999', fontSize: 12 }}><span>♥ 0</span><span>💬 0</span><span>⭐ 0</span></div>
            <span style={{ color: '#FF2442', fontSize: 12, fontWeight: 600 }}>AutoSocialX</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Generic fallback (all other platforms) ──────────────────────────────────
  return (
    <div style={{ background: '#111318', borderRadius: 12, overflow: 'hidden', width: '100%', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,.08)' }}>
      {/* Image grid */}
      {mediaUrls.length > 0 && (
        isVideoDataUrl(mediaUrls[0])
          ? <video src={mediaUrls[0]} controls style={{ width: '100%', maxHeight: 360, objectFit: 'contain', background: '#000', display: 'block' }} />
          : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: mediaUrls.length === 1 ? '1fr' : mediaUrls.length === 2 ? '1fr 1fr' : '1fr 1fr',
              gridTemplateRows: mediaUrls.length <= 2 ? 'auto' : 'auto auto',
              gap: 2,
            }}>
              {mediaUrls.slice(0, 4).map((url, i) => (
                <div key={i} style={{ position: 'relative', aspectRatio: mediaUrls.length === 1 ? '16/9' : '1/1', overflow: 'hidden', background: '#1a1a1a' }}>
                  <img
                    src={url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {i === 3 && mediaUrls.length > 4 && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700 }}>
                      +{mediaUrls.length - 4}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
      )}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ color: '#E8E8F0', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
      </div>
    </div>
  )
}

// Platform label helper (re-exported for consumers)

