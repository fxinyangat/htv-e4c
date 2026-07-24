import express from 'express'
import cors from 'cors'
import companiesRouter from './routes/companies.js'
import statsRouter from './routes/stats.js'
import chatRouter from './routes/chat.js'
import taxonomyRouter from './routes/taxonomy.js'
import { warmCompaniesCache } from './services/companiesStore.js'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/companies', companiesRouter)
app.use('/api/stats', statsRouter)
app.use('/api/chat', chatRouter)
app.use('/api/taxonomy', taxonomyRouter)

const PORT = process.env.PORT || 8000
app.listen(PORT, () => console.log(`HTV backend listening on http://localhost:${PORT}`))

// Warm the companies cache immediately, then keep refreshing it before the TTL expires
// so the ~60s Notion fetch never happens on a user-facing request.
warmCompaniesCache()
