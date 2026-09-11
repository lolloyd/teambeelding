import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db, increment } from '../shared/helpers'
import { validatePlayerName } from '../shared/nameValidation'

const schema = z.object({
  roomCode:    z.string().length(6),
  displayName: z.string().min(1).max(50),
})

const MAX_PLAYERS = 100

export async function joinRoomFn(request: CallableRequest): Promise<{ roomId: string }> {
  const token = requireAuth(request)
  const { roomCode, displayName } = validatePayload(schema, request.data)

  const firestore = db()

  // Resolve room code
  const codeDoc = await firestore.collection('roomCodes').doc(roomCode).get()
  if (!codeDoc.exists) throw new HttpsError('not-found', 'Room not found.')
  const { roomId } = codeDoc.data() as { roomId: string }

  // Load app config for name validation
  const configDoc = await firestore.collection('appConfig').doc('public').get()
  const config = configDoc.exists ? configDoc.data()! : {}
  const maxLen      = (config['maxPlayerNameLength'] as number | undefined) ?? 20
  const blockedWords = (config['blockedWords'] as string[] | undefined) ?? []

  // Validate name
  const nameResult = validatePlayerName(displayName, { maxLength: maxLen, blockedWords })
  if (!nameResult.valid) {
    throw new HttpsError('invalid-argument', `INVALID_NAME: ${nameResult.errorCode}`)
  }
  const normalizedName = nameResult.normalizedName

  // Run join in a transaction
  await firestore.runTransaction(async tx => {
    const roomRef   = firestore.collection('rooms').doc(roomId)
    const playerRef = firestore.collection('rooms').doc(roomId).collection('players').doc(token['uid'])
    const nameRef   = firestore.collection('rooms').doc(roomId).collection('nameReservations').doc(normalizedName)

    const [roomSnap, playerSnap, nameSnap] = await Promise.all([
      tx.get(roomRef),
      tx.get(playerRef),
      tx.get(nameRef),
    ])

    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
    const room = roomSnap.data()!

    if (room['phase'] === 'COMPLETED') throw new HttpsError('failed-precondition', 'EXPIRED: Game has ended.')
    if (room['expiresAt'] && (room['expiresAt'] as number) < Date.now()) {
      throw new HttpsError('failed-precondition', 'EXPIRED: Game has expired.')
    }

    // Already in the room — idempotent
    if (playerSnap.exists) return

    // Room full
    const playerCount = (room['playerCount'] as number) ?? 0
    if (playerCount >= MAX_PLAYERS) throw new HttpsError('resource-exhausted', 'ROOM_FULL')

    // Name taken
    if (nameSnap.exists) throw new HttpsError('already-exists', 'NAME_TAKEN: That name is already in use.')

    const now    = Date.now()
    const isLate = room['phase'] !== 'LOBBY'
    const eligibleFromIndex = isLate ? ((room['currentSequenceIndex'] as number) ?? -1) + 1 : 0

    // Reserve name
    tx.set(nameRef, { playerUid: token['uid'], reservedAt: now })

    // Create player doc
    tx.set(playerRef, {
      playerUid:               token['uid'],
      displayName:             displayName.trim(),
      normalizedName,
      roomId,
      totalScore:              0,
      roundScores:             {},
      joinedAt:                now,
      lateJoiner:              isLate,
      eligibleFromSequenceIndex: eligibleFromIndex,
      status:                  'active',
      answeredCount:           0,
      lastAnsweredSequenceIndex: null,
      correctCount:            0,
      incorrectCount:          0,
      avgResponseTimeMs:       0,
    })

    // Increment player count
    tx.update(roomRef, { playerCount: increment(1) })
  })

  return { roomId }
}
