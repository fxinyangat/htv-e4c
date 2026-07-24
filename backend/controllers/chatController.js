import { askAgent } from '../dust.js'

// Ask AI chat widget — proxies to the Dust agent already configured for this workspace.
// conversationId threads follow-up messages into the same Dust conversation (so the agent
// has real memory of the exchange) instead of resending the whole history on every turn.
// Streams newline-delimited JSON: zero or more {status:'progress', message} lines while the
// agent works (tool calls can take 30s+), then one terminal {status:'success', data} or
// {status:'error', message} — the same envelope every other endpoint uses.
// Plain fetch + a stream reader on the frontend, not EventSource — this is a one-shot POST
// response, not a long-lived subscription, so full SSE framing/reconnect semantics aren't needed.
export async function postChat(req, res) {
  const { message, conversationId } = req.body
  if (!message || !message.trim()) {
    return res.status(400).json({ status: 'error', message: 'Message is required', data: null })
  }
  // Agent replies (multi-step tool calls) can take several minutes — Node's default socket
  // timeout would otherwise kill the connection before dust.js's own 5-min poll timeout hits.
  req.setTimeout(6 * 60 * 1000)
  res.setTimeout(6 * 60 * 1000)
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Cache-Control', 'no-cache')
  res.flushHeaders?.()

  try {
    const onStatus = status => res.write(JSON.stringify({ status: 'progress', message: status, data: null }) + '\n')
    const { response, conversationId: newConversationId } = await askAgent(message.trim(), conversationId || undefined, onStatus)
    res.write(JSON.stringify({ status: 'success', message: 'Response ready', data: { response, conversationId: newConversationId } }) + '\n')
  } catch (err) {
    console.error(err)
    res.write(JSON.stringify({ status: 'error', message: err.message, data: null }) + '\n')
  } finally {
    res.end()
  }
}
