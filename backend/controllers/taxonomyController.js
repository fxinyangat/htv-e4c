import { sendData, sendError } from '../lib/response.js'
import { getTaxonomy } from '../services/taxonomyStore.js'

export async function getTaxonomyOptions(req, res) {
  try {
    const taxonomy = await getTaxonomy(req.query.refresh === '1')
    sendData(res, taxonomy)
  } catch (err) {
    sendError(res, err)
  }
}
