export type Stats = {
  turns: number
  tools: number
  lastSeconds: number | null
  model: string | null
  inTokens: number
  outTokens: number
  cwd: string | null
}

export type BarStyle = 'minimal' | 'labels' | 'pills'

declare module 'claude-code' {
  interface PluginState {
    'aurora-chat': { stats: Shaped<Stats>; barStyle: Shaped<BarStyle> }
  }
}
