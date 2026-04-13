import log from 'electron-log/main.js'

log.initialize()
log.transports.file.level = 'info'
log.transports.console.level = 'info'

function writeLog(
  writer: (message: string, ...data: unknown[]) => void,
  message: string,
  meta?: unknown
): void {
  if (meta === undefined) {
    writer(message)
    return
  }
  writer(message, meta)
}

export const logger = {
  info: (message: string, meta?: unknown) => writeLog(log.info, message, meta),
  warn: (message: string, meta?: unknown) => writeLog(log.warn, message, meta),
  error: (message: string, meta?: unknown) => writeLog(log.error, message, meta)
}
