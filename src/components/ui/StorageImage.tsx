import { useState, useEffect } from 'react'
import { storage } from '@/lib/firebase'

interface StorageImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  storageUrl: string
}

const FIREBASE_STORAGE_BASE = 'https://firebasestorage.googleapis.com'

/**
 * Converts any image reference to a valid, displayable URL.
 *
 * Handles:
 *  - Empty / null string -> empty
 *  - Data URIs (data:image/...) or blob URIs -> returned as-is
 *  - External HTTP/HTTPS URLs (e.g. Open Trivia DB or web images) -> returned as-is
 *  - Firebase Storage HTTPS URL -> ensuring alt=media parameter is present
 *  - Raw storage path (e.g. "game-assets/…") -> converted to full Firebase Storage URL
 */
export function toPublicUrl(storageUrl: string): string {
  if (!storageUrl) return ''

  const trimmed = storageUrl.trim()
  if (!trimmed) return ''

  // Data or Blob URLs
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed
  }

  // Full HTTP / HTTPS URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // If it's a Firebase Storage URL
    if (trimmed.startsWith(FIREBASE_STORAGE_BASE)) {
      if (trimmed.includes('token=') || trimmed.includes('alt=media')) {
        return trimmed
      }
      const sep = trimmed.includes('?') ? '&' : '?'
      return `${trimmed}${sep}alt=media`
    }
    // Any other external image URL (Open Trivia DB, imgur, etc.)
    return trimmed
  }

  // Raw Firebase Storage path (e.g., "game-assets/xyz/photo.png")
  const bucket = storage.app?.options?.storageBucket || 'teambeelding.appspot.com'
  const cleanPath = trimmed.replace(/^\/+/, '')
  const encodedPath = encodeURIComponent(cleanPath)
  return `${FIREBASE_STORAGE_BASE}/v0/b/${bucket}/o/${encodedPath}?alt=media`
}

/**
 * Renders an image safely with error handling and smooth loading fallback.
 */
export function StorageImage({ storageUrl, alt, className = '', ...rest }: StorageImageProps) {
  const [error, setError] = useState(false)

  const src = toPublicUrl(storageUrl)

  useEffect(() => {
    setError(false)
  }, [storageUrl])

  if (!src || error) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--surface2)] border border-[var(--border)] rounded-xl text-[var(--text2)] text-sm p-6 text-center ${className}`}
        style={rest.style}
      >
        🖼️ Image unavailable
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt ?? 'Question image'}
      onError={() => setError(true)}
      className={className}
      {...rest}
    />
  )
}
