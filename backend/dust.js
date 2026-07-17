import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const DUST_API_KEY = process.env.DUST_API_KEY
const DUST_WORKSPACE_ID = process.env.DUST_WORKSPACE_ID
const DUST_AGENT_ID = process.env.DUST_AGENT_ID
const DUST_BASE_URL = `https://dust.tt/api/v1/w/${DUST_WORKSPACE_ID}`

if (!DUST_API_KEY) console.warn('WARNING: DUST_API_KEY is not set')
if (!DUST_WORKSPACE_ID) console.warn('WARNING: DUST_WORKSPACE_ID is not set')
if (!DUST_AGENT_ID) console.warn('WARNING: DUST_AGENT_ID is not set')

async function dustFetch(pathSuffix, options = {}) {
  const res = await fetch(`${DUST_BASE_URL}${pathSuffix}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${DUST_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error?.message || data.message || 'Dust API error')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

function messagePayload(content) {
  return {
    content,
    mentions: [{ configurationId: DUST_AGENT_ID }],
    context: {
      timezone: 'America/Phoenix',
      username: 'htv-app',
      fullName: 'HTV Internal Tool',
      email: null,
      profilePictureUrl: null,
      origin: 'api',
    },
  }
}

// Dust generates the agent's reply asynchronously — poll the conversation until that
// message reaches a terminal status, rather than trying to stream token-by-token for now.
async function pollForAgentReply(conversationSId, agentMessageSId, { intervalMs = 1000, timeoutMs = 45000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const data = await dustFetch(`/assistant/conversations/${conversationSId}`)
    const agentMsg = data.conversation.content.flat().find(m => m.sId === agentMessageSId)
    if (!agentMsg) throw new Error('Agent message not found in conversation')
    if (agentMsg.status === 'succeeded') return agentMsg.content
    if (agentMsg.status === 'failed') throw new Error(agentMsg.error?.message || 'Dust agent failed to respond')
    if (agentMsg.status === 'cancelled') throw new Error('Dust agent generation was cancelled')
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error('Timed out waiting for the Dust agent to respond')
}

// Starts a new conversation (first message) or continues an existing one (conversationId set).
// Returns the agent's reply text plus the conversation's sId, so the frontend can thread
// follow-up messages into the same conversation rather than losing context each turn.
export async function askAgent(content, conversationId) {
  let conversationSId = conversationId
  let agentMessageSId

  if (!conversationSId) {
    const data = await dustFetch('/assistant/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: null, visibility: 'unlisted', message: messagePayload(content) }),
    })
    conversationSId = data.conversation.sId
    const agentMsg = data.conversation.content.flat().find(m => m.type === 'agent_message')
    agentMessageSId = agentMsg.sId
  } else {
    // Unlike conversation-creation, this response shape splits the two messages: `message` is
    // the user message just created, `agentMessages[0]` is the one we actually need to poll.
    const data = await dustFetch(`/assistant/conversations/${conversationSId}/messages`, {
      method: 'POST',
      body: JSON.stringify(messagePayload(content)),
    })
    agentMessageSId = data.agentMessages[0].sId
  }

  const response = await pollForAgentReply(conversationSId, agentMessageSId)
  return { response, conversationId: conversationSId }
}
