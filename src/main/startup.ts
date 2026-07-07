import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync, writeFileSync } from 'fs'

const DATA_DIR = join(app.getPath('home'), '.flowwright')

const DEFAULT_CONFIG = {
  mcpServers: {},
  providers: {},
  defaultProvider: 'deepseek',
  defaultModel: 'deepseek-v4-flash',
}

export async function initDataDir(): Promise<void> {
  const dirs = [
    DATA_DIR,
    join(DATA_DIR, 'skills'),
    join(DATA_DIR, 'workflows'),
    join(DATA_DIR, 'schemas'),
    join(DATA_DIR, 'runs'),
    join(DATA_DIR, 'checkpoints'),
    join(DATA_DIR, 'rag', 'lancedb'),
    join(DATA_DIR, 'rag', 'sources'),
  ]
  for (const dir of dirs) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  const configPath = join(DATA_DIR, 'config.json')
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8')
  }

  console.log('[startup] Data dir initialized:', DATA_DIR)
}
