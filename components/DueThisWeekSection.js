import { X } from './brand'
import { IconClock, IconUser } from './Icons'

export default function DueThisWeekSection({ tasks }) {
  const today = new Date()
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  const dueThisWeek = tasks
    .filter(task => {
      if (!task.due_on || task.completed) return false
      const dueDate = new Date(task.due_on)
      return dueDate >= today && dueDate <= weekFromNow
    })
    .sort((a, b) => new Date(a.due_on) - new Date(b.due_on))

  if (dueThisWeek.length === 0) return null

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const getDaysUntil = (dateString) => {
    const diff = Math.ceil((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    return `${diff} days`
  }

  return (
    <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '8px', borderLeft: `2px solid ${X.orange}`, backgroundColor: X.orangeSoft }}>
      <h3 style={{ fontSize: '13px', fontWeight: 500, color: X.black, marginBottom: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        <IconClock size={15} /> Due this week ({dueThisWeek.length})
      </h3>
      <div className="space-y-2">
        {dueThisWeek.map(task => (
          <div key={task.gid} className="flex items-center justify-between" style={{ padding: '10px 12px', backgroundColor: '#FFFFFF', borderRadius: '4px' }}>
            <div className="flex-1">
              <p style={{ fontSize: '14px', fontWeight: 400, color: X.black }}>{task.name}</p>
              <p style={{ fontSize: '12px', color: X.muted, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <IconUser size={13} /> {task.assignee?.name || 'Unassigned'}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p style={{ fontSize: '12px', fontWeight: 500, color: X.black }}>{getDaysUntil(task.due_on)}</p>
              <p style={{ fontSize: '12px', color: X.muted }}>{formatDate(task.due_on)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
