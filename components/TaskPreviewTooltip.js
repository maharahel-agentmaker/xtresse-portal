import { useState } from 'react'
import { X } from './brand'
import { IconUser, IconCalendar, IconLayers } from './Icons'

export default function TaskPreviewTooltip({ task, children }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({ x: rect.left, y: rect.top - 10 })
    setShowTooltip(true)
  }

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={() => setShowTooltip(false)} className="relative">
      {children}
      {showTooltip && (
        <div
          className="fixed z-50"
          style={{
            left: tooltipPos.x + 'px', top: (tooltipPos.y - 220) + 'px',
            width: '320px', padding: '14px', pointerEvents: 'none',
            backgroundColor: X.black, color: X.creme, borderRadius: '8px',
            boxShadow: '0 12px 40px rgba(25,24,23,0.10)', fontSize: '13px',
          }}
        >
          <p style={{ fontWeight: 500, marginBottom: '8px' }}>{task.name}</p>
          {task.notes && (
            <p className="line-clamp-3" style={{ color: 'rgba(247,245,240,0.75)', marginBottom: '8px' }}>{task.notes}</p>
          )}
          <div className="space-y-1" style={{ fontSize: '12px', color: 'rgba(247,245,240,0.6)' }}>
            {task.assignee && <p style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><IconUser size={13} /> {task.assignee.name}</p>}
            {task.due_on && <p style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><IconCalendar size={13} /> {new Date(task.due_on).toLocaleDateString()}</p>}
            {task.num_subtasks > 0 && <p style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><IconLayers size={13} /> {task.num_subtasks} subtasks</p>}
          </div>
        </div>
      )}
    </div>
  )
}
