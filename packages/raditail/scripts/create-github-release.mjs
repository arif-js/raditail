import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const changelogPath = resolve(__dirname, '../CHANGELOG.md')

function getRecentTags() {
  try {
    const output = execSync('git tag -l "raditail@*" --sort=-v:refname', {
      encoding: 'utf8',
    })
    return output
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10)
  } catch (err) {
    console.error('Failed to get git tags:', err)
    return []
  }
}

function extractChangelogNotes(version) {
  try {
    const changelog = readFileSync(changelogPath, 'utf8')
    const lines = changelog.split('\n')
    let capturing = false
    const result = []
    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (line.trim() === `## ${version}`) {
          capturing = true
          continue
        } else if (capturing) {
          break
        }
      }
      if (capturing) {
        result.push(line)
      }
    }
    return result.join('\n').trim()
  } catch (err) {
    console.error(`Failed to read changelog for version ${version}:`, err)
    return ''
  }
}

function releaseExists(tag) {
  try {
    execSync(`gh release view "${tag}"`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function createRelease(tag, notes, isLatest) {
  console.log(`Creating GitHub release for ${tag}...`)
  const latestFlag = isLatest ? '--latest' : ''
  if (notes) {
    execSync(
      `gh release create "${tag}" --title "${tag}" --notes-file - ${latestFlag}`.trim(),
      {
        input: notes,
        encoding: 'utf8',
        stdio: ['pipe', 'inherit', 'inherit'],
      }
    )
  } else {
    execSync(
      `gh release create "${tag}" --title "${tag}" --generate-notes ${latestFlag}`.trim(),
      {
        stdio: 'inherit',
      }
    )
  }
}

const tags = getRecentTags()
if (tags.length === 0) {
  console.log('No raditail tags found. Nothing to release.')
  process.exit(0)
}

for (let i = 0; i < tags.length; i++) {
  const tag = tags[i]
  if (releaseExists(tag)) {
    console.log(`GitHub release for ${tag} already exists. Skipping.`)
    continue
  }

  const isLatest = i === 0
  const version = tag.includes('@') ? tag.split('@')[1] : tag.replace(/^v/, '')
  const notes = extractChangelogNotes(version)
  createRelease(tag, notes, isLatest)
}
