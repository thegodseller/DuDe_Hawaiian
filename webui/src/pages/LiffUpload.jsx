import React, { useEffect, useMemo, useRef, useState } from 'react'
import liff from '@line/liff'

const allowedExtensions = '.pdf,.docx,.png,.jpg,.jpeg,.bmp,.webp'
const backdropStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #111827 0%, #312e81 50%, #1f2937 100%)',
  color: '#f9fafb',
  padding: '40px 16px',
  display: 'flex',
  justifyContent: 'center'
}

const cardStyle = {
  width: '100%',
  maxWidth: 540,
  background: 'rgba(15,23,42,0.85)',
  borderRadius: 24,
  padding: '32px 28px',
  boxShadow: '0 40px 80px rgba(15,23,42,0.35)',
  border: '1px solid rgba(99,102,241,0.25)'
}

const headingStyle = {
  fontSize: 28,
  fontWeight: 700,
  marginBottom: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 12
}

const badgeStyle = {
  fontSize: 12,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#a5b4fc',
  background: 'rgba(79,70,229,0.18)',
  padding: '6px 14px',
  borderRadius: 999,
  display: 'inline-block'
}

const fieldLabelStyle = {
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 6,
  color: '#c7d2fe'
}

const inputBaseStyle = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(15,23,42,0.6)',
  color: '#f8fafc',
  padding: '12px 16px',
  fontSize: 15,
  transition: 'border 0.2s ease, box-shadow 0.2s ease'
}

const hintStyle = {
  fontSize: 13,
  color: '#94a3b8',
  marginTop: 6
}

const buttonStyle = (tone = 'primary', disabled = false) => {
  const palette = {
    primary: {
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      color: '#f9fafb'
    },
    neutral: {
      background: 'rgba(148,163,184,0.16)',
      color: '#e2e8f0'
    }
  }
  const toneStyle = palette[tone]
  return {
    width: '100%',
    borderRadius: 16,
    border: 'none',
    padding: '14px 18px',
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: '0.02em',
    background: disabled ? 'rgba(107,114,128,0.45)' : toneStyle.background,
    color: toneStyle.color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 24px 40px rgba(79,70,229,0.35)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    marginTop: 16
  }
}

const statusStyle = (type) => ({
  marginTop: 18,
  padding: '12px 14px',
  borderRadius: 14,
  background:
    type === 'success'
      ? 'rgba(22,163,74,0.16)'
      : type === 'warning'
      ? 'rgba(249,115,22,0.16)'
      : 'rgba(239,68,68,0.16)',
  border:
    type === 'success'
      ? '1px solid rgba(22,163,74,0.4)'
      : type === 'warning'
      ? '1px solid rgba(249,115,22,0.4)'
      : '1px solid rgba(239,68,68,0.4)',
  color:
    type === 'success'
      ? '#bbf7d0'
      : type === 'warning'
      ? '#fed7aa'
      : '#fecaca',
  fontSize: 14,
  lineHeight: 1.5
})

const uploadDropzoneStyle = {
  border: '1px dashed rgba(129,140,248,0.55)',
  borderRadius: 20,
  padding: '28px 16px',
  background: 'rgba(79,70,229,0.08)',
  textAlign: 'center',
  color: '#dbeafe'
}

const profileChipStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: 'rgba(148,163,184,0.18)',
  borderRadius: 999,
  padding: '6px 14px',
  marginTop: 12,
  fontSize: 14,
  color: '#e0e7ff'
}

function ProfileChip({ profile }) {
  if (!profile) return null
  return (
    <div style={profileChipStyle}>
      {profile.pictureUrl ? (
        <img
          src={profile.pictureUrl}
          alt="profile"
          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(148,163,184,0.35)' }}
        />
      ) : (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(99,102,241,0.3)',
            color: '#c7d2fe',
            fontSize: 14,
            fontWeight: 600
          }}
        >
          {(profile.displayName || '?').slice(0, 1).toUpperCase()}
        </div>
      )}
      <div>
        <div style={{ fontWeight: 600 }}>{profile.displayName}</div>
        {profile.statusMessage && (
          <div style={{ fontSize: 12, color: '#cbd5f5' }}>{profile.statusMessage}</div>
        )}
      </div>
    </div>
  )
}

export default function LiffUpload() {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [note, setNote] = useState('')
  const [collection, setCollection] = useState('doc_dude_knowledge')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  const liffId = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('liffId') || import.meta.env.VITE_LIFF_UPLOAD_ID || ''
  }, [])

  useEffect(() => {
    async function initLiff() {
      if (!liffId) {
        setError('ยังไม่ได้ตั้งค่า LIFF ID (กำหนดค่า VITE_LIFF_UPLOAD_ID หรือแนบ ?liffId=...)')
        return
      }
      try {
        await liff.init({ liffId })
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href })
          return
        }
        const userProfile = await liff.getProfile()
        setProfile(userProfile)
        setReady(true)
      } catch (err) {
        setError(`ไม่สามารถเริ่ม LIFF ได้: ${err?.message || err}`)
      }
    }
    initLiff()
  }, [liffId])

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0]
    if (!selected) {
      setFile(null)
      return
    }
    const ext = selected.name.split('.').pop()?.toLowerCase()
    if (!ext || !allowedExtensions.replace(/\./g, '').split(',').includes(ext)) {
      setStatus({ type: 'error', message: 'ไฟล์ไม่รองรับ โปรดเลือก PDF, DOCX หรือรูปภาพ (PNG/JPG/WebP)' })
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setStatus(null)
    setFile(selected)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!file) {
      setStatus({ type: 'error', message: 'กรุณาเลือกไฟล์ก่อนอัปโหลด' })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('collection', collection)
      if (note) {
        form.append('note', note.trim())
      }
      if (profile?.displayName) {
        form.append('source', profile.displayName)
      }
      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: form
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.detail || `อัปโหลดไม่สำเร็จ (HTTP ${response.status})`)
      }
      const chunkInfo =
        data?.result?.chunks_added ??
        data?.result?.chunks ??
        (data?.result?.chunks_added === 0 ? 0 : undefined)
      setStatus({
        type: 'success',
        message:
          chunkInfo !== undefined
            ? `เพิ่มข้อมูลสำเร็จ (${chunkInfo} ส่วน) พร้อมใช้งานในคอลเลกชัน ${collection}`
            : 'เพิ่มข้อมูลสำเร็จ พร้อมใช้งานได้ทันที'
      })
      setFile(null)
      setNote('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setStatus({ type: 'error', message: String(err) })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenConsole = () => {
    window.open('https://dude.thegodseller.com', '_blank')
  }

  return (
    <div style={backdropStyle}>
      <div style={cardStyle}>
        <div style={badgeStyle}>DuDe Hawaiian</div>
        <div style={headingStyle}>
          <span role="img" aria-label="sparkles">
            ✨
          </span>
          <span>เพิ่มความรู้ผ่าน LINE Mini App</span>
        </div>
        <p style={{ fontSize: 15, color: '#cbd5f5', lineHeight: 1.6, marginBottom: 18 }}>
          ส่งไฟล์ความรู้ (PDF / DOCX / รูปภาพ) เข้าระบบ RAG ได้โดยตรงจาก LINE. ระบบจะ OCR, สร้าง embedding และพร้อมตอบกลับในทันที
        </p>

        {profile && <ProfileChip profile={profile} />}

        {error ? (
          <div style={statusStyle('error')}>{error}</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
            <label style={fieldLabelStyle} htmlFor="collection">
              หมวดหมู่ความรู้ (Collection)
            </label>
            <input
              id="collection"
              style={inputBaseStyle}
              value={collection}
              onChange={(event) => setCollection(event.target.value)}
              placeholder="doc_dude_knowledge"
              required
            />
            <div style={hintStyle}>ตั้งชื่อหมวดหมู่เพื่อแบ่งทีม/ฝ่าย เช่น marketing_docs, hr_policy</div>

            <div style={{ marginTop: 20 }}>
              <label style={fieldLabelStyle} htmlFor="file">
                เลือกไฟล์ความรู้
              </label>
              <div style={uploadDropzoneStyle}>
                <input
                  id="file"
                  type="file"
                  accept={allowedExtensions}
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'rgba(99,102,241,0.35)',
                    border: '1px solid rgba(129,140,248,0.6)',
                    color: '#eef2ff',
                    borderRadius: 14,
                    padding: '10px 18px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  เลือกไฟล์จากอุปกรณ์
                </button>
                <div style={{ marginTop: 12, fontSize: 14 }}>
                  {file ? <>✅ {file.name}</> : 'รองรับไฟล์ PDF, DOCX, PNG, JPG, WebP (สูงสุด ~20MB)'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label style={fieldLabelStyle} htmlFor="note">
                โน้ตสั้น ๆ (ไม่บังคับ)
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="รายละเอียดเพิ่มเติม เช่น เวอร์ชัน, ผู้จัดทำ"
                rows={3}
                style={{ ...inputBaseStyle, resize: 'vertical' }}
              />
            </div>

            <button type="submit" style={buttonStyle('primary', loading || !ready)} disabled={loading || !ready}>
              {loading ? 'กำลังอัปโหลด...' : 'อัปโหลดเข้า RAG'}
            </button>

            <button type="button" onClick={handleOpenConsole} style={buttonStyle('neutral', false)}>
              เปิด DuDe Console
            </button>

            <div style={hintStyle}>หลังอัปโหลดสำเร็จ สามารถพิมพ์ถามใน LINE หรือหน้าเว็บได้ทันที</div>

            {status && <div style={statusStyle(status.type)}>{status.message}</div>}
          </form>
        )}
      </div>
    </div>
  )
}
