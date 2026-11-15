import { useState } from 'react'

type CopyState = 'idle' | 'copied' | 'failed'

/** DESIGN.md › Key code: monospace on `surface-inset`, with an icon button that copies it. */
export function KeyCode({ code }: { code: string }) {
  const [state, setState] = useState<CopyState>('idle')

  async function copy() {
    try {
      // Missing outside a secure context, and the browser may refuse permission: both land in catch.
      await navigator.clipboard.writeText(code)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded-sm bg-surface-inset px-3 py-2 font-mono text-sm tracking-wide break-all text-fg select-all">
        {code}
      </code>
      <button
        type="button"
        aria-label={`Copy key ${code}`}
        onClick={() => void copy()}
        className="flex size-8 items-center justify-center rounded-sm text-fg hover:bg-surface-raised"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
          <rect x="9" y="9" width="11" height="11" rx="1" />
          <path d="M5 15V5a1 1 0 0 1 1-1h10" strokeLinecap="round" />
        </svg>
      </button>
      <span aria-live="polite" className="text-xs">
        {state === 'copied' && <span className="text-teal">Copied</span>}
        {state === 'failed' && <span className="text-danger">Couldn’t copy. Select the code instead.</span>}
      </span>
    </div>
  )
}
