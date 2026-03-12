'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { loader, type Monaco } from '@monaco-editor/react'
import { AlertTriangle, Code2 } from 'lucide-react'
import { normalizeUnknownError } from '@/lib/app-errors'

interface MahitaCodeEditorProps {
  value: string
  onChange: (value: string) => void
}

let loaderConfigured = false

function configureMonacoLoader() {
  if (loaderConfigured) {
    return
  }

  loader.config({
    paths: {
      vs: '/monaco/vs',
    },
  })
  loaderConfigured = true
}

function registerPineLanguage(monaco: Monaco) {
  if (monaco.languages.getLanguages().some((language: { id: string }) => language.id === 'pine')) {
    return
  }

  monaco.languages.register({ id: 'pine' })
  monaco.languages.setMonarchTokensProvider('pine', {
    tokenizer: {
      root: [
        [/\b(strategy|indicator|plot|input|if|else|var|for|while|switch|import)\b/, 'keyword'],
        [/\b(ta|math|str|strategy|request|color|plot|barstate|timeframe|input)\b/, 'type.identifier'],
        [/[a-zA-Z_]\w*/, 'identifier'],
        [/\d+(\.\d+)?/, 'number.float'],
        [/\/\/.*$/, 'comment'],
        [/".*?"/, 'string'],
      ],
    },
  })
}

export function MahitaCodeEditor({ value, onChange }: MahitaCodeEditorProps) {
    const [fallbackMode, setFallbackMode] = useState(false)
    const [monacoReady, setMonacoReady] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const mountedRef = useRef(false)

  useEffect(() => {
    configureMonacoLoader()

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!mountedRef.current && !cancelled) {
        const normalized = normalizeUnknownError(
          new Error('Monaco editor timed out during initialization.'),
          'Mahita could not initialize Monaco.',
          {
            code: 'MONACO_INIT_FAILED',
            hint: 'Mahita switched to the built-in fallback editor so you can keep editing and running prototype backtests.',
          }
        )
        mountedRef.current = true
        setErrorMessage(normalized.message)
        setFallbackMode(true)
      }
    }, 3000)

    loader
      .init()
      .then((monaco) => {
        if (cancelled || mountedRef.current) {
          return
        }
        registerPineLanguage(monaco)
        setMonacoReady(true)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        const normalized = normalizeUnknownError(error, 'Mahita could not initialize Monaco.', {
          code: 'MONACO_INIT_FAILED',
          hint: 'Mahita switched to the built-in fallback editor so you can keep editing and running prototype backtests.',
        })
        mountedRef.current = true
        setErrorMessage(normalized.message)
        setFallbackMode(true)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [])

  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on' as const,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      padding: { top: 15 },
      wordWrap: 'on' as const,
    }),
    []
  )

  if (fallbackMode) {
    return (
      <div className="h-full flex flex-col bg-[#0d0e12]">
        <div className="flex items-center gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-300" />
          <span>{errorMessage || 'Monaco is unavailable. Mahita switched to the fallback editor.'}</span>
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-full w-full resize-none bg-[#0d0e12] px-4 py-4 font-mono text-sm text-white outline-none"
          spellCheck={false}
        />
      </div>
    )
  }

  return (
    <div className="h-full bg-[#0d0e12]">
      {monacoReady ? (
        <Editor
          height="100%"
          defaultLanguage="pine"
          theme="vs-dark"
          value={value}
          beforeMount={registerPineLanguage}
          loading={
            <div className="h-full flex items-center justify-center text-white/55">
              <div className="flex flex-col items-center gap-3">
                <Code2 className="h-5 w-5 animate-pulse" />
                <span className="text-sm">Loading editor…</span>
              </div>
            </div>
          }
          onMount={() => {
            mountedRef.current = true
          }}
          onChange={(nextValue) => onChange(nextValue || '')}
          options={editorOptions}
        />
      ) : (
        <div className="h-full flex items-center justify-center text-white/55">
          <div className="flex flex-col items-center gap-3">
            <Code2 className="h-5 w-5 animate-pulse" />
            <span className="text-sm">Loading editor…</span>
          </div>
        </div>
      )}
    </div>
  )
}
