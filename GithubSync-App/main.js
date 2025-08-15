const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const simpleGit = require('simple-git');

// Keep a reference to the main window
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('src/index.html');
  // win.webContents.openDevTools(); // Uncomment for debugging
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- IPC Handlers ---

icpMain.handle('dialog:selectBaseDir', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (canceled) return null;
  return filePaths[0];
});

async function getDirStatus(dirPath) {
    const git = simpleGit(dirPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
        return { isRepo: false, hasRemote: false, hasChanges: false };
    }
    const remotes = await git.getRemotes(true);
    const status = await git.status();
    const hasChanges = status.files.length > 0 || status.staged.length > 0 || status.conflicted.length > 0 || status.created.length > 0 || status.deleted.length > 0 || status.modified.length > 0 || status.renamed.length > 0;
    return {
        isRepo: true,
        hasRemote: remotes.length > 0,
        hasChanges: hasChanges,
    };
}

icpMain.handle('scan', async (event, baseDir) => {
  if (!baseDir || !existsSync(baseDir)) {
    return { error: 'La carpeta base no existeix.', items: [], baseDir };
  }
  try {
    const dirents = await fs.readdir(baseDir, { withFileTypes: true });
    const subdirs = dirents.filter(d => d.isDirectory());
    const items = await Promise.all(
      subdirs.map(async (dir) => {
        const dirPath = path.join(baseDir, dir.name);
        const status = await getDirStatus(dirPath);
        return { name: dir.name, ...status };
      })
    );
    return { items, baseDir };
  } catch (error) {
    console.error('Error during scan:', error);
    return { error: error.message, items: [], baseDir };
  }
});

async function buildFileTree(dirPath) {
    const stats = await fs.stat(dirPath);
    const name = path.basename(dirPath);
    if (stats.isFile()) {
        return { name, type: 'file' };
    }
    if (stats.isDirectory()) {
        const children = await fs.readdir(dirPath);
        return {
            name,
            type: 'dir',
            children: await Promise.all(children.map(child => buildFileTree(path.join(dirPath, child)))),
        };
    }
    return null;
}

icpMain.handle('tree', async (event, baseDir) => {
    if (!baseDir || !existsSync(baseDir)) {
        return { error: 'La carpeta no existeix.' };
    }
    try {
        return await buildFileTree(baseDir);
    } catch (error) {
        console.error('Error building file tree:', error);
        return { error: error.message };
    }
});

ipcMain.handle('sync', async (event, payload) => {
    const { baseDir, names, options } = payload;
    const { owner, visibility } = options;

    if (!owner) {
        return names.map(name => ({ name, status: 'error', error: 'El nom d\'usuari de GitHub és obligatori.' }));
    }

    const results = [];

    for (const name of names) {
        const dirPath = path.join(baseDir, name);
        try {
            const git = simpleGit(dirPath);
            const isRepo = await git.checkIsRepo();

            if (!isRepo) {
                await git.init();
            }

            const remotes = await git.getRemotes();
            let hasOrigin = remotes.some(r => r.name === 'origin');

            if (!hasOrigin) {
                const remoteUrl = `https://github.com/${owner}/${name}.git`;
                await git.addRemote('origin', remoteUrl);
            }
            
            await git.add('./*');
            const status = await git.status();

            if (status.files.length > 0) {
                await git.commit('Sincronització des de l\'aplicació');
                await git.push(['-u', 'origin', 'HEAD:main']).catch(async (err) => {
                    if (err.message.includes('src refspec main does not match any')) {
                        console.log(`Push to main failed for ${name}, trying master...`);
                        await git.push(['-u', 'origin', 'HEAD:master']);
                    } else {
                        throw err;
                    }
                });
                results.push({ name, status: 'pushed' });
            } else {
                results.push({ name, status: 'up-to-date' });
            }

        } catch (error) {
            console.error(`Error en sincronitzar ${name}:`, error);
            results.push({ name, status: 'error', error: error.message });
        }
    }
    return results;
});
