import React, { useMemo, useState } from 'react'

const pastelBg = 'linear-gradient(135deg, #fde2e4 0%, #e2f0ff 35%, #f3e8ff 70%, #fff5d8 100%)'
const tabs = [
  { id: 'chat', label: '💬 สนทนา', hint: 'พูดคุยทั่วไป / RAG' },
  { id: 'doc', label: '📄 ค้นเอกสาร', hint: 'ค้นจากฐานความรู้' },
  { id: 'ingest', label: '➕ เพิ่มความรู้', hint: 'อัปโหลดไฟล์ (PDF / DOCX / รูปภาพ)' }
]

const allowedUpload = '.pdf,.docx,.png,.jpg,.jpeg,.bmp,.webp'
const allowedExts = ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'bmp', 'webp']

export default function App() {
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

  const placeholder = useMemo(() => {
    if (activeTab === 'doc') return 'ป้อนคำค้น เช่น รายงานยอดขายไตรมาส'
    if (activeTab === 'ingest') return 'คำอธิบายเพิ่มเติม (ไม่บังคับ)'
    return 'เริ่มสนทนา หรือถามข้อมูลที่อยากรู้'
  }, [activeTab])

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
          } else if (event === 'complete') {
            assistant = payload.answer || assistant
            setChatHistory((prev) => {
              const next = [...prev]
              next[next.length - 1] = { role: 'assistant', content: assistant }
              return next
            })
            setStreamSources(payload.sources || [])
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
      <div style={cardStyle('#fef9f5')}>
        <div style={{ fontWeight: '600', marginBottom: 8 }}>แหล่งอ้างอิง</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {streamSources.map((src, idx) => (
            <div key={idx} style={chipStyle()}>
              <div style={{ fontSize: 13, color: '#6b21a8' }}>หน้า {src.metadata?.page ?? '?'} · {src.metadata?.filename || 'ไม่ระบุ'}</div>
              <div style={{ fontSize: 13, color: '#555' }}>{src.text}</div>
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
    return (
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {Object.entries(agents).map(([name, info]) => (
          <div key={name} style={chipStyle(info.ok ? '#ecfdf5' : '#fee2e2')}>
            <div style={{ fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: 13 }}>
              {info.ok ? 'พร้อมใช้งาน' : 'ไม่พร้อม'} · {info.status ?? 'n/a'}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: pastelBg, padding: '24px 16px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#6b21a8', fontSize: 36, marginBottom: 8 }}>🌺 DuDe Hawaiian Control Center</h1>
          <p style={{ color: '#5b5b5b', fontSize: 16 }}>จัดการเอเจนต์ ค้นความรู้ และอัปโหลดข้อมูลได้ในที่เดียว</p>
        </header>

        <section style={cardStyle('#fff')}> 
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={tabButtonStyle(activeTab === tab.id)}
                disabled={streaming && tab.id !== activeTab}
              >
                <div>{tab.label}</div>
                <small style={{ fontSize: 12, opacity: 0.8 }}>{tab.hint}</small>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%',
                borderRadius: 16,
                border: '1px solid #dcdcdc',
                padding: 16,
                minHeight: activeTab === 'ingest' ? 80 : 120,
                resize: 'vertical',
                background: '#fff'
              }}
              disabled={streaming}
            />
            {activeTab === 'ingest' && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={uploadButtonStyle(uploading)}>
                  📁 เลือกไฟล์
                  <input type="file" accept={allowedUpload} style={{ display: 'none' }} onChange={handleUpload} />
                </label>
                <small style={{ color: '#6b7280' }}>รองรับ: PDF / DOCX / PNG / JPG / BMP / WEBP</small>
              </div>
            )}
            {activeTab !== 'ingest' && (
              <button
                onClick={activeTab === 'doc' ? handleSearch : handleChatSubmit}
                disabled={streaming || (activeTab === 'doc' ? searchLoading : false)}
                style={primaryButton(streaming || searchLoading)}
              >
                {activeTab === 'doc' ? (searchLoading ? 'กำลังค้นหา...' : 'ค้นเอกสาร') : streaming ? 'กำลังตอบ...' : 'ส่งข้อความ'}
              </button>
            )}
            {activeTab === 'ingest' && uploading && <div style={{ marginTop: 8, color: '#2563eb' }}>กำลังอัปโหลด...</div>}
          </div>
        </section>

        {activeTab === 'chat' && (
          <section style={{ marginTop: 20, display: 'grid', gap: 16 }}>
            <div style={cardStyle('#fff7fc')}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>ประวัติการสนทนา</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {chatHistory.length === 0 && <div style={{ color: '#6b7280' }}>ยังไม่มีข้อความ เริ่มสนทนาได้เลย</div>}
                {chatHistory.map((msg, idx) => (
                  <div key={idx} style={bubbleStyle(msg.role === 'user')}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{msg.role === 'user' ? 'คุณ' : 'Doc Dude'}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                ))}
              </div>
            </div>
            {renderSources()}
          </section>
        )}

        {activeTab === 'doc' && (
          <section style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 12, color: '#6b7280', fontSize: 14 }}>ผลการค้นหา</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {searchResults.length === 0 && !searchLoading && <div style={cardStyle('#f8fafc')}>ยังไม่มีผลลัพธ์</div>}
              {searchResults.map((item, idx) => (
                <div key={idx} style={cardStyle('#ffffff')}>
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
          </section>
        )}

        {activeTab === 'ingest' && (
          <section style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 14, color: '#6b7280' }}>Collection (ว่าง = ค่าเริ่มต้น)</label>
              <input
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="doc_dude_knowledge"
                style={{ borderRadius: 12, border: '1px solid #dcdcdc', padding: '6px 12px' }}
              />
            </div>
            {uploadInfo && (
              <div style={cardStyle(uploadInfo.ok ? '#ecfdf5' : '#fee2e2')}>
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
          </section>
        )}

        <section style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={checkHealth} style={outlineButton(healthLoading)} disabled={healthLoading}>
              {healthLoading ? 'กำลังตรวจ...' : '🔍 ตรวจสุขภาพทุกเอเจนต์'}
            </button>
            {lastCorrelation && <span style={{ fontSize: 12, color: '#6b7280' }}>Correlation-ID: {lastCorrelation}</span>}
          </div>
          {renderHealth()}
        </section>
      </div>
    </div>
  )
}

function cardStyle(background = '#fff') {
  return {
    background,
    borderRadius: 20,
    border: '1px solid rgba(107, 33, 168, 0.08)',
    padding: 20,
    boxShadow: '0 18px 45px rgba(107,33,168,0.08)'
  }
}

function tabButtonStyle(active) {
  return {
    minWidth: 180,
    borderRadius: 18,
    padding: '12px 18px',
    border: active ? '2px solid #6b21a8' : '1px solid #e5e7eb',
    background: active ? '#f3e8ff' : '#ffffff',
    color: '#4b5563',
    boxShadow: active ? '0 10px 22px rgba(107,33,168,0.1)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-start',
    cursor: 'pointer'
  }
}

function chipStyle(background = '#f9fafb') {
  return {
    background,
    borderRadius: 14,
    border: '1px solid rgba(107,33,168,0.12)',
    padding: 14
  }
}

function bubbleStyle(isUser) {
  return {
    background: isUser ? '#e9d5ff' : '#ffffff',
    borderRadius: 16,
    padding: 16,
    border: '1px solid rgba(107,33,168,0.1)'
  }
}

function primaryButton(disabled) {
  return {
    marginTop: 16,
    padding: '12px 20px',
    borderRadius: 14,
    border: 'none',
    background: disabled ? '#d1d5db' : '#6b21a8',
    color: '#fff',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: '0 12px 24px rgba(107,33,168,0.18)'
  }
}

function outlineButton(loading) {
  return {
    borderRadius: 12,
    padding: '10px 14px',
    border: '1px solid #6b21a8',
    background: loading ? '#ede9fe' : '#ffffff',
    color: '#6b21a8',
    cursor: loading ? 'wait' : 'pointer'
  }
}

function uploadButtonStyle(loading) {
  return {
    display: 'inline-flex',
    gap: 8,
    alignItems: 'center',
    padding: '10px 16px',
    borderRadius: 14,
    border: '1px solid rgba(107,33,168,0.25)',
    background: loading ? '#ede9fe' : '#fdf2f8',
    color: '#6b21a8',
    cursor: loading ? 'wait' : 'pointer',
    fontWeight: 600
  }
}
