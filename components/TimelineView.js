import { X } from './brand'
import { IconCalendar, IconUser } from './Icons'

export default function TimelineView({ tasks, primaryColor = X.orange }) {
  const getStage = (task) => {
    if (!task.custom_fields) return 'Unassigned'
    const stageField = task.custom_fields.find(f =>
      f.name && (f.name.toLowerCase().includes('stage') || f.name.toLowerCase() === 'stage')
    )
    if (!stageField) return 'Unassigned'
    return stageField.display_value || stageField.enum_value?.name || 'Unassigned'
  }

  const activeTasks = tasks.filter(task => {
    if (task.completed) return false
    if (getStage(task).toLowerCase() === 'cancelled') return false
    return true
  })

  const tasksByDate = {}
  activeTasks.forEach(task => {
    if (!task.due_on) return
    const date = new Date(task.due_on).toLocaleDateString()
    if (!tasksByDate[date]) tasksByDate[date] = []
    tasksByDate[date].push(task)
  })

  const sortedDates = Object.keys(tasksByDate).sort((a, b) => new Date(a) - new Date(b))

  const getDaysUntil = (dateString) => {
    const diff = Math.ceil((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return 'OVERDUE'
    if (diff === 0) return 'TODAY'
    if (diff === 1) return 'TOMORROW'
    return `${diff} DAYS`
  }

  // Brand-four mapping: overdue = Merlot (risk), today/tomorrow = L'Orange,
  // soon = orange-soft, later = neutral.
  const getStatusStyle = (dateString) => {
    const t = getDaysUntil(dateString)
    if (t === 'OVERDUE') return { bg: X.merlot, fg: '#FFFFFF', bar: X.merlot }
    if (t === 'TODAY' || t === 'TOMORROW') return { bg: X.orange, fg: X.black, bar: X.orange }
    if (parseInt(t) <= 7) return { bg: X.orangeSoft, fg: X.black, bar: X.orange }
    return { bg: X.cremeWarm, fg: X.muted, bar: X.lineStrong }
  }

  return (
    <div style={{ padding: '24px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: `1px solid ${X.line}`, boxShadow: '0 1px 2px rgba(25,24,23,0.04)' }}>
      <h2 className="x-serif" style={{ fontSize: '24px', color: X.black, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <IconCalendar size={20} /> Delivery timeline
      </h2>

      {sortedDates.length === 0 ? (
        <p style={{ textAlign: 'center', color: X.muted }}>No active tasks with due dates</p>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(dateStr => {
            const tasksForDate = tasksByDate[dateStr]
            const date = new Date(dateStr)
            const statusText = getDaysUntil(dateStr)
            const s = getStatusStyle(dateStr)

            return (
              <div key={dateStr} style={{ borderLeft: `2px solid ${s.bar}`, paddingLeft: '16px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                  <h3 style={{ fontWeight: 500, color: X.black, fontSize: '15px' }}>
                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </h3>
                  <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', backgroundColor: s.bg, color: s.fg }}>
                    {statusText}
                  </span>
                </div>

                <div className="space-y-1">
                  {tasksForDate.map(task => (
                    <div key={task.gid} style={{ padding: '10px 12px', backgroundColor: X.creme, borderRadius: '4px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 400, color: X.black }}>{task.name}</p>
                      {task.assignee && (
                        <p style={{ fontSize: '12px', color: X.muted, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <IconUser size={13} /> {task.assignee.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
