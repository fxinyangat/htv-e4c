import { Router } from 'express'
import { handleNotionWebhook } from '../controllers/webhooksController.js'

const router = Router()

router.post('/notion', handleNotionWebhook)

export default router
