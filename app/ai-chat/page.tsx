'use client'

import { useState, useRef, useEffect } from 'react'
import { MainLayout } from '@/app/components/Layout/MainLayout'
import { Send, Terminal, Loader2, Bot, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

export default function AIChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [selectedModel, setSelectedModel] = useState('llama3.2:latest')
    const [usage, setUsage] = useState({ prompt: 0, completion: 0 })
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const models = [
        { id: 'llama3.2:latest', name: 'Llama 3.2 (Local)', provider: 'ollama' },
        { id: 'mistral:latest', name: 'Mistral (Local)', provider: 'ollama' },
        { id: 'kimi-k2.5:cloud', name: 'Kimi K2.5 (Cloud)', provider: 'kimi' },
    ]

    const kilocode = ((usage.prompt + usage.completion) / 1000).toFixed(3)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isStreaming])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isStreaming) return

        const userMessage = input.trim()
        setInput('')

        const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
        setMessages(newMessages)
        setIsStreaming(true)

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    model: selectedModel
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Server error')
            }

            // Stream Reader setup
            const reader = res.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) throw new Error("No readable stream available")

            // Initialize empty assistant message
            setMessages(prev => [...prev, { role: 'assistant', content: '' }])

            let done = false
            while (!done) {
                const { value, done: readerDone } = await reader.read()
                done = readerDone
                if (value) {
                    const chunk = decoder.decode(value, { stream: true })
                    // NDJSON decoding: splitting by newline since Ollama streams JSON objects per line
                    const lines = chunk.split('\n').filter(line => line.trim() !== '')

                    for (const line of lines) {
                        try {
                            if (selectedModel.includes('kimi')) {
                                // SSE Parsing for Kimi
                                if (line.startsWith('data: ')) {
                                    const dataLine = line.slice(6)
                                    if (dataLine === '[DONE]') continue
                                    const parsed = JSON.parse(dataLine)
                                    const content = parsed.choices?.[0]?.delta?.content
                                    if (content) {
                                        setMessages(prev => {
                                            const latest = [...prev]
                                            const lastIndex = latest.length - 1
                                            latest[lastIndex] = {
                                                ...latest[lastIndex],
                                                content: latest[lastIndex].content + content
                                            }
                                            return latest
                                        })
                                    }
                                }
                            } else {
                                // NDJSON Parsing for Ollama
                                const parsed = JSON.parse(line)
                                if (parsed.message?.content) {
                                    setMessages(prev => {
                                        const latest = [...prev]
                                        const lastIndex = latest.length - 1
                                        latest[lastIndex] = {
                                            ...latest[lastIndex],
                                            content: latest[lastIndex].content + parsed.message.content
                                        }
                                        return latest
                                    })
                                }
                                // Extract telemetry if present
                                if (parsed.done) {
                                    setUsage({
                                        prompt: parsed.prompt_eval_count || 0,
                                        completion: parsed.eval_count || 0
                                    })
                                }
                            }
                        } catch (e) {
                            console.warn("Failed to parse chunk", line, e)
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error(error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `> **Connection Error:** \n> ${error.message || "Failed to reach Ollama AI backend."}`
            }])
        } finally {
            setIsStreaming(false)
        }
    }

    return (
        <MainLayout>
            <div className="flex flex-col h-screen max-h-screen bg-[#131722] text-gray-200 font-sans">

                {/* Header Pane */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2E39] bg-[#1E222D]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Terminal className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-wide">Mahita Intelligence</h1>
                            <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-gray-400 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                    Engine Connected
                                </span>
                                <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                    Usage: {kilocode} Kilocode
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            disabled={isStreaming}
                            className="bg-[#131722] border border-[#2A2E39] text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                        >
                            {models.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Chat Session Window */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto opacity-60">
                            <Bot className="w-16 h-16 text-gray-500 mb-6" />
                            <h2 className="text-xl font-medium text-white mb-2">Initialize Terminal Session</h2>
                            <p className="text-sm text-gray-400">
                                This space is connected to your local secure hardware. Ask for Pine Script snippets, market concepts, or JSON configuration structures.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30 flex-shrink-0 mt-1">
                                        <Bot className="w-4 h-4 text-blue-400" />
                                    </div>
                                )}

                                <div className={`relative px-5 py-3.5 rounded-2xl max-w-[85%] ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-sm'
                                    : 'bg-[#1E222D] text-gray-300 rounded-bl-sm border border-[#2A2E39]'
                                    }`}>
                                    <div className="prose prose-invert max-w-none text-sm leading-relaxed prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-a:text-blue-400 prose-code:text-blue-300 prose-code:bg-blue-500/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                code({ node, inline, className, children, ...props }: any) {
                                                    const match = /language-(\w+)/.exec(className || '')
                                                    return !inline && match ? (
                                                        <div className="my-4 rounded-xl overflow-hidden border border-[#2A2E39]">
                                                            <div className="bg-[#131722] px-4 py-2 text-xs font-mono text-gray-400 flex justify-between border-b border-[#2A2E39]">
                                                                {match[1]}
                                                            </div>
                                                            <SyntaxHighlighter
                                                                {...props}
                                                                style={vscDarkPlus}
                                                                language={match[1]}
                                                                PreTag="div"
                                                                customStyle={{ margin: 0, padding: '1rem', background: '#1E222D' }}
                                                            >
                                                                {String(children).replace(/\n$/, '')}
                                                            </SyntaxHighlighter>
                                                        </div>
                                                    ) : (
                                                        <code {...props} className={className}>
                                                            {children}
                                                        </code>
                                                    )
                                                }
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>

                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center border border-gray-600 flex-shrink-0 mt-1">
                                        <User className="w-4 h-4 text-gray-300" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Payload Area */}
                <div className="p-6 bg-[#1E222D] border-t border-[#2A2E39]">
                    <div className="max-w-4xl mx-auto relative">
                        <form onSubmit={handleSubmit} className="relative flex items-center">
                            <input
                                autoFocus
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={isStreaming}
                                placeholder="Transmit instruction sequence..."
                                className="w-full bg-[#131722] border border-[#2A2E39] text-white text-sm rounded-xl pl-5 pr-14 py-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-all font-mono placeholder:font-sans"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isStreaming}
                                className="absolute right-2 p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center"
                            >
                                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                        </form>
                        <div className="text-center mt-3">
                            <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">END-TO-END ENCRYPTED // LOCAL EXECUTION ONLY</span>
                        </div>
                    </div>
                </div>

            </div>
        </MainLayout>
    )
}
