import { useState, useEffect } from 'react'
import { storage } from '@/lib/firebase'

interface StorageImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  storageUrl: string
}

const FIREBASE_STORAGE_BASE = 'https://firebasestorage.googleapis.com'

/**
 * Converts any Firebase Storage reference to a public ?alt=media URL.
 *
 * Storage rules for game-assets and import-staging are set to `allow read: if true`,
 * so ?alt=media works without a token. This avoids getDownloadURL which requires
 * download tokens in the file metadata.
 *
 * Handles:
 *  - Tokenized HTTPS URL  → returned as-is (token already present)
 *  - Un-tokenized HTTPS URL → ?alt=media appended
 *  - Raw storage path (e.g. "import-staging/…") → full ?alt=media URL built
 */
function toPublicUrl(storageUrl: string): string {
  // Already a tokenized URL — use directly
  if (storageUrl.startsWith('https://') && storageUrl.includes('token=')) {
    return storageUrl
  }

  // Un-tokenized Firebase Storage HTTPS URL — just append ?alt=media
  if (storageUrl.startsWith(FIREBASE_STORAGE_BASE)) {
    const sep = storageUrl.includes('?') ? '&' : '?'
    return `${storageUrl}${sep}alt=media`
  }

  // Raw storage path — build the full URL using the configured bucket
  const bucket = storage.app.options.storageBucket!
  const encodedPath = encodeURIComponent(storageUrl)
  return `${FIREBASE_STORAGE_BASE}/v0/b/${bucket}/o/${encodedPath}?alt=media`
}

/**
 * Renders a Firebase Storage image.
 * Game image paths are publicly readable, so images load without auth tokens.
 */
export function StorageImage({ storageUrl, alt, ...rest }: StorageImageProps) {
  const [error, setError] = useState(false)

  // Recompute src whenever storageUrl changes
  const src = toPublicUrl(storageUrl)

  // Reset error state if the URL changes
  useEffect(() => { setError(false) }, [storageUrl])

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-[var(--surface2)] rounded-xl text-[var(--text2)] text-sm"
        style={rest.style}
      >
        Image unavailable
      </div>
    )
  }

  return <img src={src} alt={alt ?? 'Question image'} onError={() => setError(true)} {...rest} />
}
