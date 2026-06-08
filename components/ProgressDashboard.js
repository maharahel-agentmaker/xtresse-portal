import { useEffect, useState } from 'react'
import { X } from './brand'

export default function ProgressDashboard({ tasks, primaryColor = X.orange }) {
  const [lastViewed, setLastViewed] = useState(null)
  const [changedTasks, setChangedTasks] = useState([])

  const getStage = (task) => {
    if (!task.custom_fields) return 'Unassigned'
    const stageField = task.custom_fields.find(f =>
      f.name && (f.name.toLowerCase().includes('stage') || f.name.toLowerCase() === 'stage')
    )
    if (!stageField) return 'Unassigned'
    return stageField.display_value || stageField.enum_value?.name || 'Unassigned'
  }

  useEffect(() => {
    const saved = localStorage.getItem('lastViewed')
    if (saved) {
      const lastViewedTime = new Date(saved)
      setLastViewed(lastViewedTime)
      const changed = tasks.filter(task => {
        if (!task.modified_at) return false
        return new Date(task.modified_at) > lastViewedTime
      })
      setChangedTasks(changed)
    }
    localStorage.setItem('lastViewed', new Date().toISOString())
  }, [])

  const stageStats = {}
  tasks.forEach(task => {
    const stage = getStage(task)
    if (!stageStats[stage]) stageStats[stage] = { total: 0, completed: 0 }
    stageStats[stage].total++
    if (task.completed) stageStats[stage].completed++
  })

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.completed).length
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const overdueTasks = tasks.filter(task => {
    if (task.completed || !task.due_on) return false
    return new Date(task.due_on) < new Date()
  })

  const dueSoonTasks = tasks.filter(task => {
    if (task.completed || !task.due_on) return false
    const days = Math.ceil((new Date(task.due_on) - new Date()) / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 7
  })

  const card = {
    padding: '20px', backgroundColor: '#FFFFFF', borderRadius: '8px',
    border: `1px solid ${X.line}`, boxShadow: '0 1px 2px rgba(25,24,23,0.04)',
  }
  const statNum = { fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: '44px', lineHeight: 1, color: X.black }

  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Main Metrics — flat cards, serif stat values */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        <div style={card}>
          <p className="x-eyebrow">Overall progress</p>
          <p style={{ ...statNum, marginTop: '6px' }}>{completionPercent}%</p>
          <p style={{ fontSize: '12px', color: X.muted, marginTop: '6px' }}>{completedTasks} / {totalTasks} tasks</p>
          <div style={{ width: '100%', height: '4px', backgroundColor: X.cremeWarm, borderRadius: '999px', marginTop: '12px' }}>
            <div style={{ width: `${completionPercent}%`, height: '4px', borderRadius: '999px', backgroundColor: X.black, transition: 'width 520ms cubic-bezier(.22,1,.36,1)' }} />
          </div>
        </div>

        {/* Overdue — the single Merlot element (at-risk) */}
        <div style={card}>
          <p className="x-eyebrow" style={{ color: X.merlot }}>Overdue</p>
          <p style={{ ...statNum, color: X.merlot, marginTop: '6px' }}>{overdueTasks.length}</p>
          <p style={{ fontSize: '12px', color: X.muted, marginTop: '6px' }}>tasks past due</p>
        </div>

        <div style={card}>
          <p className="x-eyebrow">Due this week</p>
          <p style={{ ...statNum, marginTop: '6px' }}>{dueSoonTasks.length}</p>
          <p style={{ fontSize: '12px', color: X.muted, marginTop: '6px' }}>due in next 7 days</p>
        </div>

        <div style={card}>
          <p className="x-eyebrow">Updated since last visit</p>
          <p style={{ ...statNum, marginTop: '6px' }}>{changedTasks.length}</p>
          <p style={{ fontSize: '12px', color: X.muted, marginTop: '6px' }}>tasks changed</p>
        </div>
      </div>

      {/* Stage Breakdown */}
      <div style={{ ...card, marginBottom: '24px' }}>
        <h3 className="x-serif" style={{ fontSize: '20px', color: X.black, marginBottom: '16px' }}>Progress by stage</h3>
        <div className="space-y-3">
          {Object.entries(stageStats).map(([stage, stats]) => {
            const percent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
            return (
              <div key={stage}>
                <div className="flex justify-between items-center" style={{ marginBottom: '4px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 400, color: X.black }}>{stage}</p>
                  <p style={{ fontSize: '12px', color: X.muted }}>{stats.completed}/{stats.total}</p>
                </div>
                <div style={{ width: '100%', height: '4px', backgroundColor: X.cremeWarm, borderRadius: '999px' }}>
                  <div style={{ width: `${percent}%`, height: '4px', borderRadius: '999px', backgroundColor: X.black, transition: 'width 520ms cubic-bezier(.22,1,.36,1)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Changes */}
      {changedTasks.length > 0 && (
        <div style={card}>
          <h3 className="x-serif" style={{ fontSize: '20px', color: X.black, marginBottom: '12px' }}>What changed since your last visit</h3>
          <div className="space-y-2">
            {changedTasks.slice(0, 5).map(task => (
              <div key={task.gid} style={{ padding: '10px 12px', backgroundColor: X.creme, borderRadius: '4px', borderLeft: `2px solid ${X.orange}` }}>
                <p style={{ fontSize: '14px', fontWeight: 400, color: X.black }}>{task.name}</p>
                <p style={{ fontSize: '12px', color: X.muted, marginTop: '4px' }}>Updated {new Date(task.modified_at).toLocaleDateString()}</p>
              </div>
            ))}
            {changedTasks.length > 5 && (
              <p style={{ fontSize: '12px', color: X.muted }}>… and {changedTasks.length - 5} more</p>
            )}
          </div>
        </div>
      )}

      {lastViewed && (
        <p className="x-eyebrow" style={{ marginTop: '16px' }}>
          Last viewed {lastViewed.toLocaleDateString()} at {lastViewed.toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
