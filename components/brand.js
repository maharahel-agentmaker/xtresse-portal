// Xtressé portal — brand palette + status logic.
// The four-color status rule: complete = Carob, active = L'Orange,
// neutral = creme, at-risk = Merlot. No green/red/blue rainbow.

export const X = {
  orange: '#FFC45C',
  orangeDeep: '#F5A623',
  orangeSoft: '#FFE2A8',
  creme: '#F7F5F0',
  cremeWarm: '#EFEAE0',
  merlot: '#C15757',
  merlotDeep: '#8E3C3C',
  black: '#191817',
  blackSoft: '#2A2826',
  line: '#E1DCD0',
  lineStrong: '#C8C2B4',
  muted: '#6E6A63',
}

// Stages where the client is expected to act — marked with the L'Orange accent.
export const ATTENTION_STAGES = ['Client Review', 'Client Feedback']

// Neutral, editorial stage chip (creme fill, Carob text, hairline).
export const stageChipStyle = {
  backgroundColor: X.cremeWarm,
  color: X.black,
  border: `1px solid ${X.line}`,
  whiteSpace: 'nowrap',
  display: 'inline-block',
}

// Small count pill — the heroic L'Orange accent.
export const countPillStyle = {
  backgroundColor: X.orange,
  color: X.black,
  fontWeight: 500,
}

// Task complete/in-progress badge.
export function taskStatusStyle(completed) {
  return completed
    ? { backgroundColor: X.black, color: X.creme }
    : { backgroundColor: X.orange, color: X.black }
}

// Row tint for attention stages (very soft orange wash).
export function stageRowTint(stage) {
  return ATTENTION_STAGES.includes(stage) ? X.orangeSoft : 'transparent'
}
