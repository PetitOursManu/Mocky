import fs from 'node:fs'

// kill() only SENDS the signal. Deleting the data directory straight after
// raced the dying server still writing its journal, and under Node 24 rmSync
// failed with ENOTEMPTY now and then. So wait for `exit`, bounded at 5 s so a
// process that ignores the signal cannot hang the suite.
export function stopProcess(proc, timeoutMs = 5000) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs)
    proc.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    proc.kill()
  })
}

export function removeDir(dir) {
  if (dir) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
