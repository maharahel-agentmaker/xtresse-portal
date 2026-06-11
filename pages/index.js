import { useState, useEffect } from 'react'
import axios from 'axios'
import Head from 'next/head'
import TableView from '../components/TableView'
import KanbanView from '../components/KanbanView'
import DueThisWeekSection from '../components/DueThisWeekSection'
import ProgressDashboard from '../components/ProgressDashboard'
import TimelineView from '../components/TimelineView'
import ExportButton from '../components/ExportButton'
import TaskModal from '../components/TaskModal'
import { X } from '../components/brand'
import { IconTable, IconKanban, IconDashboard, IconCalendar, IconRefresh, IconSearch, IconFilter } from '../components/Icons'

export default function Home() {
  const portalName = process.env.NEXT_PUBLIC_PORTAL_NAME || 'Project Portal'
  const accent = X.orange

  const [tasks, setTasks] = useState([])
  const [sections, setSections] = useState([])
  const [view, setView] = useState('table')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStage, setFilterStage] = useState('all')
  const [filterRequester, setFilterRequester] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [deepLinkTaskGid, setDeepLinkTaskGid] = useState(null)

  // Read a ?task=<gid> deep link from the URL on mount (e.g. from a Slack link)
  useEffect(() => {
    const gid = new URLSearchParams(window.location.search).get('task')
    if (gid) setDeepLinkTaskGid(gid)
  }, [])

  const closeDeepLink = () => {
    setDeepLinkTaskGid(null)
    // Clean the ?task= param so a refresh doesn't reopen it
    window.history.replaceState(null, '', window.location.pathname)
  }

  useEffect(() => {
    const saved = localStorage.getItem('portalPreferences')
    if (saved) {
      const prefs = JSON.parse(saved)
      setFilterStage(prefs.filterStage || 'all')
      setFilterRequester(prefs.filterRequester || 'all')
      setView(prefs.view || 'table')
    }
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const prefs = { filterStage, filterRequester, view }
    localStorage.setItem('portalPreferences', JSON.stringify(prefs))
  }, [filterStage, filterRequester, view])

  const fetchTasks = async () => {
    try {
      const response = await axios.get('/api/tasks')
      setTasks(response.data.tasks)
      setSections(response.data.sections)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 10000)
    return () => clearInterval(interval)
  }, [])

  const getStage = (task) => {
    if (!task.custom_fields) return 'Unassigned'
    const stageField = task.custom_fields.find(f =>
      f.name && (f.name.toLowerCase().includes('stage') || f.name.toLowerCase() === 'stage')
    )
    if (!stageField) return 'Unassigned'
    return stageField.display_value || stageField.enum_value?.name || 'Unassigned'
  }

  // Reads the "Requester email" custom field. Matches flexibly so it works whether
  // the field is named "Requester email", "Requester Email", "Email", etc.
  const getRequesterEmail = (task) => {
    if (!task.custom_fields) return ''
    const byName = (pred) => task.custom_fields.find(f => f.name && pred(f.name.toLowerCase()))
    const field =
      byName(n => n.includes('requester') && n.includes('email')) ||
      byName(n => n.includes('requester')) ||
      byName(n => n.includes('email'))
    if (!field) return ''
    return field.display_value || field.text_value || ''
  }

  const uniqueRequesters = [...new Set(tasks.map(t => getRequesterEmail(t)).filter(Boolean))].sort()
  const uniqueStages = [...new Set(tasks.map(t => getStage(t)))].sort()

  const filteredTasks = tasks.filter(task => {
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      task.name.toLowerCase().includes(searchLower) ||
      task.notes?.toLowerCase().includes(searchLower) ||
      getRequesterEmail(task).toLowerCase().includes(searchLower)
    if (!matchesSearch) return false
    if (filterStage !== 'all') {
      if (getStage(task) !== filterStage) return false
    }
    if (filterRequester !== 'all') {
      if (getRequesterEmail(task) !== filterRequester) return false
    }
    return true
  })

  const completedCount = filteredTasks.filter(t => t.completed).length
  const totalCount = filteredTasks.length
  const activeFilters = [filterStage !== 'all', filterRequester !== 'all'].filter(Boolean).length

  // Tab styling — active = L'Orange on Carob; inactive = ghost on Carob
  const tabStyle = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: isMobile ? '6px 10px' : '8px 14px',
    borderRadius: '4px',
    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
    border: active ? '1px solid transparent' : '1px solid rgba(247,245,240,0.22)',
    backgroundColor: active ? accent : 'transparent',
    color: active ? X.black : 'rgba(247,245,240,0.82)',
    transition: 'all 280ms cubic-bezier(.22,1,.36,1)',
  })

  return (
    <>
      <Head>
        <title>{portalName} — Project Portal</title>
        <meta name="description" content={`${portalName} project portal`} />
      </Head>

      <div style={{ minHeight: '100vh', backgroundColor: X.creme, paddingBottom: isMobile ? '20px' : '0' }}>
        {/* Header — Carob bar (the heroic Carob + L'Orange pairing) */}
        <div className="sticky top-0 z-40" style={{ backgroundColor: X.black, borderBottom: `1px solid ${X.blackSoft}` }}>
          <div className="max-w-7xl mx-auto" style={{ padding: isMobile ? '14px 12px' : '18px 24px' }}>

            {/* Top Row — wordmark + progress + view tabs */}
            <div className="flex justify-between items-center" style={{ gap: isMobile ? '8px' : '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div className="flex items-center gap-3" style={{ minWidth: '0' }}>
                <img
                  src="/xtresse-logo.svg"
                  alt={portalName}
                  style={{ height: isMobile ? '20px' : '26px', width: 'auto', filter: 'invert(1)' }}
                />
                {!isMobile && lastUpdated && (
                  <span className="x-eyebrow" style={{ color: 'rgba(247,245,240,0.45)', marginLeft: '10px' }}>
                    Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {totalCount > 0 && !isMobile && (
                  <div className="text-right" style={{ marginRight: '10px' }}>
                    <span className="x-eyebrow" style={{ color: 'rgba(247,245,240,0.6)' }}>{completedCount} / {totalCount} complete</span>
                    <div style={{ width: '128px', height: '4px', backgroundColor: X.blackSoft, borderRadius: '999px', marginTop: '5px' }}>
                      <div style={{ width: `${totalCount ? (completedCount / totalCount) * 100 : 0}%`, height: '4px', borderRadius: '999px', backgroundColor: accent, transition: 'width 520ms cubic-bezier(.22,1,.36,1)' }} />
                    </div>
                  </div>
                )}

                <button onClick={() => setView('table')} style={tabStyle(view === 'table')}>
                  <IconTable size={16} />{!isMobile && 'Table'}
                </button>
                <button onClick={() => setView('kanban')} style={tabStyle(view === 'kanban')}>
                  <IconKanban size={16} />{!isMobile && 'Kanban'}
                </button>
                <button onClick={() => setView('dashboard')} style={tabStyle(view === 'dashboard')}>
                  <IconDashboard size={16} />{!isMobile && 'Dashboard'}
                </button>
                {!isMobile && (
                  <button onClick={() => setView('timeline')} style={tabStyle(view === 'timeline')}>
                    <IconCalendar size={16} />Timeline
                  </button>
                )}
                <button onClick={fetchTasks} style={tabStyle(false)} title="Refresh">
                  <IconRefresh size={16} />
                </button>
              </div>
            </div>

            {/* Search — underline input on the dark bar */}
            <div className="flex gap-2" style={{ flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center' }}>
              <div className="flex-1 relative" style={{ minWidth: isMobile ? '100%' : 'auto', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(247,245,240,0.25)', paddingBottom: '6px' }}>
                <span style={{ color: 'rgba(247,245,240,0.6)', display: 'flex' }}><IconSearch size={16} /></span>
                <input
                  type="text"
                  placeholder={isMobile ? 'Search…' : 'Search tasks, names, descriptions…'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: X.creme, fontSize: '14px' }}
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                style={{ ...tabStyle(activeFilters > 0), marginLeft: isMobile ? 0 : '8px' }}
              >
                <IconFilter size={16} />{!isMobile && 'Filters'}{activeFilters > 0 && ` (${activeFilters})`}
              </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div style={{ marginTop: '14px', padding: '16px', backgroundColor: X.creme, borderRadius: '8px', border: `1px solid ${X.line}` }}>
                <div className="grid gap-4" style={{ gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}>
                  <div>
                    <label className="x-eyebrow" style={{ display: 'block', marginBottom: '8px' }}>Stage</label>
                    <select
                      value={filterStage}
                      onChange={(e) => setFilterStage(e.target.value)}
                      style={{ width: '100%', padding: '8px 4px', border: 'none', borderBottom: `1px solid ${X.lineStrong}`, background: 'transparent', fontSize: '14px', color: X.black, outline: 'none' }}
                    >
                      <option value="all">All stages</option>
                      {uniqueStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="x-eyebrow" style={{ display: 'block', marginBottom: '8px' }}>Requester email</label>
                    <select
                      value={filterRequester}
                      onChange={(e) => setFilterRequester(e.target.value)}
                      style={{ width: '100%', padding: '8px 4px', border: 'none', borderBottom: `1px solid ${X.lineStrong}`, background: 'transparent', fontSize: '14px', color: X.black, outline: 'none' }}
                    >
                      <option value="all">All requesters</option>
                      {uniqueRequesters.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 justify-between items-center" style={{ marginTop: '14px' }}>
                  {activeFilters > 0 && (
                    <button
                      onClick={() => { setFilterStage('all'); setFilterRequester('all') }}
                      style={{ fontSize: '13px', fontWeight: 500, color: X.merlot, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Clear filters
                    </button>
                  )}
                  {!isMobile && <ExportButton tasks={filteredTasks} />}
                </div>
              </div>
            )}

            {isMobile && !showFilters && (
              <div style={{ marginTop: '10px' }}><ExportButton tasks={filteredTasks} /></div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto" style={{ padding: isMobile ? '20px 12px' : '32px 24px' }}>
          {loading ? (
            <div className="text-center" style={{ padding: '80px 0', color: X.muted }}>
              <p className="x-serif" style={{ fontSize: '28px', color: X.lineStrong }}>Loading {portalName}…</p>
            </div>
          ) : (
            <>
              {!isMobile && view !== 'dashboard' && <DueThisWeekSection tasks={filteredTasks} />}

              {filteredTasks.length === 0 ? (
                <div className="text-center" style={{ padding: '80px 0', color: X.muted }}>
                  <p className="x-serif" style={{ fontSize: '44px', color: X.lineStrong, lineHeight: 1 }}>0</p>
                  <p style={{ marginTop: '8px' }}>No tasks match your search or filters</p>
                </div>
              ) : view === 'table' ? (
                <TableView tasks={filteredTasks} sections={sections} onRefresh={fetchTasks} primaryColor={accent} />
              ) : view === 'kanban' ? (
                <KanbanView tasks={filteredTasks} sections={sections} onRefresh={fetchTasks} primaryColor={accent} />
              ) : view === 'dashboard' ? (
                <ProgressDashboard tasks={filteredTasks} primaryColor={accent} />
              ) : view === 'timeline' ? (
                <TimelineView tasks={filteredTasks} primaryColor={accent} />
              ) : null}
            </>
          )}
        </div>

        {/* Deep-linked task (opened via ?task=<gid>, e.g. from a Slack link) */}
        {deepLinkTaskGid && tasks.find(t => t.gid === deepLinkTaskGid) && (
          <TaskModal
            task={tasks.find(t => t.gid === deepLinkTaskGid)}
            onClose={closeDeepLink}
            onUpdate={() => { fetchTasks(); closeDeepLink() }}
            primaryColor={accent}
          />
        )}
      </div>
    </>
  )
}
