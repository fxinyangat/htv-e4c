// Every REST response (success or error) is shaped the same way, so the frontend never has
// to special-case a given endpoint's payload structure.
export function sendData(res, data, message = 'OK', statusCode = 200) {
  res.status(statusCode).json({ status: 'success', message, data })
}

export function sendError(res, err, fallbackMessage = 'Something went wrong') {
  console.error(err)
  res.status(err.status || 500).json({ status: 'error', message: err.message || fallbackMessage, data: null })
}
