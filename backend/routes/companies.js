import { Router } from 'express'
import {
  getAllCompanies, listCompanies, queueCompanies, createCompany,
  getCompanyById, updateCompany, deleteCompany,
} from '../controllers/companiesController.js'

const router = Router()

// /list and /queue must stay registered before /:id — otherwise Express would match them
// as the :id param instead of their own literal routes.
router.get('/', getAllCompanies)
router.get('/list', listCompanies)
router.get('/queue', queueCompanies)
router.post('/', createCompany)
router.get('/:id', getCompanyById)
router.patch('/:id', updateCompany)
router.delete('/:id', deleteCompany)

export default router
