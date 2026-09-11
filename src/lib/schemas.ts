import { z } from 'zod'
import type { GameType, QuestionOrderMode } from '@/types'

// ── Shared enums ──────────────────────────────────────────────────────────────

export const GameTypeSchema = z.enum(['NAME_THE_SONG', 'GUESS_THE_PICTURE']) satisfies z.ZodType<GameType>
export const QuestionOrderModeSchema = z.enum(['EXACT', 'RANDOM']) satisfies z.ZodType<QuestionOrderMode>

// ── Room schemas ──────────────────────────────────────────────────────────────

export const RoomCodeSchema = z
  .string()
  .length(6)
  .regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/, 'Invalid room code format')

export const DisplayNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(32, 'Name is too long')
  .transform(s => s.trim())
  .refine(s => s.length > 0, 'Name cannot be empty')
  .refine(s => /[a-zA-Z0-9]/.test(s), 'Name must contain at least one letter or number')
  .refine(s => !/<|>|&|"|'|`|\/|\\/.test(s), 'Name contains invalid characters')

// ── Callable function payloads ────────────────────────────────────────────────

export const CreateRoomPayloadSchema = z.object({
  gameId: z.string().min(1),
})

export const JoinRoomPayloadSchema = z.object({
  roomCode: RoomCodeSchema,
  displayName: DisplayNameSchema,
})

export const StartGamePayloadSchema = z.object({
  roomId: z.string().min(1),
})

export const StartQuestionPayloadSchema = z.object({
  roomId: z.string().min(1),
  questionInstanceId: z.string().min(1),
})

export const PauseQuestionPayloadSchema = z.object({
  roomId: z.string().min(1),
})

export const ResumeQuestionPayloadSchema = z.object({
  roomId: z.string().min(1),
})

export const CloseQuestionPayloadSchema = z.object({
  roomId: z.string().min(1),
})

export const SubmitAnswerPayloadSchema = z.object({
  roomId: z.string().min(1),
  questionInstanceId: z.string().min(1),
  choiceKey: z.string().min(1),
})

export const RevealAnswerPayloadSchema = z.object({
  roomId: z.string().min(1),
  questionInstanceId: z.string().min(1),
})

export const SkipQuestionPayloadSchema = z.object({
  roomId: z.string().min(1),
  questionInstanceId: z.string().min(1),
})

export const ShowLeaderboardPayloadSchema = z.object({
  roomId: z.string().min(1),
})

export const PrepareNextQuestionPayloadSchema = z.object({
  roomId: z.string().min(1),
})

export const AdjustScorePayloadSchema = z.object({
  roomId: z.string().min(1),
  playerUid: z.string().min(1),
  amount: z.number().int(),
  reason: z.string().min(1).max(200),
})

export const RemovePlayerPayloadSchema = z.object({
  roomId: z.string().min(1),
  playerUid: z.string().min(1),
})

export const EndGamePayloadSchema = z.object({
  roomId: z.string().min(1),
})

export const PublishGamePayloadSchema = z.object({
  gameId: z.string().min(1),
})

export const UnpublishGamePayloadSchema = z.object({
  gameId: z.string().min(1),
})

export const DeleteGamePayloadSchema = z.object({
  gameId: z.string().min(1),
})

// ── Import schemas ─────────────────────────────────────────────────────────────

export const ImportManifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  packageName: z.string().min(1),
  exportedAt: z.string(),
  application: z.literal('TeamBeelding'),
})

export const ImportGameRowSchema = z.object({
  game_key: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  estimated_duration_minutes: z.number().int().positive().optional(),
  question_order_mode: QuestionOrderModeSchema,
  default_duration_seconds: z.number().int().min(5).max(120),
  incorrect_penalty_points: z.number().int().min(0),
  published: z.boolean(),
})

export const ImportRoundRowSchema = z.object({
  game_key: z.string().min(1),
  round_key: z.string().min(1).max(64),
  round_number: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  game_type: GameTypeSchema,
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  difficulty: z.string().max(50).optional(),
  question_order_mode: QuestionOrderModeSchema,
})

export const ImportQuestionRowSchema = z.object({
  game_key: z.string().min(1),
  round_key: z.string().min(1),
  question_key: z.string().min(1).max(64),
  question_number: z.number().int().positive(),
  game_type: GameTypeSchema,
  prompt: z.string().min(1).max(500),
  lyric_excerpt: z.string().max(1000).optional(),
  song_title: z.string().max(200).optional(),
  artist: z.string().max(200).optional(),
  image_path: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  difficulty: z.string().max(50).optional(),
  duration_seconds: z.number().int().min(5).max(120),
  correct_choice_key: z.string().min(1),
  is_tiebreaker: z.boolean(),
  active: z.boolean(),
})

export const ImportChoiceRowSchema = z.object({
  question_key: z.string().min(1),
  choice_key: z.string().min(1).max(64),
  choice_order: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  choice_text: z.string().min(1).max(500),
})
