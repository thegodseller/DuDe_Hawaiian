import React, { useEffect, useMemo, useState } from 'react'

function LogoCat({ size = 56 }) {
  const stroke = '#1f2937'
  const fill = '#ffffff'
  return (
    <svg
      width={size}
      height={(size / 120) * 140}
      viewBox="0 0 120 140"
      role="img"
      aria-label="lil cat"
    >
      <rect x="0" y="0" width="120" height="140" rx="18" fill="#fdf2f8" stroke="#f9a8d4" strokeWidth="2" />
      <path
        d="M32 46 C32 22 46 16 60 28 C74 16 88 22 88 46 V96 C88 112 76 124 60 124 C44 124 32 112 32 96 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M45 45 C47 39 52 36 60 42"
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M75 45 C73 39 68 36 60 42"
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="47" cy="57" r="4" fill={stroke} />
      <circle cx="73" cy="57" r="4" fill={stroke} />
      <path
        d="M53 74 Q60 80 67 74"
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M40 90 Q46 84 50 94 Q52 102 50 114"
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M80 90 Q74 84 70 94 Q68 102 70 114"
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M50 88 L50 66"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M70 88 L70 66"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M36 96 C30 96 28 102 36 106"
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M84 96 C90 96 92 102 84 106"
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

const featureDefaults = {
  task_orchestration_enabled: true,
  tool_registry_validation: true,
  structured_logging_enabled: true,
  eval_trace_enabled: true
}

const featureItems = [
  {
    key: 'task_orchestration_enabled',
    label: 'Declarative Task Orchestration',
    description: 'ควบคุม Intent → Tool registry ให้ทำงานแบบ declarative'
  },
  {
    key: 'tool_registry_validation',
    label: 'Tool Registry & Schema Validation',
    description: 'เปิดใช้งาน schema validation ลดโค้ด if/else ในฝั่งหน้าบ้าน'
  },
  {
    key: 'structured_logging_enabled',
    label: 'Structured Logging & Audit Trail',
    description: 'เก็บ log แบบ JSON พร้อม Correlation-ID และข้อมูลสำคัญ'
  },
  {
    key: 'eval_trace_enabled',
    label: 'Eval / Trace Capture',
    description: 'บันทึก prompt, response และ latency เพื่อใช้วิเคราะห์'
  }
]

const tabs = [
  { id: 'chat', label: 'สนทนา', hint: 'พูดคุยทั่วไป / RAG', icon: '💬' },
  { id: 'doc', label: 'ค้นเอกสาร', hint: 'ค้นจากฐานความรู้', icon: '📄' },
  { id: 'ingest', label: 'เพิ่มความรู้', hint: 'อัปโหลดไฟล์ (PDF / DOCX / รูปภาพ)', icon: '➕' },
  { id: 'settings', label: 'ตั้งค่า', hint: 'ปรับโมเดลและระบบ', icon: '⚙️' }
]

const defaultModelConfig = {
  multi_model: {
    primary_thai: 'scb10x/llama3.2-typhoon2-3b-instruct:latest',
    secondary_thai: 'qwen2.5:7b-instruct',
    coding_specialist: 'codellama:7b-python',
    embedding: 'nomic-embed-text:latest'
  },
  routing: {
    thai_conversation: 'scb10x/llama3.2-typhoon2-3b-instruct:latest',
    coding_tasks: 'codellama:7b-python',
    mixed_tasks: 'qwen2.5:7b-instruct',
    default_model: 'scb10x/llama3.2-typhoon2-3b-instruct:latest',
    code_keywords: ['def ', 'class ', 'import ', 'console.log', 'function ', '{', '};', '</', '```'],
    thai_threshold: 0.35
  },
  memory: {
    max_loaded_models: 2,
    flash_attention: true,
    memory_limit: '10G'
  },
  context: {
    thai_code_context: 'คุณเป็น AI ที่เก่งทั้งภาษาไทยและการเขียนโปรแกรม\nตอบเป็นภาษาไทยแต่โค้ดใช้ภาษาอังกฤษ\nอธิบายโค้ดอย่างกระชับเข้าใจง่าย',
    max_history_messages: 6
  }
}

const allowedUpload = '.pdf,.docx,.png,.jpg,.jpeg,.bmp,.webp'
const allowedExts = ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'bmp', 'webp']

function slugifyCollection(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'doc_dude_knowledge'
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('chat')
  const [input, setInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [streamSources, setStreamSources] = useState([])
  const [lastCorrelation, setLastCorrelation] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [uploadInfo, setUploadInfo] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [healthState, setHealthState] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [collection, setCollection] = useState('')
  const [categoryLabel, setCategoryLabel] = useState('')
  const [featureConfig, setFeatureConfig] = useState(featureDefaults)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState('')
  const [configSavingKey, setConfigSavingKey] = useState('')
  const [modelConfig, setModelConfig] = useState(defaultModelConfig)
  const [modelConfigDraft, setModelConfigDraft] = useState(defaultModelConfig)
  const [modelConfigLoading, setModelConfigLoading] = useState(true)
  const [modelConfigError, setModelConfigError] = useState('')
  const [savingSection, setSavingSection] = useState('')
  const [modelConfigMessage, setModelConfigMessage] = useState('')
  const [routingKeywordText, setRoutingKeywordText] = useState(defaultModelConfig.routing.code_keywords.join('\n'))
  const [lastRouting, setLastRouting] = useState(null)

  const placeholder = useMemo(() => {
    if (activeTab === 'doc') return 'ป้อนคำค้น เช่น รายงานยอดขายไตรมาส'
    if (activeTab === 'ingest') return 'คำอธิบายเพิ่มเติม (ไม่บังคับ)'
    return 'เริ่มสนทนา หรือถามข้อมูลที่อยากรู้'
  }, [activeTab])

  useEffect(() => {
    let cancelled = false
    async function fetchConfig() {
      try {
        setConfigLoading(true)
        const res = await fetch('/api/config/features')
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const data = await res.json()
        if (!cancelled) {
          setFeatureConfig({ ...featureDefaults, ...(data.config || {}) })
          setConfigError('')
        }
      } catch (err) {
        if (!cancelled) {
          setConfigError(`โหลดการตั้งค่าไม่สำเร็จ: ${err}`)
        }
      } finally {
        if (!cancelled) {
          setConfigLoading(false)
        }
      }
    }
    fetchConfig()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function fetchModelConfig() {
      try {
        setModelConfigLoading(true)
        const res = await fetch('/api/config/models')
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const data = await res.json()
        if (!cancelled) {
          const snapshot = { ...defaultModelConfig, ...(data.config || {}) }
          setModelConfig(snapshot)
          setModelConfigDraft(snapshot)
          setRoutingKeywordText((snapshot.routing?.code_keywords || []).join('\n'))
          setModelConfigError('')
        }
      } catch (err) {
        if (!cancelled) {
          setModelConfigError(`โหลดการตั้งค่าโมเดลล้มเหลว: ${err}`)
        }
      } finally {
        if (!cancelled) {
          setModelConfigLoading(false)
        }
      }
    }
    fetchModelConfig()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleFeatureToggle(key, nextValue) {
    const previous = featureConfig[key]
    setFeatureConfig((prev) => ({ ...prev, [key]: nextValue }))
    setConfigSavingKey(key)
    try {
      const res = await fetch('/api/config/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: nextValue })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      setFeatureConfig({ ...featureDefaults, ...(data.config || {}) })
      setConfigError('')
    } catch (err) {
      setFeatureConfig((prev) => ({ ...prev, [key]: previous }))
      setConfigError(`บันทึกการตั้งค่าไม่สำเร็จ: ${err}`)
    } finally {
      setConfigSavingKey('')
    }
  }

  function updateModelDraft(section, updates) {
    setModelConfigDraft((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }))
  }

  async function saveModelSection(sectionKey) {
    if (!modelConfigDraft[sectionKey]) return
    setSavingSection(sectionKey)
    setModelConfigMessage('')
    try {
      const payload = { [sectionKey]: modelConfigDraft[sectionKey] }
      const res = await fetch('/api/config/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      setModelConfig({ ...defaultModelConfig, ...(data.config || {}) })
      setModelConfigDraft({ ...defaultModelConfig, ...(data.config || {}) })
      setRoutingKeywordText(((data.config?.routing || {}).code_keywords || []).join('\n'))
      setModelConfigError('')
      setModelConfigMessage('บันทึกการตั้งค่าเรียบร้อย')
    } catch (err) {
      setModelConfigError(`บันทึกการตั้งค่าโมเดลล้มเหลว: ${err}`)
    } finally {
      setSavingSection('')
    }
  }

  async function checkHealth() {
    setHealthLoading(true)
    try {
      const res = await fetch('/api/agents/health')
      const cid = res.headers.get('X-Correlation-ID') || ''
      setLastCorrelation(cid)
      const data = await res.json()
      setHealthState(data)
    } catch (err) {
      setHealthState({ ok: false, error: String(err) })
    } finally {
      setHealthLoading(false)
    }
  }

  async function handleChatSubmit() {
    if (!input.trim() || streaming) return
    const message = input.trim()
    const mode = activeTab === 'doc' ? 'doc' : 'chat'

    setChatHistory((prev) => [...prev, { role: 'user', content: message }])
    setChatHistory((prev) => [...prev, { role: 'assistant', content: '' }])
    setStreaming(true)
    setStreamSources([])
    setInput('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mode, top_k: 4 })
      })
      const cid = res.headers.get('X-Correlation-ID') || ''
      if (cid) setLastCorrelation(cid)
      if (!res.ok || !res.body) {
        throw new Error('บริการสนทนาไม่พร้อม')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistant = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const eventLine = part.split('\n').find((line) => line.startsWith('event:'))
          const dataLine = part.split('\n').find((line) => line.startsWith('data:'))
          if (!dataLine) continue
          const event = eventLine ? eventLine.replace('event:', '').trim() : 'message'
          let payload
          try {
            payload = JSON.parse(dataLine.replace('data:', '').trim())
          } catch (err) {
            continue
          }
          if (event === 'token') {
            assistant = assistant ? `${assistant} ${payload.value}` : payload.value
            setChatHistory((prev) => {
              const next = [...prev]
              next[next.length - 1] = { role: 'assistant', content: assistant }
              return next
            })
          } else if (event === 'routing') {
            setLastRouting(payload)
          } else if (event === 'complete') {
            assistant = payload.answer || assistant
            setChatHistory((prev) => {
              const next = [...prev]
              next[next.length - 1] = {
                role: 'assistant',
                content: assistant,
                meta: {
                  model: payload.model,
                  reason: payload.routing_reason,
                  context: payload.context
                }
              }
              return next
            })
            setStreamSources(payload.sources || [])
            setLastRouting(payload)
          } else if (event === 'error') {
            setChatHistory((prev) => {
              const next = [...prev]
              next[next.length - 1] = {
                role: 'assistant',
                content: `⚠️ เกิดข้อผิดพลาด: ${payload.detail || 'ไม่ทราบสาเหตุ'}`
              }
              return next
            })
          }
        }
      }
    } catch (err) {
      setChatHistory((prev) => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: `⚠️ ระบบไม่ตอบสนอง: ${err}` }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  async function handleSearch() {
    if (!input.trim()) return
    setSearchLoading(true)
    setSearchResults([])
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input.trim(), top_k: 6, collection: collection || undefined })
      })
      const cid = res.headers.get('X-Correlation-ID') || ''
      if (cid) setLastCorrelation(cid)
      const data = await res.json()
      setSearchResults(data.sources || [])
    } catch (err) {
      setSearchResults([{ error: String(err) }])
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!allowedExts.includes(ext)) {
      setUploadInfo({ ok: false, detail: 'ไฟล์นี้ยังไม่รองรับ โปรดใช้ PDF / DOCX / รูปภาพ' })
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    if (collection.trim()) fd.append('collection', collection.trim())

    setUploading(true)
    setUploadInfo(null)
    try {
      const res = await fetch('/api/knowledge/upload', { method: 'POST', body: fd })
      const cid = res.headers.get('X-Correlation-ID') || ''
      if (cid) setLastCorrelation(cid)
      const data = await res.json()
      setUploadInfo(data)
    } catch (err) {
      setUploadInfo({ ok: false, detail: String(err) })
    } finally {
      setUploading(false)
    }
  }

  function renderSources() {
    if (!streamSources?.length) return null
    return (
      <div style={surfaceCardStyle('#f8fafc')}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>แหล่งอ้างอิง</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {streamSources.map((src, idx) => (
            <div key={idx} style={chipStyle('#ffffff')}>
              <div style={{ fontSize: 13, color: '#6b21a8' }}>หน้า {src.metadata?.page ?? '?'} · {src.metadata?.filename || 'ไม่ระบุ'}</div>
              <div style={{ fontSize: 13, color: '#374151' }}>{src.text}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderHealth() {
    if (!healthState) return null
    if (healthState.error) {
      return <div style={chipStyle('#fee2e2')}>⚠️ {healthState.error}</div>
    }
    const agents = healthState.agents || {}
    const summaryColor = healthState.ok ? '#059669' : '#dc2626'
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ color: summaryColor, fontWeight: 600 }}>
          {healthState.ok ? '✅ ทุกบริการพร้อมใช้งาน' : '⚠️ บางบริการไม่พร้อม'}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {Object.entries(agents).map(([name, info]) => (
            <div key={name} style={chipStyle(info.ok ? '#ecfdf5' : '#fee2e2')}>
              <div style={{ fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: 13 }}>
                {info.ok ? 'พร้อมใช้งาน' : 'ไม่พร้อม'} · {info.status ?? 'n/a'}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function describeReason(reason) {
    if (!reason) return ''
    const mapping = {
      thai_mixed_code: 'ข้อความไทยที่มีโค้ดประกอบ',
      coding_detected: 'ตรวจพบโค้ด',
      thai_conversation: 'สนทนาไทย',
      default: 'ค่าเริ่มต้น'
    }
    return mapping[reason] || reason
  }

  function renderChatPanel() {
    return (
      <div style={chatPanelStyle()}>
        <div style={chatHistoryShellStyle()}>
          {chatHistory.length === 0 && (
            <div style={chatEmptyStyle()}>
              <span role="img" aria-label="wave">👋</span>
              <div>เริ่มทัก DuDe ได้เลย ข้างล่างมีช่องพิมพ์ข้อความ</div>
            </div>
          )}
          {chatHistory.map((msg, idx) => (
            <div key={idx} style={{ ...bubbleStyle(msg.role === 'user'), maxWidth: '680px' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{msg.role === 'user' ? 'คุณ' : 'Doc Dude'}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              {msg.meta?.model && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#4f46e5' }}>
                  โมเดล: {msg.meta.model}
                  {msg.meta.reason && ` · ${describeReason(msg.meta.reason)}`}
                  {msg.meta.context && (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#6366f1' }}>
                      บริบท: {msg.meta.context}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {renderSources()}
        <div style={chatComposerStyle()}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            style={chatTextareaStyle()}
            disabled={streaming}
          />
          <button
            type="button"
            onClick={handleChatSubmit}
            disabled={streaming || !input.trim()}
            style={primaryButtonStyle(streaming)}
          >
            {streaming ? 'กำลังตอบ...' : 'ส่งข้อความ'}
          </button>
        </div>
        {(healthState || healthLoading) && (
          <div style={{ marginTop: 20 }}>{renderHealth()}</div>
        )}
      </div>
    )
  }

  function renderDocPanel() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={surfaceCardStyle()}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            style={textareaStyle(120)}
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleSearch}
              disabled={searchLoading || !input.trim()}
              style={primaryButtonStyle(searchLoading)}
            >
              {searchLoading ? 'กำลังค้นหา...' : 'ค้นเอกสาร'}
            </button>
          </div>
        </div>
        <div style={surfaceCardStyle('#ffffff')}>
          <div style={{ marginBottom: 12, color: '#6b7280', fontSize: 14 }}>ผลการค้นหา</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {searchResults.length === 0 && !searchLoading && <div style={chipStyle('#f8fafc')}>ยังไม่มีผลลัพธ์</div>}
            {searchResults.map((item, idx) => (
              <div key={idx} style={chipStyle('#ffffff')}>
                {item.error ? (
                  <div style={{ color: '#ef4444' }}>{item.error}</div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: '#6b21a8' }}>หน้า {item.metadata?.page ?? '?'} · {item.metadata?.filename || 'ไม่ระบุ'}</div>
                    <div style={{ marginTop: 6, color: '#374151' }}>{item.text}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#9ca3af' }}>score: {item.score?.toFixed?.(4)}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        {(healthState || healthLoading) && (
          <div style={surfaceCardStyle('#ffffff')}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>สถานะเอเจนต์</div>
            {healthLoading && <div style={{ color: '#2563eb', marginBottom: 8 }}>กำลังตรวจสอบ...</div>}
            {renderHealth()}
          </div>
        )}
      </div>
    )
  }

  function renderIngestPanel() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={surfaceCardStyle()}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={settingsLabelStyle()}>หมวดหมู่ใหม่ (สร้างได้เอง)</label>
              <input
                value={categoryLabel}
                onChange={(e) => {
                  const value = e.target.value
                  setCategoryLabel(value)
                  setCollection(slugifyCollection(value))
                }}
                placeholder="เช่น ฝ่ายบุคคล, นโยบายบริษัท"
                style={settingsInputStyle()}
              />
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={settingsLabelStyle()}>รหัส collection (เลือกเองหรือใช้ค่าที่สร้างให้)</label>
              <input
                value={collection}
                onChange={(e) => setCollection(slugifyCollection(e.target.value))}
                placeholder="doc_dude_knowledge"
                style={settingsInputStyle()}
              />
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
              style={textareaStyle(90)}
            />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={uploadButtonStyle(uploading)}>
                📁 เลือกไฟล์
                <input type="file" accept={allowedUpload} style={{ display: 'none' }} onChange={handleUpload} />
              </label>
              <small style={{ color: '#6b7280' }}>รองรับ: PDF / DOCX / PNG / JPG / BMP / WEBP</small>
            </div>
            {uploading && <div style={{ color: '#2563eb' }}>กำลังอัปโหลด...</div>}
            {uploadInfo && (
              <div style={chipStyle(uploadInfo.ok ? '#ecfdf5' : '#fee2e2')}>
                {uploadInfo.ok ? (
                  <>
                    <div style={{ fontWeight: 600 }}>อัปโหลดสำเร็จ 🎉</div>
                    <div>doc_id: {uploadInfo.document_id}</div>
                    <div>chunks: {uploadInfo.chunks}</div>
                    <div>collection: {uploadInfo.collection}</div>
                  </>
                ) : (
                  <div>⚠️ {uploadInfo.detail || 'เกิดข้อผิดพลาด'}</div>
                )}
              </div>
            )}
          </div>
        </div>
        {(healthState || healthLoading) && (
          <div style={surfaceCardStyle('#ffffff')}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>สถานะเอเจนต์</div>
            {healthLoading && <div style={{ color: '#2563eb', marginBottom: 8 }}>กำลังตรวจสอบ...</div>}
            {renderHealth()}
          </div>
        )}
      </div>
    )
  }

  function renderSettingsPanel() {
    if (modelConfigLoading) {
      return (
        <div style={surfaceCardStyle('#ffffff')}>
          <div style={{ color: '#2563eb' }}>กำลังโหลดการตั้งค่าโมเดล...</div>
        </div>
      )
    }

    return (
      <>
        {modelConfigError && <div style={chipStyle('#fee2e2')}>⚠️ {modelConfigError}</div>}
        {modelConfigMessage && <div style={chipStyle('#ecfdf5')}>{modelConfigMessage}</div>}
        <div style={chipStyle('#fff7fb')}>
          <div style={{ fontWeight: 600, color: '#7e22ce' }}>คำแนะนำการเปิดฟีเจอร์</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            • <strong>Declarative Task Orchestration</strong> – เปิดไว้เพื่อให้ intent ↔ tool ทำงานอัตโนมัติ ลดโค้ดสลับมือ (แนะนำเปิดเสมอ)<br />
            • <strong>Tool Registry & Schema Validation</strong> – เปิดเมื่ออยากให้ payload ถูกตรวจให้ตรง schema (ปิดได้เฉพาะช่วง debug ที่รับ payload แปลกๆ)<br />
            • <strong>Structured Logging & Audit Trail</strong> – เปิดเพื่อเก็บ log JSON + Correlation-ID สำหรับ trace ระบบ (ปิดเฉพาะกรณีต้องการลด I/O ชั่วคราว)<br />
            • <strong>Eval / Trace Capture</strong> – เปิดไว้เพื่อตามดู prompt/latency; ปิดได้หากต้องการลดการเขียนฐานข้อมูลขณะทดสอบ
          </div>
        </div>
        {configLoading ? (
          <div style={chipStyle('#e0f2fe')}>กำลังโหลดการตั้งค่าฟีเจอร์…</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {featureItems.map((item) => (
              <FeatureToggle
                key={item.key}
                open
                label={item.label}
                description={item.description}
                value={Boolean(featureConfig[item.key])}
                loading={configSavingKey === item.key}
                onToggle={(next) => handleFeatureToggle(item.key, next)}
              />
            ))}
          </div>
        )}
        {configError && <div style={sidebarErrorStyle()}>{configError}</div>}
        {lastRouting && (
          <div style={surfaceCardStyle('#ffffff')}>
            <div style={{ fontWeight: 600 }}>ผลการเลือกโมเดลล่าสุด</div>
            <div style={{ marginTop: 8, color: '#374151' }}>โมเดล: {lastRouting.model || 'ไม่ระบุ'}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>
              เหตุผล: {describeReason(lastRouting.reason)}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>
              ตรวจพบโค้ด: {lastRouting.has_code ? 'ใช่' : 'ไม่'} · ไทยเข้มข้น: {lastRouting.thai_heavy ? 'ใช่' : 'ไม่'}
            </div>
            {lastRouting.context && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#6366f1' }}>บริบทที่ใช้: {lastRouting.context}</div>
            )}
          </div>
        )}

        <div style={surfaceCardStyle('#ffffff')}>
          <div style={{ fontWeight: 600 }}>1. Multi-Model Setup (Optimized)</div>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <label style={settingsLabelStyle()}>Primary Thai Model</label>
            <input
              value={modelConfigDraft.multi_model.primary_thai}
              onChange={(e) => updateModelDraft('multi_model', { primary_thai: e.target.value })}
              style={settingsInputStyle()}
            />
            <label style={settingsLabelStyle()}>Secondary Thai Model</label>
            <input
              value={modelConfigDraft.multi_model.secondary_thai}
              onChange={(e) => updateModelDraft('multi_model', { secondary_thai: e.target.value })}
              style={settingsInputStyle()}
            />
            <label style={settingsLabelStyle()}>Coding Specialist</label>
            <input
              value={modelConfigDraft.multi_model.coding_specialist}
              onChange={(e) => updateModelDraft('multi_model', { coding_specialist: e.target.value })}
              style={settingsInputStyle()}
            />
            <label style={settingsLabelStyle()}>Embedding Model</label>
            <input
              value={modelConfigDraft.multi_model.embedding}
              onChange={(e) => updateModelDraft('multi_model', { embedding: e.target.value })}
              style={settingsInputStyle()}
            />
          </div>
          <button
            type="button"
            onClick={() => saveModelSection('multi_model')}
            disabled={savingSection === 'multi_model'}
            style={{ ...outlineButtonStyle(savingSection === 'multi_model'), marginTop: 16 }}
          >
            {savingSection === 'multi_model' ? 'กำลังบันทึก...' : 'บันทึก Multi-Model Setup'}
          </button>
        </div>

        <div style={surfaceCardStyle('#ffffff')}>
          <div style={{ fontWeight: 600 }}>2. Intelligent Routing Logic</div>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <label style={settingsLabelStyle()}>Thai Conversation Model</label>
            <input
              value={modelConfigDraft.routing.thai_conversation}
              onChange={(e) => updateModelDraft('routing', { thai_conversation: e.target.value })}
              style={settingsInputStyle()}
            />
            <label style={settingsLabelStyle()}>Coding Tasks Model</label>
            <input
              value={modelConfigDraft.routing.coding_tasks}
              onChange={(e) => updateModelDraft('routing', { coding_tasks: e.target.value })}
              style={settingsInputStyle()}
            />
            <label style={settingsLabelStyle()}>Mixed Tasks Model</label>
            <input
              value={modelConfigDraft.routing.mixed_tasks}
              onChange={(e) => updateModelDraft('routing', { mixed_tasks: e.target.value })}
              style={settingsInputStyle()}
            />
            <label style={settingsLabelStyle()}>Default Model</label>
            <input
              value={modelConfigDraft.routing.default_model}
              onChange={(e) => updateModelDraft('routing', { default_model: e.target.value })}
              style={settingsInputStyle()}
            />
          </div>
          <div style={{ marginTop: 20, fontWeight: 600 }}>3. Optimize Routing Signals</div>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <label style={settingsLabelStyle()}>คำสำคัญที่ถือว่าเป็นโค้ด (บรรทัดละหนึ่งคำ)</label>
            <textarea
              value={routingKeywordText}
              onChange={(e) => {
                setRoutingKeywordText(e.target.value)
                const keywords = e.target.value
                  .split('\n')
                  .map((item) => item.trim())
                  .filter(Boolean)
                updateModelDraft('routing', { code_keywords: keywords })
              }}
              style={textareaStyle(120)}
            />
            <label style={settingsLabelStyle()}>เกณฑ์สัดส่วนตัวอักษรไทย (0-1)</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={modelConfigDraft.routing.thai_threshold}
              onChange={(e) => {
                const value = parseFloat(e.target.value)
                updateModelDraft('routing', { thai_threshold: Number.isNaN(value) ? 0 : value })
              }}
              style={settingsInputStyle()}
            />
          </div>
          <button
            type="button"
            onClick={() => saveModelSection('routing')}
            disabled={savingSection === 'routing'}
            style={{ ...outlineButtonStyle(savingSection === 'routing'), marginTop: 16 }}
          >
            {savingSection === 'routing' ? 'กำลังบันทึก...' : 'บันทึก Routing Logic'}
          </button>
        </div>

        <div style={surfaceCardStyle('#ffffff')}>
          <div style={{ fontWeight: 600 }}>4. Memory Optimization</div>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <label style={settingsLabelStyle()}>OLLAMA_MAX_LOADED_MODELS</label>
            <input
              type="number"
              min={1}
              value={modelConfigDraft.memory.max_loaded_models}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10)
                updateModelDraft('memory', { max_loaded_models: Number.isNaN(parsed) ? 1 : Math.max(parsed, 1) })
              }}
              style={settingsInputStyle()}
            />
            <label style={settingsLabelStyle()}>เปิดใช้ Flash Attention</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={Boolean(modelConfigDraft.memory.flash_attention)}
                onChange={(e) => updateModelDraft('memory', { flash_attention: e.target.checked })}
              />
              <span style={{ fontSize: 13, color: '#4b5563' }}>ตั้งค่า OLLAMA_FLASH_ATTENTION=1</span>
            </div>
            <label style={settingsLabelStyle()}>จำกัดหน่วยความจำ (เช่น 10G)</label>
            <input
              value={modelConfigDraft.memory.memory_limit}
              onChange={(e) => updateModelDraft('memory', { memory_limit: e.target.value })}
              style={settingsInputStyle()}
            />
          </div>
          <button
            type="button"
            onClick={() => saveModelSection('memory')}
            disabled={savingSection === 'memory'}
            style={{ ...outlineButtonStyle(savingSection === 'memory'), marginTop: 16 }}
          >
            {savingSection === 'memory' ? 'กำลังบันทึก...' : 'บันทึก Memory Optimization'}
          </button>
        </div>

        <div style={surfaceCardStyle('#ffffff')}>
          <div style={{ fontWeight: 600 }}>5. Smart Context Management</div>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <label style={settingsLabelStyle()}>บริบทสำหรับงานโค้ดภาษาไทย</label>
            <textarea
              value={modelConfigDraft.context.thai_code_context}
              onChange={(e) => updateModelDraft('context', { thai_code_context: e.target.value })}
              style={textareaStyle(140)}
            />
            <label style={settingsLabelStyle()}>จำนวนข้อความประวัติสูงสุด</label>
            <input
              type="number"
              min={0}
              max={100}
              value={modelConfigDraft.context.max_history_messages}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10)
                updateModelDraft('context', { max_history_messages: Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(parsed, 100)) })
              }}
              style={settingsInputStyle()}
            />
          </div>
          <button
            type="button"
            onClick={() => saveModelSection('context')}
            disabled={savingSection === 'context'}
            style={{ ...outlineButtonStyle(savingSection === 'context'), marginTop: 16 }}
          >
            {savingSection === 'context' ? 'กำลังบันทึก...' : 'บันทึก Context Management'}
          </button>
        </div>
      </>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #fdf2ff 0%, #f7f9ff 45%, #eefbf7 100%)'
      }}
    >
      <aside style={sidebarStyle(sidebarOpen)}>
        <div style={sidebarHeaderStyle()}>
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            style={collapseButtonStyle()}
          >
            {sidebarOpen ? '⟨' : '⟩'}
          </button>
          {sidebarOpen && <span style={{ fontWeight: 700 }}>DuDe Console</span>}
        </div>

        <div style={sidebarSectionStyle()}>
          {sidebarOpen && <div style={sidebarSectionTitleStyle()}>โหมดการทำงาน</div>}
          <div style={{ display: 'grid', gap: 8 }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={sidebarTabStyle(activeTab === tab.id, sidebarOpen)}
                disabled={streaming && tab.id !== activeTab}
              >
                <span style={{ fontSize: 20 }}>{tab.icon}</span>
                {sidebarOpen && (
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{tab.label}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{tab.hint}</div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={sidebarFooterStyle(sidebarOpen)}>
          {sidebarOpen ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {lastCorrelation ? `Correlation-ID ล่าสุด: ${lastCorrelation}` : 'ยังไม่มี Correlation-ID'}
            </div>
          ) : (
            <span style={{ fontSize: 11, writingMode: 'vertical-rl', transform: 'rotate(180deg)', opacity: 0.6 }}>
              ID
            </span>
          )}
        </div>
      </aside>

      <main style={mainPaneStyle()}>
        <header style={topBarStyle()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={mascotBubbleStyle()} aria-hidden="true">
              <LogoCat size={60} />
            </div>
            <pre style={headerBannerStyle()}>
===============================  DuDe HaWaiian PlaygrounD  ================================
เวลาคุณเดิน แล้วหันซ้าย-ขวาไม่เจอใครไม่ต้องตกใจ เพราะผมจะอยู่ด้านหลังคอยระวังให้คุณเสมอ เดินไปให้ถึงที่หมายด้วยกันนะ 🌈
==================================  ใครเรียกลุง ผมตบหัวทิ่ม   ==================================
            </pre>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={headerChipStyle()}>
              <span role="img" aria-label="sunset">🌅</span> {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button
              type="button"
              onClick={checkHealth}
              style={outlineButtonStyle(healthLoading)}
              disabled={healthLoading}
            >
              {healthLoading ? 'กำลังตรวจ...' : '🔍 ตรวจสุขภาพเอเจนต์'}
            </button>
          </div>
        </header>

        <section style={mainContentStyle()}>
          {activeTab === 'settings'
            ? renderSettingsPanel()
            : activeTab === 'chat'
              ? renderChatPanel()
              : activeTab === 'doc'
                ? renderDocPanel()
                : renderIngestPanel()}
        </section>
      </main>
    </div>
  )
}

function FeatureToggle({ open, label, description, value, loading, onToggle }) {
  function handleToggle(next) {
    if (loading) return
    onToggle(next)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => handleToggle(!value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleToggle(!value)
        }
      }}
      style={featureToggleStyle(open, loading, value)}
    >
      <ToggleSwitch
        checked={value}
        disabled={loading}
        onChange={(next) => handleToggle(next)}
      />
      {open && (
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'rgba(249,250,251,0.75)' }}>{description}</div>
          {loading && <div style={{ fontSize: 11, color: '#bfdbfe', marginTop: 4 }}>กำลังบันทึก…</div>}
        </div>
      )}
    </div>
  )
}

function ToggleSwitch({ checked, onChange, disabled }) {
  function handleToggle(next) {
    if (disabled) return
    onChange(next)
  }

  function handleClick(event) {
    event.stopPropagation()
    handleToggle(!checked)
  }

  function handleKeyDown(event) {
    if (disabled) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      handleToggle(!checked)
    }
  }

  return (
    <span
      role="switch"
      tabIndex={0}
      aria-checked={checked}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={toggleSwitchStyle(checked, disabled)}
    >
      <span style={toggleKnobStyle(checked)} />
    </span>
  )
}

function sidebarStyle(open) {
  return {
    width: open ? 280 : 76,
    background: '#111827',
    color: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.25s ease',
    borderRight: '1px solid rgba(255,255,255,0.08)'
  }
}

function headerChipStyle() {
  return {
    padding: '6px 12px',
    borderRadius: 999,
    background: 'rgba(99,102,241,0.12)',
    color: '#4338ca',
    fontWeight: 600,
    fontSize: 13,
    boxShadow: '0 8px 18px rgba(79,70,229,0.12)'
  }
}

function mascotBubbleStyle() {
  return {
    width: 60,
    height: 60,
    borderRadius: '50%',
    background: 'linear-gradient(160deg,#fff0f8 0%,#e5f4ff 100%)',
    boxShadow: '0 14px 30px rgba(244,114,182,0.25)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(148,163,184,0.25)'
  }
}

function headerBannerStyle() {
  return {
    margin: 0,
    padding: '12px 18px',
    borderRadius: 18,
    background: 'linear-gradient(90deg,#fef3c7 0%,#fce7f3 50%,#ede9fe 100%)',
    boxShadow: '0 20px 45px rgba(244,114,182,0.22)',
    color: '#312e81',
    fontFamily: '"Noto Sans Thai", sans-serif',
    fontSize: 13,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    border: '1px solid rgba(79,70,229,0.18)'
  }
}

function sidebarHeaderStyle() {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  }
}

function collapseButtonStyle() {
  return {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.35)',
    color: '#f9fafb',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer'
  }
}

function sidebarSectionStyle() {
  return {
    padding: '18px 18px 12px',
    display: 'grid',
    gap: 12
  }
}

function sidebarTabStyle(active, open) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: open ? 12 : 0,
    justifyContent: open ? 'flex-start' : 'center',
    borderRadius: 12,
    padding: open ? '10px 12px' : '10px 0',
    border: active ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    color: '#f9fafb',
    cursor: 'pointer'
  }
}

function sidebarFooterStyle(open) {
  return {
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: open ? '14px 18px' : '14px 0',
    textAlign: open ? 'left' : 'center'
  }
}

function sidebarSectionTitleStyle() {
  return {
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)'
  }
}

function sidebarLoadingStyle() {
  return {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)'
  }
}

function sidebarErrorStyle() {
  return {
    fontSize: 12,
    color: '#fca5a5',
    background: 'rgba(239,68,68,0.12)',
    borderRadius: 8,
    padding: '8px 10px'
  }
}

function featureToggleStyle(open, loading, active) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: open ? 12 : 0,
    justifyContent: open ? 'flex-start' : 'center',
    background: active ? 'rgba(52,211,153,0.16)' : 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: open ? '8px 10px' : '8px 0',
    border: active ? '1px solid rgba(52,211,153,0.28)' : '1px solid rgba(255,255,255,0.12)',
    cursor: loading ? 'wait' : 'pointer',
    opacity: loading ? 0.7 : 1
  }
}

function toggleSwitchStyle(checked, disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    width: 36,
    height: 20,
    borderRadius: 999,
    padding: '2px',
    background: checked ? '#34d399' : 'rgba(255,255,255,0.25)',
    border: '1px solid rgba(255,255,255,0.4)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.2s ease',
    position: 'relative'
  }
}

function toggleKnobStyle(checked) {
  return {
    display: 'block',
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#ffffff',
    boxShadow: '0 0 4px rgba(15,23,42,0.25)',
    transform: checked ? 'translateX(16px)' : 'translateX(0)',
    transition: 'transform 0.2s ease'
  }
}

function mainPaneStyle() {
  return {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#f3f4f6'
  }
}

function topBarStyle() {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 32px 16px'
  }
}

function tabHeaderStyle() {
  return {
    display: 'flex',
    gap: 12,
    padding: '0 32px 16px',
    flexWrap: 'wrap'
  }
}

function mainTabPillStyle(active) {
  return {
    padding: '8px 14px',
    borderRadius: 999,
    background: active ? '#ffffff' : '#e2e8f0',
    color: '#111827',
    fontWeight: active ? 600 : 500,
    boxShadow: active ? '0 8px 18px rgba(15,23,42,0.08)' : 'none'
  }
}

function mainContentStyle() {
  return {
    flex: 1,
    padding: '0 32px 32px',
    display: 'grid',
    gap: 20
  }
}

function chatPanelStyle() {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minHeight: 'calc(100vh - 220px)'
  }
}

function chatHistoryShellStyle() {
  return {
    ...surfaceCardStyle('#ffffff'),
    height: '100%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  }
}

function chatEmptyStyle() {
  return {
    color: '#6b7280',
    textAlign: 'center',
    padding: '32px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    fontSize: 14
  }
}

function chatComposerStyle() {
  return {
    ...surfaceCardStyle('#ffffff'),
    display: 'grid',
    gap: 12
  }
}

function chatTextareaStyle() {
  return {
    borderRadius: 14,
    border: '1px solid #d1d5db',
    padding: 16,
    minHeight: 120,
    resize: 'vertical',
    fontSize: 14,
    fontFamily: 'inherit',
    color: '#111827'
  }
}

function surfaceCardStyle(background = '#ffffff') {
  return {
    background,
    borderRadius: 16,
    border: '1px solid rgba(15,23,42,0.12)',
    boxShadow: '0 20px 50px rgba(15,23,42,0.08)',
    padding: 24
  }
}

function textareaStyle(minHeight) {
  return {
    width: '100%',
    borderRadius: 16,
    border: '1px solid #d1d5db',
    padding: 16,
    minHeight,
    resize: 'vertical',
    background: '#ffffff',
    fontFamily: 'inherit',
    fontSize: 14,
    color: '#111827'
  }
}

function primaryButtonStyle(disabled) {
  return {
    marginTop: 16,
    padding: '12px 20px',
    borderRadius: 14,
    border: 'none',
    background: disabled ? '#d1d5db' : '#111827',
    color: '#ffffff',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 12px 24px rgba(15,23,42,0.18)',
    transition: 'background 0.2s ease'
  }
}

function outlineButtonStyle(loading) {
  return {
    borderRadius: 12,
    padding: '10px 16px',
    border: '1px solid #111827',
    background: loading ? '#e0f2fe' : '#ffffff',
    color: '#111827',
    cursor: loading ? 'wait' : 'pointer',
    fontWeight: 600
  }
}

function uploadButtonStyle(loading) {
  return {
    display: 'inline-flex',
    gap: 8,
    alignItems: 'center',
    padding: '10px 16px',
    borderRadius: 14,
    border: '1px solid rgba(17,24,39,0.25)',
    background: loading ? '#e0f2fe' : '#f9fafb',
    color: '#111827',
    cursor: loading ? 'wait' : 'pointer',
    fontWeight: 600
  }
}

function settingsLabelStyle() {
  return {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: 500
  }
}

function settingsInputStyle() {
  return {
    borderRadius: 12,
    border: '1px solid #d1d5db',
    padding: '8px 12px',
    fontSize: 13,
    color: '#111827'
  }
}

function chipStyle(background = '#f9fafb') {
  return {
    background,
    borderRadius: 14,
    border: '1px solid rgba(15,23,42,0.08)',
    padding: 16,
    boxShadow: '0 8px 18px rgba(15,23,42,0.05)'
  }
}

function bubbleStyle(isUser) {
  return {
    background: isUser ? '#e0e7ff' : '#ffffff',
    borderRadius: 16,
    padding: 16,
    border: '1px solid rgba(79,70,229,0.18)',
    boxShadow: '0 6px 14px rgba(99,102,241,0.08)'
  }
}
