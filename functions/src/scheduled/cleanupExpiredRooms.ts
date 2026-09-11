import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

const EXPIRY_BUFFER_MS = 0 // clean up exactly at expiresAt

export async function cleanupExpiredRoomsFn(_context: unknown): Promise<void> {
  const firestore = admin.firestore()
  const now = Date.now()

  const expiredRooms = await firestore
    .collection('rooms')
    .where('expiresAt', '<=', now - EXPIRY_BUFFER_MS)
    .where('expiresAt', '>', 0)
    .limit(50)
    .get()

  if (expiredRooms.empty) {
    functions.logger.info('cleanupExpiredRooms: no expired rooms found.')
    return
  }

  functions.logger.info(`cleanupExpiredRooms: cleaning ${expiredRooms.size} rooms.`)

  for (const roomDoc of expiredRooms.docs) {
    try {
      const roomId = roomDoc.id
      const roomCode = roomDoc.data()['roomCode'] as string | undefined

      // Recursive delete room and all subcollections
      await firestore.recursiveDelete(firestore.collection('rooms').doc(roomId))

      // Remove room code mapping
      if (roomCode) {
        await firestore.collection('roomCodes').doc(roomCode).delete()
      }

      functions.logger.info(`cleanupExpiredRooms: deleted room ${roomId} (${roomCode})`)
    } catch (err) {
      functions.logger.error(`cleanupExpiredRooms: failed to delete room ${roomDoc.id}`, err)
      // Continue with next room — do not throw
    }
  }
}
