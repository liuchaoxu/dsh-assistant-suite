// Shared admission and bounded JSON transport for plugin-owned HTTP routes.
export function rejected(ctx, req, res) {
  let status = 503
  try {
    const connection = ctx.get?.('connection')
    if (typeof connection?.requestRejection === 'function') {
      const rejection = connection.requestRejection(req)
      if (rejection === undefined) return false
      status = Number.isInteger(rejection) && rejection >= 400 && rejection <= 599 ? rejection : 403
    }
  } catch {
    // Admission is unavailable: never turn a service failure into permission.
  }
  res.statusCode = status
  res.end()
  return true
}

export async function readBody(req, limit = 256 * 1024) {
  const chunks = []
  let bytes = 0
  // Node's default async iterator destroys IncomingMessage on early return,
  // which would close the socket before a 413 response could be delivered.
  const stream = typeof req.iterator === 'function' ? req.iterator({ destroyOnReturn: false }) : req
  for await (const value of stream) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
    bytes += chunk.length
    if (bytes > limit) {
      req.resume?.()
      const error = new Error('Request body exceeds 256 KiB')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, bytes).toString('utf8')
}
