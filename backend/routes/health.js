import { Router } from 'express'
import { sendData } from '../lib/response.js'

const router = Router()

router.get('/', (req, res) => sendData(res, { ok: true }))

export default router
