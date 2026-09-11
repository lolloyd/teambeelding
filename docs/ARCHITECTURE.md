# Architecture

## Authentication Model

| User Type | Auth Method | Custom Claims |
|---|---|---|
| Admin | Email + Password | `admin: true` |
| Game Master | Anonymous Auth | none |
| Player | Anonymous Auth | none |

Authorization is enforced in both Firestore Security Rules and Cloud Functions. Anonymous UIDs are used as Player and Game Master identities.

## Authorization Model

- **Admin**: Requires `admin: true` custom claim in ID token. Verified by Cloud Functions (`requireAdmin`) and Firestore rules.
- **Game Master**: Any anonymous user who is the `hostUid` of a room. Verified by Cloud Functions per-request.
- **Player**: Any anonymous user with a document in `rooms/{roomId}/players/{uid}`.

## Firestore Collections

```
appConfig/public                     — Global settings (name length, blocked words)

games/{gameId}                       — Game template
games/{gameId}/rounds/{roundId}      — Round definition
games/{gameId}/rounds/{roundId}/questions/{questionId}   — Question (with answer key)
games/{gameId}/rounds/{roundId}/answerKeys/{questionId}  — Answer keys (Admin only)

roomCodes/{code}                     — Code → roomId lookup

rooms/{roomId}                       — Room state
rooms/{roomId}/questions/{id}        — Public question snapshot (no answer)
rooms/{roomId}/privateQuestions/{id} — Answer key + song/artist (host only)
rooms/{roomId}/players/{uid}         — Player record
rooms/{roomId}/nameReservations/{normalized} — Name uniqueness index
rooms/{roomId}/submissions/{questionId_uid}  — Player answer (player-readable own only)
rooms/{roomId}/privateResults/{questionId_uid} — Score before reveal (private)
rooms/{roomId}/scoreAdjustments/{id} — Manual score adjustment audit log
rooms/{roomId}/roundSummaries/{id}   — Per-round score summaries
```

## Storage Paths

```
game-assets/{gameId}/{imageFile}              — Published game images (Auth read, Admin write)
import-staging/{adminUid}/{importId}/{file}   — Temporary import staging (Admin only)
```

## Game State Machine

```
LOBBY
  └─► BETWEEN_QUESTIONS
        └─► QUESTION_OPEN ◄─► QUESTION_PAUSED
              └─► QUESTION_CLOSED
                    └─► ANSWER_REVEAL
                          └─► LEADERBOARD
                                ├─► BETWEEN_QUESTIONS  (next question)
                                └─► COMPLETED
```

All transitions are enforced server-side in Cloud Functions. The client UI only calls the appropriate function; the function validates and rejects invalid transitions.

## Scoring Flow

1. Player submits answer → `submitAnswer` Cloud Function
2. Function records `submission` (player-readable choice) and `privateResult` (hidden score) atomically
3. Host reveals answer → `revealAnswer` Cloud Function
4. Function marks `privateQuestion.revealed = true`, exposes song/artist on public question
5. Function reads all unrevealed `privateResults` and applies `awardedPoints` to each player's `totalScore`
6. All score changes happen atomically in a Firestore batch

**Score formula:**
```
correct: 1000 + Math.floor(200 * (remainingMs / durationMs))
incorrect: -incorrectPenaltyPoints
clamped at: 0 minimum total
```

## Answer Privacy Model

| Document | Game Master | Player (own) | Player (others) |
|---|---|---|---|
| `questions/{id}` (public) | Read | Read | Read |
| `privateQuestions/{id}` | Read (host) | No | No |
| `submissions/{id}` | No (cannot see choices) | Read | No |
| `privateResults/{id}` | Read (after reveal) | Read (after reveal) | No |

## Real-Time Listener Strategy

- **Game Master** listens to: room doc, current question doc, players collection
- **Player** listens to: room doc (phase/code), current question doc, own player doc, own submission doc
- No single shared document receives concurrent writes from all players (separate submission docs per player)

## Cleanup Process

A scheduled Cloud Function runs hourly:
1. Queries rooms where `expiresAt <= now`
2. Calls `firestore.recursiveDelete()` on each expired room
3. Removes the `roomCodes/{code}` mapping
4. Logs successes and failures separately (failures do not stop the batch)

`expiresAt` is set to `completedAt + 24 hours` when `endGame` is called.

## Major Design Decisions

- **Room as a snapshot**: All game content is copied into the room at creation time. Changes to a game template never affect a room in progress.
- **No shared answer counter**: Each player writes to their own `submissions/{questionId}_{playerUid}` doc, avoiding write contention at scale.
- **Server timestamps only**: All authoritative timestamps (question open/close, score application) use server time in Cloud Functions. The client timer uses `closesAt` received from Firestore.
- **Anonymous auth for GMs/Players**: No registration required. Identity is preserved as long as the browser retains the local Firebase Auth state.
- **Answer key separation**: `privateQuestions` and `privateResults` are never included in player-readable documents until `revealed = true`.
