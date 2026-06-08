import { X } from './brand'
import { IconDownload, IconPrinter } from './Icons'

export default function ExportButton({ tasks }) {
  const getStage = (task) => {
    if (!task.custom_fields) return 'Unassigned'
    const stageField = task.custom_fields.find(f =>
      f.name && (f.name.toLowerCase().includes('stage') || f.name.toLowerCase() === 'stage')
    )
    if (!stageField) return 'Unassigned'
    return stageField.display_value || stageField.enum_value?.name || 'Unassigned'
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const portalName = process.env.NEXT_PUBLIC_PORTAL_NAME || 'Portal'

  const exportCSV = () => {
    const headers = ['Task Name', 'Assignee', 'Due Date', 'Stage', 'Status', 'Subtasks']
    const rows = tasks.map(task => [
      task.name,
      task.assignee?.name || '—',
      formatDate(task.due_on),
      getStage(task),
      task.completed ? 'Complete' : 'In Progress',
      task.num_subtasks
    ])
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${portalName}-Tasks-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const exportPDF = () => window.open('/print', '_blank')

  const btn = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px', borderRadius: '4px', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer', border: `1px solid ${X.black}`, backgroundColor: 'transparent',
    color: X.black, transition: 'all 280ms cubic-bezier(.22,1,.36,1)',
  }
  const hoverOn = (e) => { e.currentTarget.style.backgroundColor = X.black; e.currentTarget.style.color = X.creme }
  const hoverOff = (e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = X.black }

  return (
    <div className="flex gap-2">
      <button onClick={exportCSV} style={btn} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <IconDownload size={15} /> Export CSV
      </button>
      <button onClick={exportPDF} style={btn} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <IconPrinter size={15} /> Export PDF
      </button>
    </div>
  )
}
