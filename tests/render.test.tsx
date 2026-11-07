import { expect, test } from 'claude-code/testing'

const SAMPLE = [
  '# Title',
  '## Section with `code`',
  '### Sub section',
  'A paragraph with **bold**, *italic*, ~~gone~~ and a [link](https://example.com).',
  '> [!TIP] Live preview',
  '> Tip body text.',
  '> A plain quote line.',
  '',
  '| Name | Count | Note |',
  '| --- | :---: | ---: |',
  '| alpha | 1 | ok |',
  '| beta | 2 | **fine** |',
  '',
  '- [x] done task',
  '- [ ] open task',
  '- bullet',
  '  - nested',
  '1. first',
  '2. second',
  '',
  '---',
  '```ts',
  'const a = 1',
  '```',
].join('\n')

test('a reply full of markdown draws on desktop without being refused', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.backdrop', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('session.cwd', () => ({ value: 'E:/CODE' }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({
    plugin: 'aurora-chat',
    component: 'AssistantMessage',
    requestId: 'msg-1',
    surface: 'desktop',
    props: { text: SAMPLE, isFirstOfReply: true },
  })

  expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Sub section/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /alpha/ })).toBeDefined()
  await ui.unmount()
})

test('the status bar draws on desktop without being refused', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.backdrop', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('session.cwd', () => ({ value: 'E:/CODE' }))
  on('command.register', () => ({ value: { command: 'statusbar' } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({
    plugin: 'aurora-chat',
    component: 'AbovePrompt',
    requestId: 'band',
    surface: 'desktop',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 4,
      bodyColumns: 80,
      scroll: { offset: 0, bodyRows: 4 },
      view: {},
    },
  })

  expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /ready/ })).toBeDefined()
  await ui.unmount()
})
