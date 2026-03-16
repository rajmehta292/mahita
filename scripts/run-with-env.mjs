import { loadEnvFile } from './lib/env-loader.mjs'
import { runCommand } from './lib/command-runner.mjs'

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
  console.error('Usage: node scripts/run-with-env.mjs <command> [...args]')
  process.exit(1)
}

const envFromFile = await loadEnvFile('.env.local')
const result = runCommand(command, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ...envFromFile,
    ...inlineEnv,
  },
  stdio: 'pipe',
})

if (result.stdout) {
  process.stdout.write(result.stdout)
}

if (result.stderr) {
  process.stderr.write(result.stderr)
}

process.exit(result.exitCode)
