import log from 'electron-log/main.js'

log.initialize()
log.transports.file.level = 'info'
log.transports.console.level = 'info'

export const logger = {
  info: (message: string, meta?: unknown) => log.info(message, meta),
  warn: (message: string, meta?: unknown) => log.warn(message, meta),
  error: (message: string, meta?: unknown) => log.error(message, meta)
}
