import { config } from '../../src/config'
import { logger } from './logging'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export async function checkInternetConnection(): Promise<boolean> {
  try {
    await fetch(config.connectivity.probeUrl, { method: 'HEAD' })
    return true
  } catch {
    return false
  }
}

export async function waitForInternet(): Promise<boolean> {
  for (let attempt = 1; attempt <= config.connectivity.maxAttempts; attempt += 1) {
    logger.info(`Checking internet connection attempt ${attempt}`)
    if (await checkInternetConnection()) {
      return true
    }
    await sleep(config.connectivity.retryDelayMs)
  }
  logger.warn('Internet not connected after multiple attempts')
  return false
}
