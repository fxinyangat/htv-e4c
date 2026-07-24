import { randomUUID } from 'crypto'
import { askAgent } from '../dust.js'
import { redis } from '../lib/redis.js'
import { runInBackground } from '../lib/background.js'
import { sendData, sendError } from '../lib/response.js'

// Ask AI chat widget — proxies to the Dust agent already configured for this workspace.
// conversationId threads follow-up messages into the same Dust conversation (so the agent has
// real memory of the exchange) instead of resending the whole history on every turn.
//
// Job state lives in Redis instead of a held-open HTTP response: Dust's multi-step tool calls
// can take a few minutes, and holding one connection open that long is both fragile (a dropped
// connection loses the in-progress result client-side even though the server is still working)
// and risks exceeding Vercel's function duration cap. POST starts the job and returns
// immediately; the frontend polls the status endpoint for progress/result.
const jobKey = jobId => `chat:job:${jobId}`
const JOB_TTL_S = 60 * 60 // 1 hour — finished/abandoned jobs shouldn't linger in Redis forever

async function writeJob(jobId, job) {
  await redis.set(jobKey(jobId), job, { ex: JOB_TTL_S })
}

export async function postChat(req, res) {
  const { message, conversationId } = req.body
  if (!message || !message.trim()) {
    return res.status(400).json({ status: 'error', message: 'Message is required', data: null })
  }

  const jobId = randomUUID()
  try {
    await writeJob(jobId, { status: 'progress', message: 'Thinking…', data: null })
  } catch (err) {
    return sendError(res, err, 'Failed to start the chat job')
  }

  runInBackground((async () => {
    try {
      const onStatus = status => writeJob(jobId, { status: 'progress', message: status, data: null })
      const { response, conversationId: newConversationId } = await askAgent(message.trim(), conversationId || undefined, onStatus)
      await writeJob(jobId, { status: 'success', message: 'Response ready', data: { response, conversationId: newConversationId } })
    } catch (err) {
      console.error(err)
      await writeJob(jobId, { status: 'error', message: err.message, data: null })
    }
  })())

  sendData(res, { jobId }, 'Chat job started', 202)
}

export async function getChatStatus(req, res) {
  try {
    const job = await redis.get(jobKey(req.params.jobId))
    if (!job) {
      return res.status(404).json({ status: 'error', message: 'Chat job not found or expired', data: null })
    }
    res.status(200).json(job)
  } catch (err) {
    sendError(res, err)
  }
}
