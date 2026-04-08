import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { logger } from './logging'

const execFileAsync = promisify(execFile)

export interface CommandResult {
  ok: boolean
  stdout: string
  stderr: string
}

export async function runCommand(
  file: string,
  args: string[],
  timeoutMs = 10_000
): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    })
    return {
      ok: true,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    }
  } catch (error) {
    logger.error('Command execution failed', { file, args, error })
    return {
      ok: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown command error'
    }
  }
}
