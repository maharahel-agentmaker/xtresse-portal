import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { X } from './brand'
import { IconClose, IconChevronDown, IconChevronRight, IconCheck, IconPaperclip, IconSend, IconLayers } from './Icons'

export default function TaskModal({ task, onClose, onUpdate, primaryColor = X.orange }) {
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState(task.notes || '')
  const [name, setName] = useState(task.name || '')
  const [clientFeedback, setClientFeedback] = useState('')
  const [expandedSubtask, setExpandedSubtask] = useState(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [conversation, setConversation] = useState([])
  const fileInputRef = useRef(null)

  const MAX_FILE_MB = 4
  const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

  const fetchConversation = async () => {
    try {
      const res = await fetch(`/api/tasks/${task.gid}/comments`)
      if (!res.ok) return
      const data = await res.json()
      setConversation(data.messages || [])
    } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    fetchConversation()
    const interval = setInterval(fetchConversation, 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.gid])

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    const datePart = dateString.split('T')[0]
    const parts = datePart.split('-')
    if (parts.length !== 3) return '—'
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const day = parseInt(parts[2], 10)
    if (isNaN(year) || isNaN(month) || isNaN(day)) return '—'
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = error => reject(error)
    })
  }

  const uploadFilesToAsana = async (taskGid) => {
    if (uploadedFiles.length === 0) return { ok: true, errors: [] }
    const errors = []
    try {
      setLoading(true)
      for (const fileObj of uploadedFiles) {
        if (!fileObj.file) continue
        try {
          const fileBuffer = await fileToBase64(fileObj.file)
          const response = await fetch('/api/tasks/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskGid, fileName: fileObj.name, fileBuffer, fileType: fileObj.type })
          })
          if (!response.ok) {
            let msg = `${response.status}`
            try {
              const data = await response.json()
              const d = data.details
              msg = (d && (d.errors?.[0]?.message || d.message)) || data.error || msg
            } catch (e) { /* ignore */ }
            errors.push(`${fileObj.name}: ${msg}`)
          }
        } catch (error) {
          errors.push(`${fileObj.name}: ${error.message}`)
        }
      }
      return { ok: errors.length === 0, errors }
    } catch (error) {
      return { ok: false, errors: [error.message] }
    } finally { setLoading(false) }
  }



  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    const tooBig = files.filter(f => f.size > MAX_FILE_BYTES)
    const okFiles = files.filter(f => f.size <= MAX_FILE_BYTES)
    if (tooBig.length > 0) {
      alert(
        `These files are over the ${MAX_FILE_MB} MB limit and weren't added:\n\n` +
        tooBig.map(f => `• ${f.name} (${formatFileSize(f.size)})`).join('\n') +
        `\n\nFor larger files, paste a share link (Drive, Dropbox, WeTransfer) in the feedback box instead.`
      )
    }
    const newFiles = okFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`, name: file.name, size: file.size, type: file.type, file
    }))
    if (newFiles.length > 0) setUploadedFiles([...uploadedFiles, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (fileId) => setUploadedFiles(uploadedFiles.filter(f => f.id !== fileId))

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleSendFeedback = async () => {
    if (!clientFeedback.trim() && uploadedFiles.length === 0) {
      alert('Please enter feedback or attach a file before sending')
      return
    }
    setLoading(true)
    try {
      const fileNames = uploadedFiles.map(f => f.name)

      if (uploadedFiles.length > 0) {
        const { ok, errors } = await uploadFilesToAsana(task.gid)
        if (!ok) {
          alert(
            'Your files could not be attached, so nothing was sent:\n\n' +
            errors.join('\n') +
            '\n\nPlease try again. For large files, paste a share link in the box instead.'
          )
          setLoading(false)
          return
        }
      }

      // Build the comment. Include an "Uploaded:" line so the conversation shows
      // a confirmation even when only a file (no text) was sent.
      let body = clientFeedback.trim()
      if (fileNames.length > 0) {
        body = (body ? body + '\n\n' : '') + `Uploaded: ${fileNames.join(', ')}`
      }
      await axios.post(`/api/tasks/${task.gid}/comment`, { text: `[Client Feedback]\n${body}` })

      try {
        const notificationType = uploadedFiles.length > 0 ? 'upload' : 'comment'
        const notificationMessage = uploadedFiles.length > 0
          ? `${fileNames.join(', ')}\n\n${clientFeedback}`
          : clientFeedback
        const response = await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskName: task.name, taskGid: task.gid, message: notificationMessage,
            type: notificationType,
            fileName: fileNames.length > 0 ? fileNames.join(', ') : null,
            userName: 'Client'
          })
        })
        const data = await response.json()
        if (!response.ok) console.error('Slack notification failed:', data)
      } catch (error) { console.error('Error sending Slack notification:', error) }

      setShowConfirmation(true)
      setClientFeedback('')
      setUploadedFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchConversation()
      setTimeout(() => setShowConfirmation(false), 5000)
    } catch (e) {
      console.error('Error sending feedback:', e)
      alert('Error sending feedback: ' + e.message)
    }
    setLoading(false)
  }

  const customFields = (task.custom_fields || []).filter(f =>
    (f.display_value || f.text_value || f.number_value || f.enum_value) &&
    !f.name.includes('Priority') && !f.name.includes('priority') &&
    !f.name.includes('Client Feedback') && !f.name.includes('Product Review')
  )

  const subtasks = task.subtasks || []

  const renderFieldValue = (value) => {
    if (!value) return '—'
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        const datePart = value.split('T')[0]
        const parts = datePart.split('-')
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10)
          const month = parseInt(parts[1], 10)
          const day = parseInt(parts[2], 10)
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            const date = new Date(year, month - 1, day)
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          }
        }
      } catch (e) {}
    }
    if (typeof value === 'string') {
      const urlRegex = /(https?:\/\/[^\s]+)/g
      const parts = value.split(urlRegex)
      if (parts.length > 1) {
        return (
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {parts.map((part, idx) => {
              if (part.startsWith('http://') || part.startsWith('https://')) {
                return <a key={idx} href={part} target="_blank" rel="noopener noreferrer" style={{ color: X.black, textDecoration: 'underline' }}>{part}</a>
              }
              return <span key={idx}>{part}</span>
            })}
          </span>
        )
      }
    }
    return value
  }

  const eyebrow = { textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: '11px', fontWeight: 500, color: X.muted, marginBottom: '4px' }
  const fieldVal = { fontSize: '14px', fontWeight: 400, color: X.black }
  const statusStyle = task.completed
    ? { backgroundColor: X.black, color: X.creme }
    : { backgroundColor: X.orange, color: X.black }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(25,24,23,0.5)' }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', maxWidth: '42rem', width: '100%', maxHeight: '100vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(25,24,23,0.10)' }}>
        <div style={{ padding: '24px' }}>

          {showConfirmation && (
            <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: X.orangeSoft, borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ color: X.black, flexShrink: 0, display: 'flex' }}><IconCheck size={22} /></span>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 500, color: X.black }}>Feedback sent.</p>
                <p style={{ fontSize: '13px', color: X.muted, marginTop: '6px' }}>Your message has been posted and your team has been notified. It will appear in the conversation below.</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="sticky top-0 z-40" style={{ backgroundColor: '#FFFFFF', paddingBottom: '16px', marginBottom: '16px', borderBottom: `1px solid ${X.line}` }}>
            <div className="flex justify-between items-start" style={{ marginBottom: '16px' }}>
              <h1 className="x-serif" style={{ fontSize: '24px', color: X.black, marginRight: '16px' }}>{name}</h1>
              <button onClick={onClose} style={{ color: X.muted, flexShrink: 0, display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Close"><IconClose size={22} /></button>
            </div>
            <div>
              <span style={{ ...statusStyle, padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 500 }}>
                {task.completed ? 'Complete' : 'In progress'}
              </span>
            </div>
          </div>

          {/* Standard Fields Grid */}
          <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '24px', backgroundColor: X.creme, borderRadius: '8px', padding: '16px' }}>
            {task.created_at && (
              <div><p style={eyebrow}>Created</p><p style={fieldVal}>{formatDate(task.created_at)}</p></div>
            )}
            {task.modified_at && (
              <div><p style={eyebrow}>Last modified</p><p style={fieldVal}>{formatDate(task.modified_at)}</p></div>
            )}
            {task.num_subtasks > 0 && (
              <div><p style={eyebrow}>Subtasks</p><p style={{ ...fieldVal, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><IconLayers size={14} /> {task.num_subtasks}</p></div>
            )}
          </div>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={eyebrow}>Details</h3>
              <div className="grid grid-cols-2 gap-3" style={{ backgroundColor: X.creme, borderRadius: '8px', padding: '16px' }}>
                {customFields.map((field) => (
                  <div key={field.gid}>
                    <p style={eyebrow}>{field.name}</p>
                    <div style={{ ...fieldVal, wordBreak: 'break-word' }}>
                      {renderFieldValue(field.display_value || field.text_value || field.number_value || field.enum_value?.name)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtasks */}
          {subtasks.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ ...eyebrow, marginBottom: '12px' }}>Subtasks ({subtasks.length})</h3>
              <div className="space-y-2">
                {subtasks.map((subtask) => (
                  <div key={subtask.gid}>
                    <button
                      onClick={() => setExpandedSubtask(expandedSubtask === subtask.gid ? null : subtask.gid)}
                      className="w-full text-left flex items-start gap-3"
                      style={{ padding: '12px', backgroundColor: X.creme, borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                    >
                      <span style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '4px', border: `1px solid ${subtask.completed ? X.black : X.lineStrong}`, backgroundColor: subtask.completed ? X.black : '#FFFFFF', color: X.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                        {subtask.completed && <IconCheck size={13} />}
                      </span>
                      <div className="flex-1">
                        <p style={{ fontSize: '14px', fontWeight: 400, color: subtask.completed ? X.muted : X.black, textDecoration: subtask.completed ? 'line-through' : 'none' }}>{subtask.name}</p>
                        <p style={{ fontSize: '12px', color: X.muted, marginTop: '4px' }}>Click to expand details</p>
                      </div>
                      <span style={{ color: X.muted, flexShrink: 0, display: 'flex', marginTop: '2px' }}>
                        {expandedSubtask === subtask.gid ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                      </span>
                    </button>

                    {expandedSubtask === subtask.gid && (
                      <div style={{ marginTop: '8px', marginLeft: '16px', padding: '16px', backgroundColor: X.orangeSoft, borderRadius: '8px', borderLeft: `2px solid ${X.orange}` }}>
                        <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '16px', backgroundColor: '#FFFFFF', borderRadius: '4px', padding: '12px' }}>
                          {subtask.created_at && <div><p style={eyebrow}>Created</p><p style={fieldVal}>{formatDate(subtask.created_at)}</p></div>}
                          {subtask.modified_at && <div><p style={eyebrow}>Last modified</p><p style={fieldVal}>{formatDate(subtask.modified_at)}</p></div>}
                          {subtask.num_subtasks > 0 && <div><p style={eyebrow}>Sub-subtasks</p><p style={{ ...fieldVal, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><IconLayers size={14} /> {subtask.num_subtasks}</p></div>}
                        </div>

                        {subtask.custom_fields && subtask.custom_fields.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <p style={{ ...eyebrow, marginBottom: '8px' }}>Details</p>
                            <div className="grid grid-cols-2 gap-3" style={{ backgroundColor: '#FFFFFF', borderRadius: '4px', padding: '16px' }}>
                              {subtask.custom_fields.map((field) => {
                                if (!field.display_value && !field.text_value && !field.number_value && !field.enum_value) return null
                                return (
                                  <div key={field.gid}>
                                    <p style={eyebrow}>{field.name}</p>
                                    <div style={{ ...fieldVal, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                      {renderFieldValue(field.display_value || field.text_value || field.number_value || field.enum_value?.name)}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {subtask.notes && (
                          <div style={{ marginBottom: '4px' }}>
                            <p style={{ ...eyebrow, marginBottom: '8px' }}>Description</p>
                            <div style={{ width: '100%', padding: '12px', border: `1px solid ${X.line}`, borderRadius: '4px', fontSize: '14px', backgroundColor: '#FFFFFF', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, color: X.black }}>{subtask.notes}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {description && (
            <div style={{ marginBottom: '24px' }}>
              <p style={{ ...eyebrow, marginBottom: '8px' }}>Description</p>
              <div style={{ width: '100%', padding: '12px', border: `1px solid ${X.line}`, borderRadius: '4px', fontSize: '14px', backgroundColor: X.creme, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, color: X.black }}>{description}</div>
            </div>
          )}

          {/* Client Feedback */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ ...eyebrow, display: 'block', marginBottom: '8px' }}>Client feedback</label>
            <textarea
              value={clientFeedback}
              onChange={(e) => setClientFeedback(e.target.value)}
              onFocus={(e) => e.target.style.borderBottomColor = X.merlot}
              onBlur={(e) => e.target.style.borderBottomColor = X.lineStrong}
              style={{ width: '100%', padding: '10px 4px', border: 'none', borderBottom: `1px solid ${X.lineStrong}`, background: 'transparent', fontSize: '14px', outline: 'none', resize: 'vertical', color: X.black, fontFamily: 'inherit' }}
              rows="3"
              placeholder="Enter your feedback here…"
            />

            {uploadedFiles.length > 0 && (
              <div style={{ marginTop: '12px', padding: '10px', backgroundColor: X.creme, borderRadius: '4px', border: `1px solid ${X.line}` }}>
                <p style={{ ...eyebrow, marginBottom: '8px' }}>Files to attach</p>
                <div className="space-y-1">
                  {uploadedFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between" style={{ fontSize: '13px', color: X.black, padding: '6px 8px', backgroundColor: '#FFFFFF', borderRadius: '4px' }}>
                      <span>{file.name} ({formatFileSize(file.size)})</span>
                      <button onClick={() => removeFile(file.id)} style={{ color: X.merlot, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Remove"><IconClose size={15} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2" style={{ marginTop: '12px' }}>
              <button
                onClick={handleSendFeedback}
                disabled={loading}
                className="x-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '4px', fontWeight: 500, fontSize: '14px', border: 'none', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
              >
                <IconSend size={15} /> {loading ? 'Sending…' : 'Send feedback'}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 14px', borderRadius: '4px', fontWeight: 500, fontSize: '14px', color: X.black, backgroundColor: 'transparent', border: `1px solid ${X.lineStrong}`, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
                title="Attach files"
              >
                <IconPaperclip size={16} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: X.muted, marginTop: '10px', lineHeight: 1.5 }}>
              Accepted files: images (JPG, PNG, GIF), PDF, Word, Excel, PowerPoint, TXT, CSV. Max {MAX_FILE_MB} MB per file. For larger files, paste a share link (Drive, Dropbox, WeTransfer) in the box above.
            </p>
          </div>

          {/* Conversation — client feedback + Branday replies, pulled live from Asana */}
          {conversation.length > 0 && (
            <div style={{ marginBottom: '4px' }}>
              <h3 style={{ ...eyebrow, marginBottom: '12px' }}>Conversation</h3>
              <div style={{ backgroundColor: X.creme, borderRadius: '8px', padding: '16px', maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {conversation.map((msg) => {
                  const isClient = msg.side === 'client'
                  const when = msg.created_at
                    ? new Date(msg.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : ''
                  return (
                    <div key={msg.gid} style={{ display: 'flex', justifyContent: isClient ? 'flex-start' : 'flex-end' }}>
                      <div style={{ maxWidth: '80%' }}>
                        <p style={{ fontSize: '11px', color: X.muted, marginBottom: '4px', textAlign: isClient ? 'left' : 'right' }}>
                          {isClient ? 'You' : (msg.author || 'Branday')}{when ? ` · ${when}` : ''}
                        </p>
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          fontSize: '14px',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          backgroundColor: isClient ? '#FFFFFF' : X.black,
                          color: isClient ? X.black : X.creme,
                          border: isClient ? `1px solid ${X.line}` : 'none',
                        }}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
