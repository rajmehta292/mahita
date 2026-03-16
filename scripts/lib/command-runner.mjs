import { spawnSync } from 'node:child_process'

function resolveExecutable(command) {
  if (process.platform === 'win32' && (command === 'npm' || command === 'npx')) {
    return `${command}.cmd`
  }

  return command
}

export function formatCommand(command, args = []) {
  return [command, ...args].join(' ').trim()
}

export function runCommand(command, args = [], options = {}) {
  const executable = resolveExecutable(command)
  const requiresCmdShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable)
  const result = spawnSync(
    requiresCmdShim ? process.env.ComSpec ?? 'cmd.exe' : executable,
    requiresCmdShim ? ['/d', '/s', '/c', formatCommand(executable, args)] : args,
    {
      cwd: options.cwd ?? process.cwd(),
      encoding: 'utf8',
      stdio: options.stdio ?? 'pipe',
      env: options.env ?? process.env,
      shell: options.shell ?? false,
    }
  )

  const stdout = result.stdout ?? ''
  const stderr = [result.stderr ?? '', result.error?.message ?? ''].filter(Boolean).join('\n')

  return {
    command: formatCommand(command, args),
    exitCode: result.status ?? 1,
    passed: result.status === 0,
    stdout,
    stderr,
  }
}

export function runChecked(command, args = [], options = {}) {
  const result = runCommand(command, args, options)

  if (!result.passed) {
    const output = (result.stderr || result.stdout || 'Command failed without output.').trim()
    throw new Error(`${result.command} failed.\n${output}`)
  }

  return result
}
