import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { BarStyle, Stats } from '../types'
import { C, renderMarkdown } from './markdown'

const BACKDROP = 'editor'

const EMPTY: Stats = {
  turns: 0,
  tools: 0,
  lastSeconds: null,
  model: null,
  inTokens: 0,
  outTokens: 0,
  cwd: null,
}
const stats = atom({ plugin: 'aurora-chat', key: 'stats' } as const, EMPTY, {
  shape: 'stats-1',
})

// Editor canvas: dot grid, dashed column guides, a gradient accent line along
// the top, corner brackets and a faint </> watermark.
const BACKDROP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
  <defs>
    <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="#565f89" fill-opacity="0.28"/>
    </pattern>
    <linearGradient id="accent" x1="0" x2="1">
      <stop offset="0" stop-color="#7aa2f7"/>
      <stop offset="0.5" stop-color="#bb9af7"/>
      <stop offset="1" stop-color="#7dcfff"/>
    </linearGradient>
    <radialGradient id="lift" cx="0.5" cy="0" r="0.9">
      <stop offset="0" stop-color="#7aa2f7" stop-opacity="0.07"/>
      <stop offset="1" stop-color="#7aa2f7" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="1000" fill="#1a1b26"/>
  <rect width="1600" height="1000" fill="url(#lift)"/>
  <rect width="1600" height="1000" fill="url(#dots)"/>
  <g stroke="#565f89" stroke-opacity="0.12" stroke-dasharray="2 6">
    <line x1="400" y1="0" x2="400" y2="1000"/>
    <line x1="1200" y1="0" x2="1200" y2="1000"/>
  </g>
  <rect width="1600" height="2" fill="url(#accent)" opacity="0.9"/>
  <g fill="none" stroke="#7aa2f7" stroke-opacity="0.35" stroke-width="1.5">
    <path d="M24 44V24H44"/><path d="M1576 44V24H1556"/>
    <path d="M24 956V976H44"/><path d="M1576 956V976H1556"/>
  </g>
  <text x="1540" y="940" text-anchor="end" font-family="Consolas, monospace" font-size="160" font-weight="700" fill="#bb9af7" fill-opacity="0.035">&lt;/&gt;</text>
</svg>`

const short = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : `${n}`
const BAR_STYLES: BarStyle[] = ['minimal', 'labels', 'pills']
// The chosen status bar style, kept through mod reloads.
const barStyle = atom({ plugin: 'aurora-chat', key: 'barStyle' } as const, 'minimal' as BarStyle, {
  shape: 'bar-1',
})

const base = (path: string | null) =>
  path === null ? '~' : (path.split(/[\\/]/).filter(Boolean).pop() ?? path)

export const register: Register = on => {
  let startedAt = 0

  on('session.start', async ($, e, next) => {
    await $.ui.backdrop({
      id: BACKDROP,
      glass: { blur: 6, tint: 'rgb(21, 22, 30)', opacity: 0.84 },
    })
    await $.command.register({
      name: 'statusbar',
      description: 'Switch the status bar style: minimal, labels, pills',
    })
    const cwd = await $.session.cwd()
    await update($, stats, s => ({ ...s, cwd }))

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.id !== BACKDROP || e.surface !== 'desktop') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg source={BACKDROP_SVG} alt="Editor-style dotted background" />
  })

  // ---- turn statistics for the status bar ----
  // The statistics are cosmetic: a failure to record them never blocks a
  // prompt, a tool call or a turn.
  on('prompt.submit', async ($, e, next) => {
    try {
      startedAt = await $.clock.now()
    } catch {
      startedAt = 0
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    try {
      await update($, stats, s => ({ ...s, tools: s.tools + 1 }))
    } catch {
      // keep going: the count is display only
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    try {
      const seconds = startedAt ? ((await $.clock.now()) - startedAt) / 1000 : null
      const usage = result.usage
      await update($, stats, s => ({
        ...s,
        turns: s.turns + 1,
        lastSeconds: seconds,
        model: usage?.model ?? s.model,
        inTokens:
          s.inTokens + (usage ? usage.input_tokens + usage.cache_read_input_tokens : 0),
        outTokens: s.outTokens + (usage?.output_tokens ?? 0),
      }))
    } catch {
      // keep going: the statistics are display only
    }

    return result
  })

  // ---- Claude's replies: a header line, then the custom markdown renderer ----
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.isSummary) {
      return next(e)
    }
    const el = $.ui.resolve(e)
    const { Box, Text } = el
    const s = await read($, stats)

    return (
      <Box flexDirection="column" marginTop={e.props.isFirstOfReply ? 'lg' : 'xs'}>
        {e.props.isFirstOfReply ? (
          <Box flexDirection="row" gap="sm" alignItems="center">
            <Text color={C.purple} size="caption" weight="bold" mono>
              ◆ claude
            </Text>
            <Text color={C.comment} size="caption" mono>
              {s.model ? `· ${s.model}` : '· assistant'}
            </Text>
            <Text color={C.comment} size="caption" mono>
              {'─'.repeat(24)}
            </Text>
          </Box>
        ) : null}
        <Box paddingLeft="md" marginTop="sm">
          {renderMarkdown(el, e.props.text)}
        </Box>
      </Box>
    )
  })

  // ---- Your prompts: a shell-prompt header and a quiet input block ----
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.origin.kind !== 'composer') {
      return next(e)
    }
    const { Box, Markdown, Text } = $.ui.resolve(e)
    const s = await read($, stats)

    return (
      <Box flexDirection="column" marginTop="lg">
        <Box flexDirection="row" gap="sm">
          <Text color={C.green} size="caption" weight="bold" mono>
            λ you
          </Text>
          <Text color={C.blue} size="caption" mono>
            ~/{base(s.cwd)}
          </Text>
        </Box>
        <Box
          flexDirection="row"
          gap="sm"
          marginTop="xs"
          paddingX="md"
          paddingY="sm"
          backgroundColor="rgba(122, 162, 247, 0.07)"
          borderStyle="round"
          borderColor="rgba(122, 162, 247, 0.22)"
        >
          <Text color={C.green} weight="bold" mono>
            ❯
          </Text>
          <Box flexGrow={1}>
            <Markdown text={e.props.text} />
          </Box>
        </Box>
      </Box>
    )
  })

  // ---- Status bar above the prompt, in the style of a vim/powerline line ----
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.hasSurvey) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)
    const s = await read($, stats)
    const style = await read($, barStyle)
    const mode = e.props.isWorking ? 'RUNNING' : 'READY'
    const modeColor = e.props.isWorking ? C.orange : C.blue

    // [label, value, color] for each item after the mode.
    const items: [string, string, string][] = [
      ['⎇', base(s.cwd), C.purple],
      ['model', s.model ?? '—', C.cyan],
      ['turns', `${s.turns}`, C.fg],
      ['tools', `${s.tools}`, C.green],
      ['tokens', `↑${short(s.inTokens)} ↓${short(s.outTokens)}`, C.orange],
      ['last', s.lastSeconds === null ? '—' : `${s.lastSeconds.toFixed(1)}s`, C.comment],
    ]

    if (style === 'pills') {
      // The first style: square tinted segments.
      return (
        <Box flexDirection="row" gap="xs" flexWrap="wrap">
          <Box paddingX="sm" backgroundColor={modeColor}>
            <Text color={C.dark} size="caption" weight="bold" mono>
              {mode}
            </Text>
          </Box>
          {items.map(([label, value, color]) => (
            <Box paddingX="sm" backgroundColor="rgba(86, 95, 137, 0.18)">
              <Text color={color} size="caption" mono>
                {label === '⎇' ? `⎇ ${value}` : `${label} ${value}`}
              </Text>
            </Box>
          ))}
        </Box>
      )
    }

    if (style === 'labels') {
      // Dim label over a colored value, like a dashboard strip.
      return (
        <Box flexDirection="row" gap="lg" flexWrap="wrap" paddingX="xs">
          <Box flexDirection="column">
            <Text color={C.comment} size="caption" mono>
              status
            </Text>
            <Text color={modeColor} size="caption" weight="bold" mono>
              ● {mode.toLowerCase()}
            </Text>
          </Box>
          {items.map(([label, value, color]) => (
            <Box flexDirection="column">
              <Text color={C.comment} size="caption" mono>
                {label === '⎇' ? 'branch' : label}
              </Text>
              <Text color={color} size="caption" mono>
                {value}
              </Text>
            </Box>
          ))}
        </Box>
      )
    }

    // 'minimal': where you are on the left, the numbers on the right. Short
    // labels and a wide gap between the two groups, so the bar keeps to one
    // line; on a narrow window the right group drops under the left one.
    const dot = <Text color={C.rule}> · </Text>
    const lastText = s.lastSeconds === null ? '—' : `${s.lastSeconds.toFixed(1)}s`
    return (
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        columnGap="lg"
        rowGap="xs"
        paddingX="sm"
        paddingY="xs"
      >
        <Text size="caption" mono>
          <Text color={modeColor}>● </Text>
          <Text color={modeColor} weight="bold">
            {mode.toLowerCase()}
          </Text>
          {dot}
          <Text color={C.purple}>⎇ {base(s.cwd)}</Text>
          {dot}
          <Text color={C.cyan}>{s.model ?? '—'}</Text>
        </Text>
        <Text size="caption" mono>
          <Text color={C.fg}>{s.turns}</Text>
          <Text color={C.comment}> turns</Text>
          {dot}
          <Text color={C.green}>{s.tools}</Text>
          <Text color={C.comment}> tools</Text>
          {dot}
          <Text color={C.orange}>
            ↑{short(s.inTokens)} ↓{short(s.outTokens)}
          </Text>
          {dot}
          <Text color={C.comment}>⏱ {lastText}</Text>
        </Text>
      </Box>
    )
  })

  on('command.run', { command: 'statusbar' }, async $ => {
    const next = await update($, barStyle, cur => {
      const at = BAR_STYLES.indexOf(cur ?? 'minimal')
      return BAR_STYLES[(at + 1) % BAR_STYLES.length] ?? 'minimal'
    })

    return { text: `Status bar style: ${next} (run /statusbar again for the next one)` }
  })
}
