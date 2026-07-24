import { Router } from 'express'
import { googleLogin, googleCallback, logout, me } from '../controllers/authController.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { requireOrigin } from '../middleware/requireOrigin.js'

const router = Router()

router.get('/google', googleLogin)
router.get('/google/callback', googleCallback)
router.post('/logout', requireOrigin, logout)
router.get('/me', requireAuth, me)

export default router
