import express from 'express'
import cors from 'cors'
import {
  notionFetch, fetchAllPages, NOTION_COMPANIES_DB_ID,
  readTitle, readText, readMultiSelect, readSelect, readUrl,
} from './notion.js'

const app = express()
app.use(cors())
app.use(express.json())

function stripDomain(url) {
  if (!url) return ''
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

let nextTagId = 1

function mapCompany(page) {
  const p = page.properties

  const industry = readMultiSelect(p['Industry (HVC)'])
  const constructionStage = readMultiSelect(p['Construction Stage (HVC)'])
  const productType = readMultiSelect(p['Product Type (HVC)'])
  const technologyType = readMultiSelect(p['Technology Type (HVC)'])
  const region = readMultiSelect(p['Region (HTV)'])
  const originCategory = readMultiSelect(p['Origin Category (HVC)'])
  const diversity = readMultiSelect(p['Diversity Status'])

  const taggedBy = readSelect(p['Tagged By'])
  const tagSource = taggedBy === 'Human' ? 'human' : taggedBy === 'AI Agent' ? 'llm' : 'human'

  const tags = []
  const axes = [
    ['industry', industry],
    ['construction_stage', constructionStage],
    ['product_type', productType],
    ['technology_type', technologyType],
  ]
  for (const [axis, values] of axes) {
    for (const value of values) {
      tags.push({
        id: String(nextTagId++),
        axis, value, source: tagSource,
        confidence: 1, is_accepted: true, reasoning: null,
      })
    }
  }

  return {
    id: page.id,
    external_id: `HV-${page.id.slice(0, 8)}`,
    name: readTitle(p['Name']),
    description: readText(p['Description']),
    priority: 'review',
    updated_at: (page.last_edited_time || '').slice(0, 10),
    domain: stripDomain(readUrl(p['Domain'])),
    location: readText(p['Location']),
    region: region[0] || 'Unknown',
    diversity_status: diversity[0] || null,
    linkedin_url: readUrl(p['LinkedIn URL']),
    origin_source: readUrl(p['Origin Source']) || '',
    origin_category: originCategory[0] || null,
    allie_knockout: readSelect(p['Allie Knockout Pass/Fail']),
    andra_knockout: readSelect(p['Andra Knockout Pass/Fail']),
    tags,
    activity: [],
    notes: [],
    tagging_comment: [],
    tagging_action: null,
  }
}

app.get('/api/companies', async (req, res) => {
  try {
    const pages = await fetchAllPages(NOTION_COMPANIES_DB_ID)
    res.json({ companies: pages.map(mapCompany) })
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

app.get('/api/companies/:id', async (req, res) => {
  try {
    const page = await notionFetch(`/pages/${req.params.id}`)
    res.json(mapCompany(page))
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 8000
app.listen(PORT, () => console.log(`HTV backend listening on http://localhost:${PORT}`))
