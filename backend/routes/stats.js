import { Router } from 'express'
import { inboundStats, pipelineStats } from '../controllers/statsController.js'

const router = Router()

router.get('/inbound', inboundStats)
router.get('/pipeline', pipelineStats)

export default router
