import { mkdir, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict')

async function main() {
  if (process.platform !== 'darwin') {
    return
  }

  await Promise.all([
    ensureMacSwiftHelper('wifi-active'),
    ensureMacSwiftHelper('wifi-known')
  ])
}

async function ensureMacSwiftHelper(name) {
  const source = resolve(root, `native/macos/${name}/main.swift`)
  const output = resolve(root, `native/macos/${name}/dist/${name}`)
  const moduleCache = resolve(root, `native/macos/${name}/.build/module-cache`)

  if (!(await isStale(source, output))) {
    return
  }

  await mkdir(dirname(output), { recursive: true })
  await mkdir(moduleCache, { recursive: true })
  await run(
    'swiftc',
    [
      '-module-cache-path',
      moduleCache,
      '-framework',
      'CoreWLAN',
      source,
      '-o',
      output
    ],
    {
      CLANG_MODULE_CACHE_PATH: moduleCache,
      SWIFT_MODULE_CACHE_PATH: moduleCache
    }
  )
}

async function isStale(source, output) {
  try {
    const [sourceStats, outputStats] = await Promise.all([
      stat(source),
      stat(output)
    ])
    return outputStats.mtimeMs < sourceStats.mtimeMs
  } catch {
    return true
  }
}

async function run(command, args, env = {}) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: 'inherit'
    })

    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(
        new Error(`${command} ${args.join(' ')} exited with code ${code}`)
      )
    })
  })
}

main().catch((error) => {
  if (strict) {
    console.error(error)
    process.exitCode = 1
    return
  }

  console.warn(`Native helper build skipped: ${error.message}`)
})
