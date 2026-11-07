// A markdown renderer that draws a reply with the mod's own styling:
// headings, colored bullets, task lists, chip-style inline code, code blocks
// with a header bar, callouts, quotes, tables and thin rules.

export const C = {
  fg: '#d4d4d8',
  bright: '#f4f4f5',
  comment: '#565f89',
  rule: 'rgba(86, 95, 137, 0.55)',
  blue: '#7aa2f7',
  purple: '#bb9af7',
  cyan: '#7dcfff',
  green: '#9ece6a',
  orange: '#ff9e64',
  yellow: '#e0af68',
  red: '#f7768e',
  dark: '#15161e',
}

// `#rrggbb` → `rgba(r, g, b, a)`, for tinted backgrounds in a palette color.
export const tint = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// The element table `$.ui.resolve(e)` hands back; typed loosely so the
// renderer works for any component's table.
type El = (props: any) => any
export type Els = { Box: El; Text: El; Code: El; Link: El; Markdown: El }

type Item = { depth: number; marker: string; text: string; task?: boolean }
type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'code'; lang: string; source: string }
  | { kind: 'list'; items: Item[] }
  | { kind: 'quote'; text: string }
  | { kind: 'callout'; type: string; title: string; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; head: string[]; rows: string[][]; align: ('l' | 'c' | 'r')[]; text: string }
  | { kind: 'para'; text: string }

const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const TASK = /^\[([ xX])\]\s+(.*)$/

const splitRow = (row: string) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(c => c.trim())

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (line.trim() === '') {
      i++
      continue
    }

    const fence = /^\s*(```+|~~~+)\s*([\w+#.-]*)/.exec(line)
    if (fence) {
      const close = fence[1] ?? '```'
      const body: string[] = []
      i++
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith(close)) {
        body.push(lines[i] ?? '')
        i++
      }
      i++
      blocks.push({ kind: 'code', lang: fence[2] ?? '', source: body.join('\n') })
      continue
    }

    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      blocks.push({ kind: 'heading', level: (heading[1] ?? '#').length, text: heading[2] ?? '' })
      i++
      continue
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ kind: 'rule' })
      i++
      continue
    }

    if (line.trimStart().startsWith('|')) {
      const rows: string[] = []
      while (i < lines.length && (lines[i] ?? '').trimStart().startsWith('|')) {
        rows.push(lines[i] ?? '')
        i++
      }
      const head = splitRow(rows[0] ?? '')
      const sep = rows[1] ?? ''
      const hasSep = /^\s*\|?\s*:?-{2,}/.test(sep)
      const align = (hasSep ? splitRow(sep) : head).map(c =>
        hasSep && c.startsWith(':') && c.endsWith(':')
          ? 'c'
          : hasSep && c.endsWith(':')
            ? 'r'
            : 'l',
      ) as ('l' | 'c' | 'r')[]
      const body = rows.slice(hasSep ? 2 : 1).map(splitRow)
      blocks.push({ kind: 'table', head, rows: body, align, text: rows.join('\n') })
      continue
    }

    if (line.trimStart().startsWith('>')) {
      const rows: string[] = []
      while (i < lines.length && (lines[i] ?? '').trimStart().startsWith('>')) {
        rows.push((lines[i] ?? '').trimStart().replace(/^>\s?/, ''))
        i++
      }
      const first = rows[0] ?? ''
      const gh = /^\[!(\w+)\]\s*(.*)$/.exec(first)
      const bold = /^\*\*(Note|Tip|Warning|Important|Caution|Info)[:.]?\*\*:?\s*(.*)$/i.exec(first)
      if (gh) {
        blocks.push({
          kind: 'callout',
          type: (gh[1] ?? 'note').toLowerCase(),
          title: gh[2] ?? '',
          text: rows.slice(1).join(' '),
        })
      } else if (bold) {
        blocks.push({
          kind: 'callout',
          type: (bold[1] ?? 'note').toLowerCase(),
          title: '',
          text: [bold[2] ?? '', ...rows.slice(1)].join(' ').trim(),
        })
      } else {
        blocks.push({ kind: 'quote', text: rows.join(' ') })
      }
      continue
    }

    if (LIST.test(line)) {
      const items: Item[] = []
      while (i < lines.length) {
        const cur = lines[i] ?? ''
        const m = LIST.exec(cur)
        if (m) {
          const body = m[3] ?? ''
          const task = TASK.exec(body)
          items.push({
            depth: Math.floor((m[1] ?? '').replace(/\t/g, '  ').length / 2),
            marker: m[2] ?? '-',
            text: task ? (task[2] ?? '') : body,
            task: task ? task[1] !== ' ' : undefined,
          })
          i++
        } else if (cur.trim() !== '' && /^\s+/.test(cur) && items.length > 0) {
          const last = items[items.length - 1]!
          last.text += ' ' + cur.trim()
          i++
        } else {
          break
        }
      }
      blocks.push({ kind: 'list', items })
      continue
    }

    const para: string[] = []
    while (i < lines.length) {
      const cur = lines[i] ?? ''
      if (
        cur.trim() === '' ||
        /^\s*(```|~~~|#{1,6}\s|>|\|)/.test(cur) ||
        LIST.test(cur)
      ) {
        break
      }
      para.push(cur.trim())
      i++
    }
    blocks.push({ kind: 'para', text: para.join(' ') })
  }

  return blocks
}

// Bold text: a soft gold, so key words stand out but stay calm.
const BOLD = '#f2cc8f'

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\[[^\]]+\]\([^)\s]+\))|(~~[^~]+~~)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g

function inline(el: Els, text: string, color: string): any[] {
  const { Text, Link } = el
  const out: any[] = []
  let last = 0

  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0
    if (at > last) {
      out.push(text.slice(last, at))
    }
    const tok = m[0]
    if (m[1]) {
      out.push(
        <Text mono color={C.orange} backgroundColor="rgba(255, 158, 100, 0.09)">
          {` ${tok.slice(1, -1)} `}
        </Text>,
      )
    } else if (m[2]) {
      out.push(
        <Text weight="semibold" color={BOLD}>
          {inline(el, tok.slice(2, -2), BOLD)}
        </Text>,
      )
    } else if (m[3]) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)
      out.push(
        <Link href={lm?.[2] ?? ''}>
          <Text color={C.cyan} underline>
            {lm?.[1] ?? tok}
          </Text>
        </Link>,
      )
    } else if (m[4]) {
      out.push(
        <Text strikethrough color={C.comment}>
          {tok.slice(2, -2)}
        </Text>,
      )
    } else if (m[5]) {
      out.push(
        <Text italic color={color}>
          {tok.slice(1, -1)}
        </Text>,
      )
    }
    last = at + tok.length
  }
  if (last < text.length) {
    out.push(text.slice(last))
  }

  return out
}

// A short centered separator. It is short on purpose: a long line of text
// makes the reply wider than the window.
function rule(el: Els) {
  const { Box, Text } = el
  return (
    <Box flexDirection="row" justifyContent="center">
      <Text mono color={C.comment}>
        ─── ◇ ───
      </Text>
    </Box>
  )
}

// Markdown inline syntax removed, for measuring table cells.
const plain = (s: string) =>
  s
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/(\*\*|__|~~|`)/g, '')

const BULLETS = ['▸', '◦', '▪']
const BULLET_COLORS = [C.cyan, C.purple, C.comment]
// Bright, light tints for headings, so they stand out from body text.
const HEADING_COLORS = ['#8ab4ff', '#d4b0ff', '#80e8ff', '#b8f27c', '#ffd580', '#ffb380']

const CALLOUTS: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  note: { icon: 'ℹ', label: 'NOTE', color: C.blue, bg: 'rgba(122, 162, 247, 0.08)' },
  info: { icon: 'ℹ', label: 'INFO', color: C.blue, bg: 'rgba(122, 162, 247, 0.08)' },
  tip: { icon: '✦', label: 'TIP', color: C.green, bg: 'rgba(158, 206, 106, 0.08)' },
  important: { icon: '◆', label: 'IMPORTANT', color: C.purple, bg: 'rgba(187, 154, 247, 0.08)' },
  warning: { icon: '▲', label: 'WARNING', color: C.yellow, bg: 'rgba(224, 175, 104, 0.09)' },
  caution: { icon: '✖', label: 'CAUTION', color: C.red, bg: 'rgba(247, 118, 142, 0.09)' },
}

function block(el: Els, b: Block): any {
  const { Box, Text, Code, Markdown } = el

  switch (b.kind) {
    case 'heading': {
      const color = HEADING_COLORS[b.level - 1] ?? C.blue
      const size = b.level === 1 ? 'title' : b.level === 2 ? 'heading' : 'body'
      // Bold text in the level's color; size and color show the level.
      return (
        <Box marginTop={b.level <= 2 ? 'md' : 'sm'}>
          <Text weight="bold" color={color} size={size}>
            {inline(el, b.text, color)}
          </Text>
        </Box>
      )
    }
    case 'code':
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between" paddingX="sm">
            <Text mono size="caption">
              <Text color={C.red}>●</Text> <Text color={C.yellow}>●</Text>{' '}
              <Text color={C.green}>●</Text>
            </Text>
            <Text mono size="caption" color={C.comment}>
              {b.lang || 'text'}
            </Text>
          </Box>
          <Code source={b.source || ' '} language={b.lang || undefined} />
        </Box>
      )
    case 'list':
      return (
        <Box flexDirection="column" gap="xs">
          {b.items.map(item => {
            const ordered = /\d/.test(item.marker)
            const depth = Math.min(item.depth, 2)
            const isTask = item.task !== undefined
            const marker = isTask
              ? item.task
                ? '☑'
                : '☐'
              : ordered
                ? item.marker.replace(')', '.')
                : BULLETS[depth]
            const markerColor = isTask
              ? item.task
                ? C.green
                : C.comment
              : ordered
                ? C.orange
                : BULLET_COLORS[depth]
            return (
              <Box flexDirection="row" gap="sm" paddingLeft={item.depth * 2}>
                <Text mono weight="bold" color={markerColor}>
                  {marker}
                </Text>
                <Box flexGrow={1} flexShrink={1}>
                  {item.task ? (
                    <Text color={C.comment} strikethrough>
                      {inline(el, item.text, C.comment)}
                    </Text>
                  ) : (
                    <Text color={C.fg}>{inline(el, item.text, C.fg)}</Text>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
      )
    case 'callout': {
      const k = CALLOUTS[b.type] ?? CALLOUTS.note!
      return (
        <Box flexDirection="column" paddingX="md" paddingY="sm" backgroundColor={tint(k.color, 0.07)}>
          <Text weight="semibold" color={k.color}>
            {k.icon} {k.label}
            {b.title ? <Text color={C.bright}> · {b.title}</Text> : null}
          </Text>
          {b.text ? (
            <Box marginTop="xs">
              <Text color={C.fg}>{inline(el, b.text, C.fg)}</Text>
            </Box>
          ) : null}
        </Box>
      )
    }
    case 'quote':
      return (
        <Box flexDirection="row" gap="sm" paddingY="xs">
          <Text color={C.purple} weight="bold">
            ▌
          </Text>
          <Box flexGrow={1} flexShrink={1}>
            <Text italic color={C.comment}>
              {inline(el, b.text, C.comment)}
            </Text>
          </Box>
        </Box>
      )
    case 'rule':
      return rule(el)
    case 'table': {
      // A rendered table: rounded frame, tinted header, soft row stripes.
      // Column widths follow the length of their content, in whole percents.
      const n = b.head.length
      if (n === 0) {
        return <Markdown text={b.text} />
      }
      const lens = b.head.map((label, i) =>
        Math.max(plain(label).length, ...b.rows.map(r => plain(r[i] ?? '').length), 4),
      )
      const sum = lens.reduce((s, w) => s + w, 0)
      const pct = lens.map(w => Math.max(Math.floor((w / sum) * 100), 10))
      const scale = Math.min(1, 100 / pct.reduce((s, p) => s + p, 0))
      const widths = pct.map(p => `${Math.floor(p * scale)}%`)
      const justify = (i: number) =>
        b.align[i] === 'r' ? 'flex-end' : b.align[i] === 'c' ? 'center' : 'flex-start'
      const cell = (i: number, child: any) => (
        <Box width={widths[i] ?? '10%'} paddingX="sm" flexDirection="row" justifyContent={justify(i)}>
          {child}
        </Box>
      )
      return (
        // No border: the desktop app rounds every border's corners, and the
        // person wants square ones. The header band and stripes mark the edges.
        <Box flexDirection="column" backgroundColor="rgba(255, 255, 255, 0.02)">
          <Box flexDirection="row" paddingY="xs" backgroundColor={tint('#8ab4ff', 0.18)}>
            {b.head.map((label, i) =>
              cell(
                i,
                <Text weight="semibold" color="#8ab4ff">
                  {inline(el, label, '#8ab4ff')}
                </Text>,
              ),
            )}
          </Box>
          {b.rows.map((row, r) => (
            <Box
              flexDirection="row"
              paddingY="xs"
              backgroundColor={r % 2 === 1 ? 'rgba(255, 255, 255, 0.05)' : 'transparent'}
            >
              {b.head.map((_, i) =>
                cell(
                  i,
                  i === 0 ? (
                    <Text weight="semibold" color={BOLD}>
                      {inline(el, row[i] ?? '', BOLD)}
                    </Text>
                  ) : (
                    <Text color={C.fg}>{inline(el, row[i] ?? '', C.fg)}</Text>
                  ),
                ),
              )}
            </Box>
          ))}
        </Box>
      )
    }
    case 'para':
      return <Text color={C.fg}>{inline(el, b.text, C.fg)}</Text>
  }
}

export function renderMarkdown(el: Els, text: string): any {
  const { Box } = el

  return (
    <Box flexDirection="column" gap="sm">
      {parse(text).map(b => block(el, b))}
    </Box>
  )
}
