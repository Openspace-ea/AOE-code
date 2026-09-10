import { readdir } from 'fs/promises'
import { getCwd } from '../../../utils/cwd.js'

const PROJECT_INDICATORS = [
  'package.json',
  'Cargo.toml',
  'pyproject.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'requirements.txt',
  'Gemfile',
  'composer.json',
  '*.csproj',
]

const HINT =
  'This project may benefit from domain-specific knowledge. Use /knowledge to load best practices for the detected stack (e.g., /knowledge react, /knowledge docker, /knowledge go).'

export async function getKnowledgeHint(): Promise<string | null> {
  const cwd = getCwd()
  try {
    const entries = await readdir(cwd)
    const hasProjectFiles = entries.some(e =>
      PROJECT_INDICATORS.includes(e),
    )
    return hasProjectFiles ? HINT : null
  } catch {
    return null
  }
}
