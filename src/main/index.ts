import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDataDir } from './startup'
import { registerIpcHandlers } from './ipc/index'
import { WorkflowEngine } from './engine/WorkflowEngine'
import { WorkflowStore } from './storage/WorkflowStore'
import { RunRegistry } from './runs/RunRegistry'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.flowwright')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const home = app.getPath('home')
  const flowwrightDir = join(home, '.flowwright')

  await initDataDir()

  const workflowsDir = join(flowwrightDir, 'workflows')
  const checkpointsDir = join(flowwrightDir, 'checkpoints')
  const runsDir = join(flowwrightDir, 'runs')

  const engine = new WorkflowEngine(checkpointsDir)
  const store = new WorkflowStore(workflowsDir)
  const registry = new RunRegistry(runsDir)

  createWindow()

  // registerIpcHandlers needs the window reference for emitRunEvent
  registerIpcHandlers(engine, store, registry, mainWindow!)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
