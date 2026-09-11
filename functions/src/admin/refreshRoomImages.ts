import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAdmin, db } from '../shared/helpers'

const schema = z.object({ roomId: z.string().min(1) })

/**
 * Refreshes imageStorageUrl on all room questions from their source game questions.
 * Call this after re-importing a game to repair an existing room's image URLs.
 */
export async function refreshRoomImagesFn(
  request: CallableRequest,
): Promise<{ updated: number }> {
  requireAdmin(request)
  const { roomId } = schema.parse(request.data)
  const firestore = db()

  const roomRef  = firestore.collection('rooms').doc(roomId)
  const roomSnap = await roomRef.get()
  if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
  const room = roomSnap.data()!
  const gameId = room['gameId'] as string

  // Read all room questions
  const roomQsSnap = await roomRef.collection('questions').get()

  let updated = 0
  const batch = firestore.batch()

  await Promise.all(roomQsSnap.docs.map(async roomQDoc => {
    const roomQ = roomQDoc.data()
    if (roomQ['gameType'] !== 'GUESS_THE_PICTURE') return

    const roundId    = roomQ['roundId'] as string
    const questionId = roomQ['questionId'] as string

    const gameQRef  = firestore
      .collection('games').doc(gameId)
      .collection('rounds').doc(roundId)
      .collection('questions').doc(questionId)
    const gameQSnap = await gameQRef.get()
    if (!gameQSnap.exists) return

    const newUrl = (gameQSnap.data()!['imageStorageUrl'] as string | null) ?? null
    if (newUrl === (roomQ['imageStorageUrl'] ?? null)) return // no change needed

    batch.update(roomQDoc.ref, { imageStorageUrl: newUrl })
    updated++
  }))

  if (updated > 0) await batch.commit()

  return { updated }
}
