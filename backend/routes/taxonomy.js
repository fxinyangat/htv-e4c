import { Router } from 'express'
import { getTaxonomyOptions } from '../controllers/taxonomyController.js'

const router = Router()

router.get('/', getTaxonomyOptions)

export default router
