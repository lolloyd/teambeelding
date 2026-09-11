// ── Game Types ────────────────────────────────────────────────────────────────

export type GameType = 'NAME_THE_SONG' | 'GUESS_THE_PICTURE';
export type QuestionOrderMode = 'EXACT' | 'RANDOM';

export interface Choice {
  choiceKey: string;
  choiceOrder: number;
  choiceText: string;
}

export interface Question {
  questionId: string;
  questionKey: string;   // external key from import
  questionNumber: number;
  gameType: GameType;
  prompt: string;
  // Name the Song fields
  lyricExcerpt?: string;
  songTitle?: string;
  artist?: string;
  // Guess the Picture fields
  imagePath?: string;
  imageStorageUrl?: string;
  // Common
  choices: Choice[];
  correctChoiceKey: string;  // kept server-side only; this field is NOT in public question docs
  category?: string;
  subcategory?: string;
  difficulty?: string;
  durationSeconds: number;
  isTiebreaker: boolean;
  active: boolean;
}

// Public question (no correct answer)
export type PublicQuestion = Omit<Question, 'correctChoiceKey'>;

export interface Round {
  roundId: string;
  roundKey: string;
  roundNumber: number;
  title: string;
  description?: string;
  gameType: GameType;
  category?: string;
  subcategory?: string;
  difficulty?: string;
  questionOrderMode: QuestionOrderMode;
  questions: Question[];  // used in import/export; not in Firestore doc directly
}

export interface Game {
  gameId: string;
  gameKey: string;
  title: string;
  description?: string;
  estimatedDurationMinutes?: number;
  questionOrderMode: QuestionOrderMode;
  defaultDurationSeconds: number;
  incorrectPenaltyPoints: number;
  published: boolean;
  createdAt: number;
  updatedAt: number;
  // Derived counts (denormalized for display)
  roundCount: number;
  questionCount: number;
  tiebreakerCount: number;
  gameTypes: GameType[];
  categories: string[];
  difficulties: string[];
}

// ── Room / Session Types ───────────────────────────────────────────────────────

export type RoomPhase =
  | 'LOBBY'
  | 'BETWEEN_QUESTIONS'
  | 'QUESTION_OPEN'
  | 'QUESTION_PAUSED'
  | 'QUESTION_CLOSED'
  | 'ANSWER_REVEAL'
  | 'LEADERBOARD'
  | 'COMPLETED';

export interface RoomQuestionInstance {
  questionInstanceId: string;
  questionId: string;       // reference to game question
  roundId: string;
  roundNumber: number;
  roundTitle: string;
  sequenceIndex: number;    // position in the ordered play sequence
  gameType: GameType;
  prompt: string;
  lyricExcerpt?: string;
  songTitle?: string;
  artist?: string;
  imageStorageUrl?: string;
  choices: Choice[];
  category?: string;
  subcategory?: string;
  difficulty?: string;
  durationSeconds: number;
  isTiebreaker: boolean;
  // Timer state (server timestamps in ms)
  startedAt?: number;
  closesAt?: number;
  durationMs?: number;
  remainingMsWhenPaused?: number;
  pausedAt?: number;
  // Phase
  phase: RoomPhase;
  // Revealed during ANSWER_REVEAL phase (written by revealAnswer Cloud Function)
  correctChoiceKey?: string;
}

// Private question data (answer key) — only for Cloud Functions / host
export interface PrivateQuestionData {
  questionInstanceId: string;
  correctChoiceKey: string;
  songTitle?: string;
  artist?: string;
  revealed: boolean;
}

export interface Room {
  roomId: string;
  roomCode: string;
  gameId: string;
  gameTitle: string;
  hostUid: string;
  phase: RoomPhase;
  currentQuestionInstanceId: string | null;
  currentSequenceIndex: number;
  questionSequence: string[];   // ordered list of questionInstanceIds
  totalQuestions: number;
  tiebreakerAvailable: boolean;
  playerCount: number;
  soundEnabled: boolean;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  expiresAt?: number;
  // Denormalized game snapshot info
  roundCount: number;
  questionOrderMode: QuestionOrderMode;
  incorrectPenaltyPoints: number;
  defaultDurationSeconds: number;
}

// ── Player Types ───────────────────────────────────────────────────────────────

export type PlayerStatus = 'active' | 'removed';

export interface Player {
  playerUid: string;
  displayName: string;
  normalizedName: string;
  roomId: string;
  totalScore: number;
  roundScores: Record<string, number>;  // roundId -> score
  joinedAt: number;
  lateJoiner: boolean;
  eligibleFromSequenceIndex: number;  // can only answer questions at this index and above
  status: PlayerStatus;
  answeredCount: number;
  lastAnsweredSequenceIndex: number | null;  // index of the most recent question answered (-1 or null = none)
  correctCount: number;
  incorrectCount: number;
  avgResponseTimeMs: number;
}

// ── Submission / Scoring Types ─────────────────────────────────────────────────

export interface Submission {
  submissionId: string;  // {questionInstanceId}_{playerUid}
  questionInstanceId: string;
  playerUid: string;
  roomId: string;
  choiceKey: string;
  submittedAt: number;  // server timestamp
  responseTimeMs: number;  // time from question open to submission
}

export interface PrivateResult {
  resultId: string;  // {questionInstanceId}_{playerUid}
  questionInstanceId: string;
  playerUid: string;
  roomId: string;
  choiceKey: string;
  isCorrect: boolean;
  basePoints: number;
  speedBonus: number;
  penaltyPoints: number;
  awardedPoints: number;
  responseTimeMs: number;
  revealed: boolean;  // set to true when revealAnswer is called
}

export interface ScoreAdjustment {
  adjustmentId: string;
  roomId: string;
  playerUid: string;
  hostUid: string;
  amount: number;
  reason: string;
  timestamp: number;
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  playerUid: string;
  displayName: string;
  totalScore: number;
  previousRank?: number;
  rankChange?: number;  // positive = moved up
  isCurrentPlayer?: boolean;
  isLeader?: boolean;
}

// ── Admin Settings ─────────────────────────────────────────────────────────────

export interface AppConfig {
  maxPlayerNameLength: number;
  blockedWords: string[];
  appVersion: string;
}

// ── Import / Export Types ──────────────────────────────────────────────────────

export const SCHEMA_VERSION = 1;

export interface ImportManifest {
  schemaVersion: number;
  packageName: string;
  exportedAt: string;
  application: string;
}

export interface ImportRow_Game {
  game_key: string;
  title: string;
  description?: string;
  estimated_duration_minutes?: number;
  question_order_mode: QuestionOrderMode;
  default_duration_seconds: number;
  incorrect_penalty_points: number;
  published: boolean;
}

export interface ImportRow_Round {
  game_key: string;
  round_key: string;
  round_number: number;
  title: string;
  description?: string;
  game_type: GameType;
  category?: string;
  subcategory?: string;
  difficulty?: string;
  question_order_mode: QuestionOrderMode;
}

export interface ImportRow_Question {
  game_key: string;
  round_key: string;
  question_key: string;
  question_number: number;
  game_type: GameType;
  prompt: string;
  lyric_excerpt?: string;
  song_title?: string;
  artist?: string;
  image_path?: string;
  category?: string;
  subcategory?: string;
  difficulty?: string;
  duration_seconds: number;
  correct_choice_key: string;
  is_tiebreaker: boolean;
  active: boolean;
}

export interface ImportRow_Choice {
  question_key: string;
  choice_key: string;
  choice_order: number;
  choice_text: string;
}

export interface ImportValidationError {
  sheet: string;
  row?: number;
  column?: string;
  errorCode: string;
  message: string;
  isWarning: boolean;
}

export interface ImportParseResult {
  manifest: ImportManifest | null;
  games: ImportRow_Game[];
  rounds: ImportRow_Round[];
  questions: ImportRow_Question[];
  choices: ImportRow_Choice[];
  imageFilenames: string[];
  errors: ImportValidationError[];
}

export interface ImportPreview {
  packageName: string;
  gameCount: number;
  roundCount: number;
  questionCount: number;
  tiebreakerCount: number;
  imageCount: number;
  gameTypes: GameType[];
  categories: string[];
  difficulties: string[];
  games: ImportPreviewGame[];
  errors: ImportValidationError[];
}

export interface ImportPreviewGame {
  gameKey: string;
  title: string;
  description?: string;
  roundCount: number;
  questionCount: number;
  rounds: ImportPreviewRound[];
}

export interface ImportPreviewRound {
  roundKey: string;
  roundNumber: number;
  title: string;
  gameType: GameType;
  questionCount: number;
  questions: ImportPreviewQuestion[];
}

export interface ImportPreviewQuestion {
  questionKey: string;
  questionNumber: number;
  gameType: GameType;
  prompt: string;
  imagePath?: string;
  isTiebreaker: boolean;
}
