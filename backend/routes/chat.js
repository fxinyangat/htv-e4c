import { Router } from 'express'
import { postChat, getChatStatus } from '../controllers/chatController.js'

const router = Router()

router.post('/', postChat)
router.get('/:jobId/status', getChatStatus)

export default router
