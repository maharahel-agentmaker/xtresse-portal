// Xtressé portal — outline icons (Lucide-style, stroke-width 1.25, currentColor).
// Brand rule: no emoji anywhere. Use these everywhere an icon is needed.

const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
})

export const IconTable = ({ size }) => (
  <svg {...base(size)}><path d="M3 9h18M3 15h18M9 4v16M15 4v16" /><rect x="3" y="4" width="18" height="16" rx="1.5" /></svg>
)
export const IconKanban = ({ size }) => (
  <svg {...base(size)}><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><rect x="17" y="4" width="4" height="14" rx="1" /></svg>
)
export const IconDashboard = ({ size }) => (
  <svg {...base(size)}><path d="M3 13h6V3H3zM15 21h6V11h-6zM3 21h6v-5H3zM15 8h6V3h-6z" /></svg>
)
export const IconCalendar = ({ size }) => (
  <svg {...base(size)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
)
export const IconRefresh = ({ size }) => (
  <svg {...base(size)}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v4h-4" /></svg>
)
export const IconSearch = ({ size }) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
)
export const IconFilter = ({ size }) => (
  <svg {...base(size)}><path d="M3 5h18l-7 8v6l-4 2v-8z" /></svg>
)
export const IconPin = ({ size }) => (
  <svg {...base(size)}><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z M12 18v3" /></svg>
)
export const IconPaperclip = ({ size }) => (
  <svg {...base(size)}><path d="M21 11.5 12 20a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10 16a1.5 1.5 0 0 1-2-2l8-8" /></svg>
)
export const IconSend = ({ size }) => (
  <svg {...base(size)}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
)
export const IconClose = ({ size }) => (
  <svg {...base(size)}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
export const IconChevronRight = ({ size }) => (
  <svg {...base(size)}><path d="m9 6 6 6-6 6" /></svg>
)
export const IconChevronDown = ({ size }) => (
  <svg {...base(size)}><path d="m6 9 6 6 6-6" /></svg>
)
export const IconCheck = ({ size }) => (
  <svg {...base(size)}><path d="M20 6 9 17l-5-5" /></svg>
)
export const IconAlert = ({ size }) => (
  <svg {...base(size)}><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
)
export const IconClock = ({ size }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const IconDownload = ({ size }) => (
  <svg {...base(size)}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
)
export const IconPrinter = ({ size }) => (
  <svg {...base(size)}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z" /></svg>
)
export const IconUser = ({ size }) => (
  <svg {...base(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
)
export const IconLayers = ({ size }) => (
  <svg {...base(size)}><path d="m12 3 9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5" /></svg>
)
export const IconInbox = ({ size }) => (
  <svg {...base(size)}><path d="M3 12h5l2 3h4l2-3h5 M5 5h14l2 7v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" /></svg>
)
