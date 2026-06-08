import { useEffect, useState } from 'react'
import axios from 'axios'

export default function PrintView() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const portalName = process.env.NEXT_PUBLIC_PORTAL_NAME || 'Project'

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
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await axios.get('/api/tasks')
        setTasks(response.data.tasks)
      } catch (error) { console.error('Error fetching tasks:', error) }
      setLoading(false)
    }
    fetchTasks()
  }, [])

  const stageOrder = [
    'New Intake', 'Clarification', 'Creative Team Review', 'Client Review',
    'Design in Progress', 'Product Review', 'Client Feedback', 'Ready for Production',
    'In Production', 'Delivery', 'Complete', 'Cancelled'
  ]

  const groupedTasks = {}
  tasks.forEach(task => {
    const stage = getStage(task)
    if (!groupedTasks[stage]) groupedTasks[stage] = []
    groupedTasks[stage].push(task)
  })

  const sortedStages = [
    ...stageOrder.filter(s => groupedTasks[s]),
    ...Object.keys(groupedTasks).filter(s => !stageOrder.includes(s)).sort()
  ]

  return (
    <div style={{ padding: '24px', fontFamily: "'Inter', Arial, sans-serif", color: '#191817', backgroundColor: '#FFFFFF' }}>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .page-break { page-break-after: always; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #E1DCD0; padding: 8px; text-align: left; }
          th { background-color: #F7F5F0; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
          h1 { font-size: 28px; margin-bottom: 24px; font-family: 'Playfair Display', Georgia, serif; }
          h2 { font-size: 18px; margin-top: 20px; margin-bottom: 10px; color: #191817; font-family: 'Playfair Display', Georgia, serif; }
          .stage-count { color: #6E6A63; font-size: 12px; margin-left: 10px; }
        }
        body { margin: 0; padding: 0; }
        @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=Inter:wght@300;400;500&display=swap");
      `}</style>

      <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, fontSize: '32px' }}>{portalName} — task report</h1>
      <p style={{ color: '#6E6A63', fontSize: '13px' }}>Generated {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
      <p style={{ color: '#6E6A63', fontSize: '13px' }}>Total tasks: {tasks.length}</p>

      {sortedStages.map(stage => (
        <div key={stage} className="page-break" style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, fontSize: '20px', marginTop: '24px', marginBottom: '12px' }}>
            {stage} <span className="stage-count" style={{ color: '#6E6A63', fontSize: '12px', marginLeft: '10px' }}>({groupedTasks[stage].length})</span>
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #E1DCD0', padding: '8px', textAlign: 'left', backgroundColor: '#F7F5F0', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '11px' }}>Task Name</th>
                <th style={{ border: '1px solid #E1DCD0', padding: '8px', textAlign: 'left', backgroundColor: '#F7F5F0', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '11px' }}>Assignee</th>
                <th style={{ border: '1px solid #E1DCD0', padding: '8px', textAlign: 'left', backgroundColor: '#F7F5F0', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '11px' }}>Due Date</th>
                <th style={{ border: '1px solid #E1DCD0', padding: '8px', textAlign: 'left', backgroundColor: '#F7F5F0', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '11px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {groupedTasks[stage].map(task => (
                <tr key={task.gid}>
                  <td style={{ border: '1px solid #E1DCD0', padding: '8px' }}>{task.name}</td>
                  <td style={{ border: '1px solid #E1DCD0', padding: '8px' }}>{task.assignee?.name || '—'}</td>
                  <td style={{ border: '1px solid #E1DCD0', padding: '8px' }}>{formatDate(task.due_on)}</td>
                  <td style={{ border: '1px solid #E1DCD0', padding: '8px' }}>{task.completed ? 'Complete' : 'In Progress'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ marginTop: '40px', borderTop: '1px solid #E1DCD0', paddingTop: '20px', fontSize: '12px', color: '#6E6A63' }}>
        <p>End of report</p>
      </div>

      <button
        onClick={() => window.print()}
        className="no-print"
        style={{ padding: '12px 24px', backgroundColor: '#191817', color: '#F7F5F0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', marginTop: '20px', fontWeight: 500 }}
      >
        Print report
      </button>
    </div>
  )
}
