import { useState } from 'react'
import TaskModal from './TaskModal'
import TaskPreviewTooltip from './TaskPreviewTooltip'
import { X, ATTENTION_STAGES, stageChipStyle, countPillStyle, stageRowTint } from './brand'
import { IconPin, IconAlert, IconInbox } from './Icons'

export default function TableView({ tasks, sections, onRefresh, primaryColor = X.orange }) {
  const [selectedTask, setSelectedTask] = useState(null)
  const [sortBy, setSortBy] = useState('stage')
  const [pinnedTasks, setPinnedTasks] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pinnedTasks')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  const stageOrder = [
    'New Intake', 'Clarification', 'Creative Team Review', 'Client Review',
    'Design in Progress', 'Product Review', 'Client Feedback', 'Ready for Production',
    'In Production', 'Delivery', 'Complete', 'Cancelled'
  ]

  const getStage = (task) => {
    if (!task.custom_fields) return 'Unassigned'
    const stageField = task.custom_fields.find(f =>
      f.name && (f.name.toLowerCase().includes('stage') || f.name.toLowerCase() === 'stage')
    )
    if (!stageField) return 'Unassigned'
    return stageField.display_value || stageField.enum_value?.name || 'Unassigned'
  }

  const formatFieldValue = (field) => {
    const value = field.display_value || field.text_value || field.number_value || field.enum_value?.name
    if (!value) return '—'
    if (typeof value === 'string' && (value.includes('T') || (value.includes('-') && value.length === 10))) {
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
    }
    return value
  }

  const togglePin = (taskGid, e) => {
    e.stopPropagation()
    const updated = pinnedTasks.includes(taskGid)
      ? pinnedTasks.filter(id => id !== taskGid)
      : [...pinnedTasks, taskGid]
    setPinnedTasks(updated)
    localStorage.setItem('pinnedTasks', JSON.stringify(updated))
  }

  const groupedTasks = {}
  tasks.forEach(task => {
    const stage = getStage(task)
    if (!groupedTasks[stage]) groupedTasks[stage] = { pinned: [], unpinned: [] }
    if (pinnedTasks.includes(task.gid)) groupedTasks[stage].pinned.push(task)
    else groupedTasks[stage].unpinned.push(task)
  })

  Object.keys(groupedTasks).forEach(stage => {
    if (sortBy === 'urgency') {
      groupedTasks[stage].unpinned.sort((a, b) => {
        if (!a.due_on) return 1
        if (!b.due_on) return -1
        return new Date(a.due_on) - new Date(b.due_on)
      })
    }
  })

  const sortedStages = [
    ...stageOrder.filter(s => groupedTasks[s]),
    ...Object.keys(groupedTasks).filter(s => !stageOrder.includes(s)).sort()
  ]

  const thStyle = {
    padding: '12px 16px', textAlign: 'left',
    textTransform: 'uppercase', letterSpacing: '0.12em',
    fontSize: '11px', fontWeight: 500, color: X.muted,
    backgroundColor: X.cremeWarm,
  }

  const renderTableRow = (task) => {
    const stage = getStage(task)
    const isPinned = pinnedTasks.includes(task.gid)
    const highlight = stageRowTint(stage)

    return (
      <tr
        key={task.gid}
        onClick={() => setSelectedTask(task)}
        className="cursor-pointer"
        style={{ borderBottom: `1px solid ${X.line}`, backgroundColor: highlight, transition: 'background-color 160ms' }}
        onMouseEnter={(e) => { if (highlight === 'transparent') e.currentTarget.style.backgroundColor = X.creme }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = highlight }}
      >
        <td className="sticky left-0 z-10" style={{ padding: '12px 16px', minWidth: '300px', backgroundColor: highlight === 'transparent' ? '#FFFFFF' : X.orangeSoft, borderRight: `1px solid ${X.line}` }}>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => togglePin(task.gid, e)}
              className="flex-shrink-0"
              title={isPinned ? 'Unpin' : 'Pin'}
              style={{ color: isPinned ? X.orangeDeep : X.lineStrong, display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <IconPin size={16} />
            </button>
            <TaskPreviewTooltip task={task}>
              <p style={{ fontSize: '14px', fontWeight: 400, color: task.completed ? X.muted : X.black, textDecoration: task.completed ? 'line-through' : 'none' }}>
                {task.name}
              </p>
            </TaskPreviewTooltip>
          </div>
        </td>

        <td style={{ padding: '12px 16px', fontSize: '14px', color: X.muted }}>
          {task.num_subtasks > 0 ? task.num_subtasks : '—'}
        </td>
        <td style={{ padding: '12px 16px' }}>
          <span style={{ ...stageChipStyle, padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 500 }}>
            {stage}
          </span>
        </td>
        {task.custom_fields && task.custom_fields.map((field) => {
          if (field.name.includes('Priority') || field.name.includes('priority') ||
              field.name.includes('Client Feedback') || field.name.includes('Product Review') ||
              field.name.toLowerCase().includes('stage')) {
            return null
          }
          return (
            <td key={field.gid} style={{ padding: '12px 16px', fontSize: '14px', color: X.muted }}>
              {formatFieldValue(field)}
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div className="space-y-8">
      {sortedStages.map((stage) => {
        const { pinned, unpinned } = groupedTasks[stage]
        const allStageTasks = [...pinned, ...unpinned]
        const isAttention = ATTENTION_STAGES.includes(stage)

        return (
          <div key={stage}>
            <div className="flex items-center gap-3" style={{ marginBottom: '16px' }}>
              <h2 className="x-serif" style={{ fontSize: '24px', color: X.black }}>{stage}</h2>
              <span style={{ ...countPillStyle, padding: '2px 10px', borderRadius: '999px', fontSize: '12px' }}>
                {allStageTasks.length}
              </span>
              {isAttention && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 500, color: X.black, backgroundColor: X.orangeSoft }}>
                  <IconAlert size={13} /> Awaiting client
                </span>
              )}
            </div>

            <div className="overflow-x-auto" style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: `1px solid ${X.line}`, boxShadow: '0 1px 2px rgba(25,24,23,0.04)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${X.line}` }}>
                    <th className="sticky left-0 z-20" style={{ ...thStyle, minWidth: '300px', borderRight: `1px solid ${X.line}` }}>Task</th>
                    <th style={thStyle}>Subtasks</th>
                    <th style={thStyle}>Stage</th>
                    {allStageTasks.length > 0 && allStageTasks[0].custom_fields &&
                      allStageTasks[0].custom_fields.map((field) => {
                        if (field.name.includes('Priority') || field.name.includes('priority') ||
                            field.name.includes('Client Feedback') || field.name.includes('Product Review') ||
                            field.name.toLowerCase().includes('stage')) {
                          return null
                        }
                        return <th key={field.gid} style={thStyle}>{field.name}</th>
                      })
                    }
                  </tr>
                </thead>
                <tbody>
                  {pinned.map(renderTableRow)}
                  {unpinned.map(renderTableRow)}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {tasks.length === 0 && (
        <div className="text-center" style={{ padding: '64px 0', color: X.muted }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: X.lineStrong }}><IconInbox size={40} /></div>
          <p>No tasks</p>
        </div>
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => { setSelectedTask(null); onRefresh() }}
          primaryColor={primaryColor}
        />
      )}
    </div>
  )
}
