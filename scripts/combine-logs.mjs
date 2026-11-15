// Builds AI_CHAT_HISTORY.md at the repo root from ai-logs/:
//   1. ai-logs/README.md, as is.
//   2. Every other file in ai-logs/, in file-name order, under "## Session NN - <name> (<file>)",
//      inside a ````text fence.
// Transcript content is copied byte for byte: never edited, summarised or reformatted.
//
// Run: node scripts/combine-logs.mjs

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const logsDir = join(root, 'ai-logs')
const outFile = join(root, 'AI_CHAT_HISTORY.md')
const INDEX = 'README.md'

const read = (name) => readFileSync(join(logsDir, name), 'utf8')

// Every regular file except the index and dotfiles such as .gitkeep (an empty placeholder).
// Plain code-unit comparison, so the order doesn't depend on the machine's locale.
const sessions = readdirSync(logsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name !== INDEX && !entry.name.startsWith('.'))
  .map((entry) => entry.name)
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

/** "06-search.md" → { number: "06", name: "search" }; other names get their position instead. */
function headingParts(file, index) {
  const match = /^(\d+)-(.+)\.[^.]+$/.exec(file)
  if (match) return { number: match[1], name: match[2].replaceAll('-', ' ') }
  return { number: String(index).padStart(2, '0'), name: file.replace(/\.[^.]+$/, '') }
}

/**
 * The fence is ```` (four backticks), as asked. If a transcript itself contains a run of four or
 * more backticks, the fence grows to one longer than the longest run, so the content can never
 * close it early. The content stays untouched either way.
 */
function fenceFor(content) {
  const longest = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length))
  return '`'.repeat(Math.max(4, longest + 1))
}

const parts = [read(INDEX)]

sessions.forEach((file, index) => {
  const content = read(file)
  const { number, name } = headingParts(file, index)
  const fence = fenceFor(content)
  // A newline before the closing fence only when the file lacks one: the fence needs its own line.
  const body = content.endsWith('\n') ? content : `${content}\n`
  parts.push(`## Session ${number} - ${name} (${file})\n\n${fence}text\n${body}${fence}\n`)
})

const output = parts.map((part) => (part.endsWith('\n') ? part : `${part}\n`)).join('\n')
writeFileSync(outFile, output, 'utf8')

// Guard: every source file must appear in the output exactly as it is on disk.
for (const file of [INDEX, ...sessions]) {
  if (!output.includes(read(file))) {
    console.error(`combine-logs: ${file} was not copied verbatim`)
    process.exit(1)
  }
}

console.log(`Wrote ${outFile}: ${INDEX} + ${sessions.length} sessions (${sessions.join(', ')})`)
