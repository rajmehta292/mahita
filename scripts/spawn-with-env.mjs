import { spawn } from 'node:child_process'
import { loadEnvFile } from './lib/env-loader.mjs'

const rawArgs = process.argv.slice(2)
const inlineEnv = {}
let commandIndex = 0

while (commandIndex < rawArgs.length) {
  const token = rawArgs[commandIndex]
  const equalsIndex = token.indexOf('=')
  if (equalsIndex <= 0) {
    break
  }

  const key = token.slice(0, equalsIndex)
  const value = token.slice(equalsIndex + 1)
  inlineEnv[key] = value
  commandIndex += 1
}

const command = rawArgs[commandIndex]
const args = rawArgs.slice(commandIndex + 1)

if (!command) {
  console.error('Usage: node scripts/spawn-with-env.mjs <command> [...args]')
  process.exit(1)
}

const envFromFile = await loadEnvFile('.env.local')
const child = spawn(command, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ...envFromFile,
    ...inlineEnv,
  },
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
