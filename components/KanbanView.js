import { useState } from 'react'
import TaskModal from './TaskModal'
import { X, taskStatusStyle } from './brand'
import { IconCalendar, IconUser, IconLayers } from './Icons'

export default function KanbanView({ tasks, sections, onRefresh, primaryColor = X.orange }) {
  const [selectedTask, setSelectedTask] = useState(null)

  const columns = sections.map(section => ({
    ...section,
    tasks: tasks.filter(t => t.section?.gid === section.gid),
  }))

  const unsectioned = tasks.filter(t => !t.section)
  if (unsectioned.length > 0) {
    columns.push({ gid: 'unsectioned', name: 'Other', tasks: unsectioned })
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-6">
      {columns.map((col) => (
        <div
          key={col.gid}
          className="flex-shrink-0 w-80"
          style={{ backgroundColor: X.cremeWarm, borderRadius: '8px', border: `1px solid ${X.line}`, padding: '16px' }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
            <h3 className="x-serif" style={{ fontSize: '18px', color: X.black }}>{col.name}</h3>
            <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 500, backgroundColor: '#FFFFFF', color: X.muted, border: `1px solid ${X.line}` }}>
              {col.tasks.length}
            </span>
          </div>

          <div className="space-y-3" style={{ minHeight: '96px' }}>
            {col.tasks.length === 0 ? (
              <p style={{ color: X.lineStrong, fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No tasks</p>
            ) : (
              col.tasks.map((task) => {
                const customFields = (task.custom_fields || []).filter(f => f.display_value || f.text_value || f.number_value || f.enum_value)
                return (
                  <div
                    key={task.gid}
                    onClick={() => setSelectedTask(task)}
                    className="cursor-pointer"
                    style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: `1px solid ${X.line}`, transition: 'box-shadow 280ms cubic-bezier(.22,1,.36,1)' }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(25,24,23,0.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <h4 style={{ fontSize: '14px', fontWeight: 500, color: task.completed ? X.muted : X.black, textDecoration: task.completed ? 'line-through' : 'none' }}>
                      {task.name}
                    </h4>

                    {task.notes && (
                      <p className="line-clamp-2" style={{ color: X.muted, fontSize: '12px', marginTop: '4px' }}>{task.notes}</p>
                    )}

                    <div className="flex flex-wrap gap-3" style={{ marginTop: '8px', fontSize: '12px', color: X.muted, alignItems: 'center' }}>
                      {task.due_on && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCalendar size={13} /> {new Date(task.due_on).toLocaleDateString()}</span>}
                      {task.assignee && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconUser size={13} /> {task.assignee.name}</span>}
                      {task.num_subtasks > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconLayers size={13} /> {task.num_subtasks}</span>}
                    </div>

                    {task.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1" style={{ marginTop: '6px' }}>
                        {task.tags.map(tag => (
                          <span key={tag.gid} style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', backgroundColor: X.orangeSoft, color: X.black }}>
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {customFields.length > 0 && (
                      <div className="flex flex-wrap gap-1" style={{ marginTop: '6px' }}>
                        {customFields.map(field => (
                          <span key={field.gid} style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', backgroundColor: X.creme, color: X.muted, border: `1px solid ${X.line}` }}>
                            {field.name}: {field.display_value || field.text_value || field.number_value || field.enum_value?.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: '8px' }}>
                      <span style={{ ...taskStatusStyle(task.completed), padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 500 }}>
                        {task.completed ? 'Complete' : 'In progress'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ))}

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
