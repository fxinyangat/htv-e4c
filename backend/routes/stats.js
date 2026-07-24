import { Router } from 'express'
import { inboundStats, pipelineStats } from '../controllers/statsController.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()

router.get('/inbound', inboundStats) // any approved role (requireAuth already applied at mount)
router.get('/pipeline', requireRole('Admin', 'Analyst'), pipelineStats) // Portfolio Metrics is Investor-excluded

export default router
