import { onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as admin from 'firebase-admin'
import { createRoomFn }        from './rooms/createRoom'
import { joinRoomFn }          from './rooms/joinRoom'
import { startGameFn }         from './gameplay/startGame'
import { startQuestionFn }     from './gameplay/startQuestion'
import { pauseQuestionFn, resumeQuestionFn } from './gameplay/pauseQuestion'
import { closeQuestionFn }     from './gameplay/closeQuestion'
import { submitAnswerFn }      from './gameplay/submitAnswer'
import { revealAnswerFn }      from './gameplay/revealAnswer'
import { skipQuestionFn }      from './gameplay/skipQuestion'
import { showLeaderboardFn }   from './gameplay/showLeaderboard'
import { prepareNextQuestionFn } from './gameplay/prepareNextQuestion'
import { adjustScoreFn }       from './gameplay/adjustScore'
import { removePlayerFn }      from './gameplay/removePlayer'
import { endGameFn }           from './gameplay/endGame'
import { importGamePackageFn } from './admin/importGamePackage'
import { saveGameFn }           from './admin/saveGame'
import { publishGameFn, unpublishGameFn, deleteGameFn, updateAppConfigFn } from './admin/publishGame'
import { refreshRoomImagesFn } from './admin/refreshRoomImages'
import { cleanupExpiredRoomsFn } from './scheduled/cleanupExpiredRooms'

admin.initializeApp()

const callable = { cors: true, invoker: 'public' } as const

export const createRoom          = onCall(callable, createRoomFn)
export const joinRoom            = onCall(callable, joinRoomFn)
export const startGame           = onCall(callable, startGameFn)
export const startQuestion       = onCall(callable, startQuestionFn)
export const pauseQuestion       = onCall(callable, pauseQuestionFn)
export const resumeQuestion      = onCall(callable, resumeQuestionFn)
export const closeQuestion       = onCall(callable, closeQuestionFn)
export const submitAnswer        = onCall(callable, submitAnswerFn)
export const revealAnswer        = onCall(callable, revealAnswerFn)
export const skipQuestion        = onCall(callable, skipQuestionFn)
export const showLeaderboard     = onCall(callable, showLeaderboardFn)
export const prepareNextQuestion = onCall(callable, prepareNextQuestionFn)
export const adjustScore         = onCall(callable, adjustScoreFn)
export const removePlayer        = onCall(callable, removePlayerFn)
export const endGame             = onCall(callable, endGameFn)
export const importGamePackage   = onCall(callable, importGamePackageFn)
export const saveGame            = onCall(callable, saveGameFn)
export const publishGame         = onCall(callable, publishGameFn)
export const unpublishGame       = onCall(callable, unpublishGameFn)
export const deleteGame          = onCall(callable, deleteGameFn)
export const updateAppConfig     = onCall(callable, updateAppConfigFn)
export const refreshRoomImages   = onCall(callable, refreshRoomImagesFn)
export const cleanupExpiredRooms = onSchedule('every 60 minutes', cleanupExpiredRoomsFn)
