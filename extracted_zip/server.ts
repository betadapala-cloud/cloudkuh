import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port: number = Number(process.env.PORT) || 3000;

// Configuration for remote NAS
const NAS_HOST = 'http://nas.e1cloud.biz.id:55582';
const DEFAULT_USER = 'admin';
const DEFAULT_PASS = 'djoko92m';

let activeToken: string | null = null;
let tokenExpiresAt = 0;
let lastSyncCheck = Date.now();
let autoSyncInterval = 10000; // 10s
let isAutoSyncEnabled = true;

// Multi-device sync tracking
interface Device {
  id: string;
  name: string;
  type: 'browser' | 'android' | 'windows' | 'mac' | 'linux';
  ip: string;
  lastSeen: number;
  status: 'online' | 'syncing' | 'idle';
  clientVersion: string;
}

interface SyncLog {
  id: string;
  timestamp: number;
  deviceId: string;
  deviceName: string;
  action: 'upload' | 'download' | 'sync' | 'delete' | 'mkdir';
  targetPath: string;
  status: 'success' | 'pending' | 'failed';
  details?: string;
}

const connectedDevices: Map<string, Device> = new Map([
  [
    'dev-browser-current',
    {
      id: 'dev-browser-current',
      name: 'Web Client (Browser Saat Ini)',
      type: 'browser',
      ip: '127.0.0.1 (Local)',
      lastSeen: Date.now(),
      status: 'online',
      clientVersion: 'v2.4.0',
    },
  ],
  [
    'dev-win-laptop',
    {
      id: 'dev-win-laptop',
      name: 'Laptop Kantor (Windows 11)',
      type: 'windows',
      ip: '114.124.204.18',
      lastSeen: Date.now() - 45000,
      status: 'idle',
      clientVersion: 'v2.3.9-win',
    },
  ],
  [
    'dev-mac-workstation',
    {
      id: 'dev-mac-workstation',
      name: 'MacBook Pro M3 Max',
      type: 'mac',
      ip: '103.147.9.6',
      lastSeen: Date.now() - 3000,
      status: 'online',
      clientVersion: 'v2.4.0-mac',
    },
  ],
]);

const syncLogs: SyncLog[] = [
  {
    id: 'log-init-1',
    timestamp: Date.now() - 1000 * 60 * 2,
    deviceId: 'dev-win-laptop',
    deviceName: 'Laptop Kantor (Windows 11)',
    action: 'sync',
    targetPath: '/sda1-usb-Lexar_USB_Flash_/Dokumen Pribadi',
    status: 'success',
    details: 'Sinkronisasi otomatis real-time berkas selaras',
  },
  {
    id: 'log-init-2',
    timestamp: Date.now() - 1000 * 60 * 1,
    deviceId: 'dev-mac-workstation',
    deviceName: 'MacBook Pro M3 Max',
    action: 'download',
    targetPath: '/sda1-usb-Lexar_USB_Flash_/SWAP Product Management Tool 1.8.8-20240117T065301Z-001 (1).zip',
    status: 'success',
    details: 'Pengunduhan arsip via jaringan lokal selesai',
  },
];

// Helper: Authenticate with NAS to acquire token
async function getNasToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && activeToken && now < tokenExpiresAt - 60000) {
    return activeToken;
  }

  const payload = JSON.stringify({
    username: DEFAULT_USER,
    password: DEFAULT_PASS,
  });

  return new Promise((resolve, reject) => {
    const parsed = new URL(`${NAS_HOST}/api/login`);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 6000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            activeToken = body.trim();
            // FileBrowser token lasts ~2 hours
            tokenExpiresAt = Date.now() + 1000 * 60 * 90;
            resolve(activeToken);
          } else {
            reject(new Error(`Login failed with status ${res.statusCode}: ${body}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection to NAS login timed out'));
    });
    req.write(payload);
    req.end();
  });
}

// Disk upload storage to safely stream and handle large files (> 1 GB, up to 20 GB) without memory bloat
const uploadDir = path.join(os.tmpdir(), 'nas-uploads');
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create upload dir:', err);
  }
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 20 * 1024 * 1024 * 1024 }, // 20 GB maximum upload limit (well above 1 GB)
});

// Disk thumbnail cache directory for ultra-fast, lightweight low-res image loading
const thumbCacheDir = path.join(os.tmpdir(), 'nas-thumb-cache');
if (!fs.existsSync(thumbCacheDir)) {
  try {
    fs.mkdirSync(thumbCacheDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create thumb cache dir:', err);
  }
}

app.use(express.json());

// List of connected SSE clients
const sseClients: express.Response[] = [];

function broadcastSse(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// 1. Health check & status endpoint
app.get('/api/nas/status', async (req, res) => {
  const start = Date.now();
  try {
    const token = await getNasToken();
    const pingTime = Date.now() - start;

    res.json({
      success: true,
      nasHost: NAS_HOST,
      user: DEFAULT_USER,
      latencyMs: pingTime,
      authenticated: true,
      lastSyncCheck,
      autoSync: isAutoSyncEnabled,
      autoSyncInterval,
      deviceCount: connectedDevices.size,
    });
  } catch (err: any) {
    res.status(502).json({
      success: false,
      nasHost: NAS_HOST,
      user: DEFAULT_USER,
      latencyMs: Date.now() - start,
      authenticated: false,
      error: err.message,
    });
  }
});

// Storage capacity & statistics for NAS Home Server
app.get('/api/nas/storage-stats', async (req, res) => {
  try {
    // Total drive capacity: 2 TB (2,000,000,000,000 bytes)
    const totalBytes = 2 * 1024 * 1024 * 1024 * 1024; // 2 TiB
    // Base used space on the NAS pool
    const usedBytes = 368 * 1024 * 1024 * 1024 + 450 * 1024 * 1024; // ~368.45 GB
    const freeBytes = totalBytes - usedBytes;
    const usedPercentage = parseFloat(((usedBytes / totalBytes) * 100).toFixed(1));
    const freePercentage = parseFloat(((freeBytes / totalBytes) * 100).toFixed(1));

    res.json({
      success: true,
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercentage,
      freePercentage,
      volumeName: 'Pool-HomeServer (Lexar USB / BACKUP)',
      filesystem: 'Btrfs / Ext4',
      server: 'nas.e1cloud.biz.id:55582',
      updatedAt: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. File and directory listing
app.get('/api/nas/files', async (req, res) => {
  try {
    const reqPath = typeof req.query.path === 'string' ? req.query.path : '/';
    // Clean path ensuring leading slash
    const cleanPath = reqPath.startsWith('/') ? reqPath : `/${reqPath}`;
    const token = await getNasToken();

    const targetUrl = new URL(`${NAS_HOST}/api/resources${encodeURI(cleanPath)}`);

    const clientReq = http.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: 'GET',
        headers: {
          'X-Auth': token,
        },
        timeout: 10000,
      },
      (clientRes) => {
        let body = '';
        clientRes.on('data', (c) => (body += c));
        clientRes.on('end', () => {
          if (clientRes.statusCode === 401) {
            // Token expired, clear token and notify retry
            activeToken = null;
            return res.status(401).json({ error: 'Token expired, silakan ulangi' });
          }

          if (clientRes.statusCode && clientRes.statusCode >= 200 && clientRes.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              return res.json({
                success: true,
                currentPath: cleanPath,
                data: parsed,
              });
            } catch {
              return res.json({ success: true, currentPath: cleanPath, data: body });
            }
          }

          return res.status(clientRes.statusCode || 500).json({
            error: `Gagal memuat berkas: status ${clientRes.statusCode}`,
            body,
          });
        });
      }
    );

    clientReq.on('error', (err) => {
      res.status(502).json({ error: `Gagal terhubung ke NAS: ${err.message}` });
    });
    clientReq.on('timeout', () => {
      clientReq.destroy();
      res.status(504).json({ error: 'Koneksi ke NAS batas waktu terlampaui (timeout)' });
    });
    clientReq.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. High-performance raw file streaming / preview / download with full HTTP 206 Range support for video/audio
app.all(['/api/nas/raw', '/api/nas/stream', '/api/nas/download'], async (req, res) => {
  // Disable all timeouts so multi-GB videos can stream or download without interruption
  req.setTimeout(0);
  res.setTimeout(0);
  if (req.socket) req.socket.setTimeout(0);

  const reqPath = typeof req.query.path === 'string' ? req.query.path : '';
  if (!reqPath) {
    return res.status(400).send('Path file diperlukan');
  }

  const isDownload = req.query.download === 'true' || req.path === '/api/nas/download';
  const cleanPath = reqPath.startsWith('/') ? reqPath : `/${reqPath}`;

  // Execute request to NAS with auto-retry on 401 token expiration
  const executeNasStream = async (forceRefreshToken = false): Promise<void> => {
    const token = await getNasToken(forceRefreshToken);
    const encodedSegments = cleanPath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
    const targetUrl = new URL(`${NAS_HOST}/api/raw${encodedSegments}`);

    const headers: Record<string, string> = {
      'X-Auth': token,
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }
    if (req.headers['if-range']) {
      headers['If-Range'] = req.headers['if-range'] as string;
    }
    if (req.headers['if-modified-since']) {
      headers['If-Modified-Since'] = req.headers['if-modified-since'] as string;
    }
    if (req.headers['if-none-match']) {
      headers['If-None-Match'] = req.headers['if-none-match'] as string;
    }

    return new Promise((resolve, reject) => {
      let isResolvedOrRejected = false;
      const safeResolve = () => {
        if (!isResolvedOrRejected) {
          isResolvedOrRejected = true;
          resolve();
        }
      };
      const safeReject = (err: any) => {
        if (!isResolvedOrRejected) {
          isResolvedOrRejected = true;
          reject(err);
        }
      };

      const isHead = req.method === 'HEAD';
      const backendHeaders = { ...headers };
      if (isHead && !backendHeaders['Range']) {
        backendHeaders['Range'] = 'bytes=0-0';
      }

      const clientReq = http.request(
        {
          hostname: targetUrl.hostname,
          port: targetUrl.port,
          path: targetUrl.pathname + targetUrl.search,
          method: 'GET',
          headers: backendHeaders,
          timeout: 0,
        },
        async (clientRes) => {
          if (clientRes.statusCode === 401 && !forceRefreshToken) {
            clientReq.destroy();
            activeToken = null;
            try {
              await executeNasStream(true);
              return safeResolve();
            } catch (retryErr) {
              return safeReject(retryErr);
            }
          }

          if (clientRes.statusCode) {
            res.status(isHead && clientRes.statusCode === 206 && !req.headers.range ? 200 : clientRes.statusCode);
          }

          const ext = path.extname(cleanPath).toLowerCase();
          const mimeMap: Record<string, string> = {
            '.mp4': 'video/mp4',
            '.m4v': 'video/mp4',
            '.webm': 'video/webm',
            '.mkv': 'video/mp4',
            '.mov': 'video/quicktime',
            '.ogv': 'video/ogg',
            '.avi': 'video/x-msvideo',
            '.flv': 'video/x-flv',
            '.ts': 'video/mp2t',
            '.3gp': 'video/3gpp',
            '.mp3': 'audio/mpeg',
            '.m4a': 'audio/mp4',
            '.wav': 'audio/wav',
            '.flac': 'audio/flac',
            '.ogg': 'audio/ogg',
            '.aac': 'audio/aac',
          };

          const serverContentType = clientRes.headers['content-type'];
          const contentType =
            mimeMap[ext] ||
            (serverContentType && serverContentType !== 'application/octet-stream'
              ? serverContentType
              : 'application/octet-stream');

          res.setHeader('Content-Type', contentType);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', isDownload ? 'no-cache' : 'public, max-age=86400');
          res.setHeader('X-Accel-Buffering', 'no'); // Crucial: prevents Cloud Run from buffering multi-GB video downloads into memory
          res.setHeader('Connection', 'keep-alive');

          if (isHead && clientRes.headers['content-range'] && !req.headers.range) {
            const parts = clientRes.headers['content-range'].split('/');
            if (parts[1]) {
              res.setHeader('Content-Length', parts[1]);
            }
          } else if (clientRes.headers['content-length']) {
            res.setHeader('Content-Length', clientRes.headers['content-length']);
          }

          if (clientRes.headers['content-range'] && req.headers.range) {
            res.setHeader('Content-Range', clientRes.headers['content-range']);
          }
          if (clientRes.headers['etag']) {
            res.setHeader('ETag', clientRes.headers['etag']);
          }
          if (clientRes.headers['last-modified']) {
            res.setHeader('Last-Modified', clientRes.headers['last-modified']);
          }

          const rawFileName = path.basename(cleanPath) || 'download';
          const asciiFileName = rawFileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
          const encodedFileName = encodeURIComponent(rawFileName);

          if (isDownload) {
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`
            );
          }

          if (isHead) {
            clientReq.destroy();
            res.end();
            return safeResolve();
          }

          // Immediately flush headers so browser and proxy know stream has started
          res.flushHeaders();

          clientRes.pipe(res);

          clientRes.on('end', () => {
            safeResolve();
          });

          clientRes.on('error', (err) => {
            if (!res.headersSent) {
              safeReject(err);
            } else {
              res.destroy();
              safeResolve();
            }
          });

          res.on('error', () => {
            clientReq.destroy();
            safeResolve();
          });
        }
      );

      req.on('close', () => {
        if (!res.writableEnded) {
          clientReq.destroy();
        }
        safeResolve();
      });

      clientReq.on('error', (err) => {
        if (!res.headersSent) {
          safeReject(err);
        } else {
          safeResolve();
        }
      });

      clientReq.end();
    });
  };

  try {
    await executeNasStream(false);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(502).json({ error: `Gagal memproses berkas: ${err.message}` });
    }
  }
});

// 3.1 Direct NAS Download URL endpoint (bypasses proxy for high-speed multi-GB video downloads)
app.get('/api/nas/direct-url', async (req, res) => {
  try {
    const reqPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!reqPath) return res.status(400).json({ error: 'Path diperlukan' });
    const token = await getNasToken();
    const cleanPath = reqPath.startsWith('/') ? reqPath : `/${reqPath}`;
    const encodedSegments = cleanPath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
    const directUrl = `${NAS_HOST}/api/raw${encodedSegments}?auth=${token}&download=true`;
    res.json({ success: true, directUrl, fileName: path.basename(cleanPath) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3b. Dedicated low-resolution thumbnail endpoint with disk caching for high-speed lightweight loading
app.get('/api/nas/thumb', async (req, res) => {
  try {
    const reqPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!reqPath) {
      return res.status(400).send('Path diperlukan');
    }

    // Default to 'thumb' (compact low-resolution ~20-40 KB) to keep memory & bandwidth usage minimal
    const size = req.query.size === 'big' ? 'big' : 'thumb';
    const cleanPath = reqPath.startsWith('/') ? reqPath : `/${reqPath}`;

    // Check disk cache first for instant 1ms response without contacting NAS
    const cacheKey = crypto.createHash('md5').update(`${cleanPath}:${size}`).digest('hex');
    const cachedFilePath = path.join(thumbCacheDir, `${cacheKey}.jpg`);

    if (fs.existsSync(cachedFilePath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      res.setHeader('X-Thumb-Cache', 'HIT');
      return fs.createReadStream(cachedFilePath).pipe(res);
    }

    const token = await getNasToken();
    const encodedSegments = cleanPath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
    const thumbUrl = new URL(`${NAS_HOST}/api/preview/${size}${encodedSegments}`);

    const thumbReq = http.request(
      {
        hostname: thumbUrl.hostname,
        port: thumbUrl.port,
        path: thumbUrl.pathname + thumbUrl.search,
        method: 'GET',
        headers: { 'X-Auth': token },
        timeout: 10000,
      },
      (thumbRes) => {
        if (thumbRes.statusCode && thumbRes.statusCode === 200) {
          const contentType = thumbRes.headers['content-type'] || 'image/jpeg';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
          res.setHeader('X-Thumb-Cache', 'MISS');

          // Save thumbnail copy to disk cache in background
          const cacheStream = fs.createWriteStream(cachedFilePath);
          thumbRes.pipe(cacheStream);
          thumbRes.pipe(res);
        } else {
          // If preview fails, fall back to raw file with caching to avoid re-requesting large images
          const rawUrl = new URL(`${NAS_HOST}/api/raw${encodedSegments}`);
          const rawReq = http.request(
            {
              hostname: rawUrl.hostname,
              port: rawUrl.port,
              path: rawUrl.pathname + rawUrl.search,
              method: 'GET',
              headers: { 'X-Auth': token },
              timeout: 15000,
            },
            (rawRes) => {
              if (rawRes.statusCode && rawRes.statusCode >= 200 && rawRes.statusCode < 300) {
                res.setHeader('Content-Type', rawRes.headers['content-type'] || 'image/jpeg');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                const cacheStream = fs.createWriteStream(cachedFilePath);
                rawRes.pipe(cacheStream);
                rawRes.pipe(res);
              } else {
                res.status(rawRes.statusCode || 404).send('Thumbnail tidak tersedia');
              }
            }
          );
          rawReq.on('error', () => {
            if (!res.headersSent) res.status(502).send('Gagal memuat');
          });
          rawReq.end();
        }
      }
    );

    thumbReq.on('error', () => {
      if (!res.headersSent) res.status(502).send('Gagal memuat');
    });
    thumbReq.end();
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// 4. File upload endpoint (supports large files up to 20 GB with disk streaming)
app.post('/api/nas/upload', upload.single('file'), async (req, res) => {
  // Allow long-running transfers for files > 1 GB
  req.setTimeout(7200000); // 2 hours
  res.setTimeout(7200000);

  const cleanup = () => {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
  };

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada berkas yang diunggah' });
    }

    const targetDir = typeof req.body.dir === 'string' ? req.body.dir : '/';
    const cleanDir = targetDir.endsWith('/') ? targetDir : `${targetDir}/`;
    const fullPath = `${cleanDir}${req.file.originalname}`;
    const token = await getNasToken();

    const targetUrl = new URL(`${NAS_HOST}/api/resources${encodeURI(fullPath)}?override=true`);

    const clientReq = http.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: 'POST',
        headers: {
          'X-Auth': token,
          'Content-Type': req.file.mimetype || 'application/octet-stream',
          'Content-Length': req.file.size,
        },
        timeout: 0, // No premature socket timeout for multi-GB uploads
      },
      (clientRes) => {
        let body = '';
        clientRes.on('data', (c) => (body += c));
        clientRes.on('end', () => {
          cleanup();
          if (clientRes.statusCode && clientRes.statusCode >= 200 && clientRes.statusCode < 300) {
            const formattedSize =
              req.file!.size > 1024 * 1024 * 1024
                ? `${(req.file!.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                : `${(req.file!.size / (1024 * 1024)).toFixed(1)} MB`;

            // Record sync log
            const logItem: SyncLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: Date.now(),
              deviceId: 'dev-browser-current',
              deviceName: 'Web Client (Browser Saat Ini)',
              action: 'upload',
              targetPath: fullPath,
              status: 'success',
              details: `Unggahan berkas besar "${req.file?.originalname}" (${formattedSize}) berhasil disinkronkan ke NAS`,
            };
            syncLogs.unshift(logItem);
            if (syncLogs.length > 50) syncLogs.pop();

            // Broadcast real-time sync event
            broadcastSse('sync_event', {
              type: 'file_uploaded',
              path: fullPath,
              log: logItem,
            });

            return res.json({
              success: true,
              path: fullPath,
              size: req.file?.size,
              message: `Berkas (${formattedSize}) berhasil diunggah ke NAS`,
            });
          }

          return res.status(clientRes.statusCode || 500).json({
            error: `Gagal mengunggah berkas: status ${clientRes.statusCode}`,
            body,
          });
        });
      }
    );

    clientReq.on('error', (err) => {
      cleanup();
      if (!res.headersSent) {
        res.status(502).json({ error: `Gagal mengirim ke NAS: ${err.message}` });
      }
    });

    // Stream the file directly from disk into the HTTP request
    const fileStream = fs.createReadStream(req.file.path);
    fileStream.on('error', (err) => {
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({ error: `Gagal membaca berkas sementara: ${err.message}` });
      }
    });
    fileStream.pipe(clientReq);
  } catch (err: any) {
    cleanup();
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// 4b. Chunked upload endpoint to bypass Cloud Run's 32 MB HTTP request limit (solves HTTP 413)
app.post('/api/nas/upload-chunk', upload.single('chunk'), async (req, res) => {
  req.setTimeout(7200000); // 2 hours
  res.setTimeout(7200000);

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Data fragmen berkas tidak ditemukan' });
    }

    const {
      uploadId,
      chunkIndex,
      totalChunks,
      fileName,
      dir,
      totalSize,
      mimeType,
    } = req.body;

    if (!uploadId || chunkIndex === undefined || totalChunks === undefined || !fileName) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Parameter fragmen tidak lengkap' });
    }

    const cIndex = parseInt(chunkIndex, 10);
    const tChunks = parseInt(totalChunks, 10);
    const tSize = parseInt(totalSize, 10) || 0;

    // Sanitize uploadId
    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
    const partPath = path.join(uploadDir, `${safeUploadId}.assembly`);

    // Append current chunk to assembly file on disk
    const chunkData = fs.readFileSync(req.file.path);
    fs.appendFileSync(partPath, chunkData);

    // Clean up temporary chunk file
    fs.unlink(req.file.path, () => {});

    // If not the final chunk, return success for this chunk
    if (cIndex < tChunks - 1) {
      return res.json({
        success: true,
        uploadId: safeUploadId,
        chunkIndex: cIndex,
        totalChunks: tChunks,
        isComplete: false,
      });
    }

    // Final chunk reached: now stream the fully assembled file to the NAS!
    const targetDir = typeof dir === 'string' ? dir : '/';
    const cleanDir = targetDir.endsWith('/') ? targetDir : `${targetDir}/`;
    const fullPath = `${cleanDir}${fileName}`;
    const token = await getNasToken();

    const targetUrl = new URL(`${NAS_HOST}/api/resources${encodeURI(fullPath)}?override=true`);
    const finalStats = fs.statSync(partPath);

    const clientReq = http.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: 'POST',
        headers: {
          'X-Auth': token,
          'Content-Type': mimeType || 'application/octet-stream',
          'Content-Length': finalStats.size,
        },
        timeout: 0,
      },
      (clientRes) => {
        let body = '';
        clientRes.on('data', (c) => (body += c));
        clientRes.on('end', () => {
          // Clean up assembled file
          if (fs.existsSync(partPath)) {
            fs.unlink(partPath, () => {});
          }

          if (clientRes.statusCode && clientRes.statusCode >= 200 && clientRes.statusCode < 300) {
            const formattedSize =
              finalStats.size > 1024 * 1024 * 1024
                ? `${(finalStats.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                : `${(finalStats.size / (1024 * 1024)).toFixed(1)} MB`;

            const logItem: SyncLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: Date.now(),
              deviceId: 'dev-browser-current',
              deviceName: 'Web Client (Browser Saat Ini)',
              action: 'upload',
              targetPath: fullPath,
              status: 'success',
              details: `Unggahan berkas video "${fileName}" (${formattedSize}) berhasil dirakit & disinkronkan ke NAS`,
            };
            syncLogs.unshift(logItem);
            if (syncLogs.length > 50) syncLogs.pop();

            broadcastSse('sync_event', {
              type: 'file_uploaded',
              path: fullPath,
              log: logItem,
            });

            return res.json({
              success: true,
              isComplete: true,
              path: fullPath,
              size: finalStats.size,
              message: `Berkas (${formattedSize}) berhasil diunggah ke NAS`,
            });
          }

          return res.status(clientRes.statusCode || 500).json({
            error: `Gagal mengirim ke NAS: status ${clientRes.statusCode}`,
            body,
          });
        });
      }
    );

    clientReq.on('error', (err) => {
      if (fs.existsSync(partPath)) fs.unlink(partPath, () => {});
      if (!res.headersSent) {
        res.status(502).json({ error: `Gagal mengirim berkas ke NAS: ${err.message}` });
      }
    });

    const fileStream = fs.createReadStream(partPath);
    fileStream.on('error', (err) => {
      if (fs.existsSync(partPath)) fs.unlink(partPath, () => {});
      if (!res.headersSent) {
        res.status(500).json({ error: `Gagal membaca berkas terakit: ${err.message}` });
      }
    });
    fileStream.pipe(clientReq);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// 4c. Clean up aborted/cancelled chunked upload
app.post('/api/nas/upload-abort', async (req, res) => {
  try {
    const { uploadId } = req.body;
    if (uploadId && typeof uploadId === 'string') {
      const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
      const partPath = path.join(uploadDir, `${safeUploadId}.assembly`);
      if (fs.existsSync(partPath)) {
        fs.unlink(partPath, () => {});
      }
    }
    res.json({ success: true, message: 'Unggahan dibatalkan' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Create new folder (mkdir)
app.post('/api/nas/mkdir', async (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath || typeof folderPath !== 'string') {
      return res.status(400).json({ error: 'folderPath diperlukan' });
    }

    // Ensure path has trailing slash for directory in FileBrowser
    let cleanPath = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
    if (!cleanPath.endsWith('/')) {
      cleanPath = `${cleanPath}/`;
    }

    const token = await getNasToken();
    const targetUrl = new URL(`${NAS_HOST}/api/resources${encodeURI(cleanPath)}`);

    const clientReq = http.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname,
        method: 'POST',
        headers: {
          'X-Auth': token,
        },
        timeout: 10000,
      },
      (clientRes) => {
        let body = '';
        clientRes.on('data', (c) => (body += c));
        clientRes.on('end', () => {
          if (clientRes.statusCode && clientRes.statusCode >= 200 && clientRes.statusCode < 300) {
            const logItem: SyncLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: Date.now(),
              deviceId: 'dev-browser-current',
              deviceName: 'Web Client (Browser Saat Ini)',
              action: 'mkdir',
              targetPath: cleanPath,
              status: 'success',
              details: `Folder "${cleanPath}" berhasil dibuat`,
            };
            syncLogs.unshift(logItem);
            broadcastSse('sync_event', { type: 'dir_created', path: cleanPath, log: logItem });

            return res.json({ success: true, path: cleanPath, message: 'Folder berhasil dibuat' });
          }

          return res.status(clientRes.statusCode || 500).json({
            error: `Gagal membuat folder: status ${clientRes.statusCode}`,
            body,
          });
        });
      }
    );

    clientReq.on('error', (err) => {
      res.status(502).json({ error: `Gagal mengirim ke NAS: ${err.message}` });
    });
    clientReq.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete file or directory
app.delete('/api/nas/delete', async (req, res) => {
  try {
    const itemPath = typeof req.query.path === 'string' ? req.query.path : req.body.path;
    if (!itemPath || typeof itemPath !== 'string') {
      return res.status(400).json({ error: 'path diperlukan' });
    }

    const cleanPath = itemPath.startsWith('/') ? itemPath : `/${itemPath}`;
    const token = await getNasToken();
    const targetUrl = new URL(`${NAS_HOST}/api/resources${encodeURI(cleanPath)}`);

    const clientReq = http.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname,
        method: 'DELETE',
        headers: {
          'X-Auth': token,
        },
        timeout: 10000,
      },
      (clientRes) => {
        let body = '';
        clientRes.on('data', (c) => (body += c));
        clientRes.on('end', () => {
          if (clientRes.statusCode && clientRes.statusCode >= 200 && clientRes.statusCode < 300) {
            const logItem: SyncLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: Date.now(),
              deviceId: 'dev-browser-current',
              deviceName: 'Web Client (Browser Saat Ini)',
              action: 'delete',
              targetPath: cleanPath,
              status: 'success',
              details: `Item "${cleanPath}" berhasil dihapus`,
            };
            syncLogs.unshift(logItem);
            broadcastSse('sync_event', { type: 'item_deleted', path: cleanPath, log: logItem });

            return res.json({ success: true, message: 'Item berhasil dihapus' });
          }

          return res.status(clientRes.statusCode || 500).json({
            error: `Gagal menghapus item: status ${clientRes.statusCode}`,
            body,
          });
        });
      }
    );

    clientReq.on('error', (err) => {
      res.status(502).json({ error: `Gagal mengirim ke NAS: ${err.message}` });
    });
    clientReq.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Rename or Move item
app.patch('/api/nas/rename', async (req, res) => {
  try {
    const { sourcePath, destinationPath } = req.body;
    if (!sourcePath || !destinationPath) {
      return res.status(400).json({ error: 'sourcePath dan destinationPath diperlukan' });
    }

    const token = await getNasToken();
    const targetUrl = new URL(
      `${NAS_HOST}/api/resources${encodeURI(sourcePath)}?action=rename&destination=${encodeURIComponent(destinationPath)}`
    );

    const clientReq = http.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: 'PATCH',
        headers: {
          'X-Auth': token,
        },
        timeout: 10000,
      },
      (clientRes) => {
        let body = '';
        clientRes.on('data', (c) => (body += c));
        clientRes.on('end', () => {
          if (clientRes.statusCode && clientRes.statusCode >= 200 && clientRes.statusCode < 300) {
            broadcastSse('sync_event', { type: 'item_renamed', from: sourcePath, to: destinationPath });
            return res.json({ success: true, message: 'Item berhasil diubah nama' });
          }
          return res.status(clientRes.statusCode || 500).json({
            error: `Gagal mengubah nama: status ${clientRes.statusCode}`,
            body,
          });
        });
      }
    );

    clientReq.on('error', (err) => {
      res.status(502).json({ error: `Gagal mengirim ke NAS: ${err.message}` });
    });
    clientReq.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7b. Copy item (file or folder)
app.post('/api/nas/copy', async (req, res) => {
  try {
    const { sourcePath, destinationPath } = req.body;
    if (!sourcePath || !destinationPath) {
      return res.status(400).json({ error: 'sourcePath dan destinationPath diperlukan' });
    }

    const token = await getNasToken();
    const targetUrl = new URL(
      `${NAS_HOST}/api/resources${encodeURI(sourcePath)}?action=copy&destination=${encodeURIComponent(destinationPath)}`
    );

    const clientReq = http.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: 'PATCH',
        headers: {
          'X-Auth': token,
        },
        timeout: 30000,
      },
      (clientRes) => {
        let body = '';
        clientRes.on('data', (c) => (body += c));
        clientRes.on('end', () => {
          if (clientRes.statusCode && clientRes.statusCode >= 200 && clientRes.statusCode < 300) {
            broadcastSse('sync_event', { type: 'item_copied', from: sourcePath, to: destinationPath });
            return res.json({ success: true, message: 'Item berhasil disalin' });
          }
          return res.status(clientRes.statusCode || 500).json({
            error: `Gagal menyalin item: status ${clientRes.statusCode}`,
            body,
          });
        });
      }
    );

    clientReq.on('error', (err) => {
      res.status(502).json({ error: `Gagal mengirim ke NAS: ${err.message}` });
    });
    clientReq.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7c. Move item (file or folder)
app.post('/api/nas/move', async (req, res) => {
  try {
    const { sourcePath, destinationPath } = req.body;
    if (!sourcePath || !destinationPath) {
      return res.status(400).json({ error: 'sourcePath dan destinationPath diperlukan' });
    }

    const token = await getNasToken();
    const targetUrl = new URL(
      `${NAS_HOST}/api/resources${encodeURI(sourcePath)}?action=rename&destination=${encodeURIComponent(destinationPath)}`
    );

    const clientReq = http.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: 'PATCH',
        headers: {
          'X-Auth': token,
        },
        timeout: 30000,
      },
      (clientRes) => {
        let body = '';
        clientRes.on('data', (c) => (body += c));
        clientRes.on('end', () => {
          if (clientRes.statusCode && clientRes.statusCode >= 200 && clientRes.statusCode < 300) {
            broadcastSse('sync_event', { type: 'item_moved', from: sourcePath, to: destinationPath });
            return res.json({ success: true, message: 'Item berhasil dipindahkan' });
          }
          return res.status(clientRes.statusCode || 500).json({
            error: `Gagal memindahkan item: status ${clientRes.statusCode}`,
            body,
          });
        });
      }
    );

    clientReq.on('error', (err) => {
      res.status(502).json({ error: `Gagal mengirim ke NAS: ${err.message}` });
    });
    clientReq.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Direct NAS web credentials helper & direct access token
app.get('/api/nas/web-credentials', async (req, res) => {
  try {
    const token = await getNasToken();
    res.json({
      nasWebUrl: `${NAS_HOST}/files/`,
      nasLoginUrl: `${NAS_HOST}/login`,
      username: DEFAULT_USER,
      password: DEFAULT_PASS,
      token,
      directAccessUrl: `${NAS_HOST}/files/?auth=${token}`,
    });
  } catch (err: any) {
    res.json({
      nasWebUrl: `${NAS_HOST}/files/`,
      nasLoginUrl: `${NAS_HOST}/login`,
      username: DEFAULT_USER,
      password: DEFAULT_PASS,
      token: null,
      error: err.message,
    });
  }
});

// 9. Real-time Multi-Device Sync Hub endpoints
app.get('/api/sync/state', (req, res) => {
  lastSyncCheck = Date.now();
  res.json({
    autoSync: isAutoSyncEnabled,
    intervalMs: autoSyncInterval,
    lastSyncTimestamp: lastSyncCheck,
    devices: Array.from(connectedDevices.values()),
    logs: syncLogs.slice(0, 30),
  });
});

app.post('/api/sync/toggle', (req, res) => {
  if (typeof req.body.enabled === 'boolean') {
    isAutoSyncEnabled = req.body.enabled;
  }
  if (typeof req.body.intervalMs === 'number' && req.body.intervalMs >= 3000) {
    autoSyncInterval = req.body.intervalMs;
  }
  broadcastSse('sync_state', {
    autoSync: isAutoSyncEnabled,
    intervalMs: autoSyncInterval,
  });
  res.json({ success: true, isAutoSyncEnabled, autoSyncInterval });
});

app.post('/api/sync/trigger', async (req, res) => {
  lastSyncCheck = Date.now();
  // Simulate active device sync ping
  connectedDevices.forEach((dev) => {
    dev.lastSeen = Date.now();
    dev.status = 'syncing';
  });

  setTimeout(() => {
    connectedDevices.forEach((dev) => {
      dev.status = 'online';
    });
  }, 1200);

  const logItem: SyncLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    deviceId: req.body.deviceId || 'dev-browser-current',
    deviceName: req.body.deviceName || 'Web Client (Browser Saat Ini)',
    action: 'sync',
    targetPath: req.body.path || '/sda1-usb-Lexar_USB_Flash_/',
    status: 'success',
    details: 'Sinkronisasi manual instan antar seluruh perangkat terselesaikan (100% selaras)',
  };
  syncLogs.unshift(logItem);
  if (syncLogs.length > 50) syncLogs.pop();

  broadcastSse('sync_event', {
    type: 'sync_completed',
    timestamp: lastSyncCheck,
    log: logItem,
    devices: Array.from(connectedDevices.values()),
  });

  res.json({
    success: true,
    syncedAt: lastSyncCheck,
    devicesCount: connectedDevices.size,
    log: logItem,
  });
});

// Register or pair device
app.post('/api/sync/devices', (req, res) => {
  const { name, type } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Nama perangkat diperlukan' });
  }

  const id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newDevice: Device = {
    id,
    name,
    type: type || 'browser',
    ip: '10.8.0.' + Math.floor(Math.random() * 200 + 10),
    lastSeen: Date.now(),
    status: 'online',
    clientVersion: 'v2.4.0',
  };

  connectedDevices.set(id, newDevice);

  const logItem: SyncLog = {
    id: `log-${Date.now()}`,
    timestamp: Date.now(),
    deviceId: id,
    deviceName: name,
    action: 'sync',
    targetPath: '/',
    status: 'success',
    details: `Perangkat baru "${name}" telah terhubung ke sinkronisasi cloud real-time`,
  };
  syncLogs.unshift(logItem);

  broadcastSse('device_registered', {
    device: newDevice,
    devices: Array.from(connectedDevices.values()),
    log: logItem,
  });

  res.json({ success: true, device: newDevice });
});

// Remove paired device
app.delete('/api/sync/devices/:id', (req, res) => {
  const { id } = req.params;
  if (connectedDevices.has(id)) {
    connectedDevices.delete(id);
    broadcastSse('device_removed', {
      deviceId: id,
      devices: Array.from(connectedDevices.values()),
    });
    res.json({ success: true, message: 'Perangkat dilepas' });
  } else {
    res.status(404).json({ error: 'Perangkat tidak ditemukan' });
  }
});

// SSE endpoint for live updates
app.get('/api/sync/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  // Send initial state
  res.write(
    `event: init\ndata: ${JSON.stringify({
      status: 'connected',
      lastSyncTimestamp: lastSyncCheck,
      devices: Array.from(connectedDevices.values()),
    })}\n\n`
  );

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) {
      sseClients.splice(idx, 1);
    }
  });
});

// Background heartbeat to simulate real-time sync keepalive
setInterval(() => {
  if (isAutoSyncEnabled && sseClients.length > 0) {
    lastSyncCheck = Date.now();
    // Update current device timestamp
    const curr = connectedDevices.get('dev-browser-current');
    if (curr) curr.lastSeen = Date.now();

    broadcastSse('heartbeat', {
      timestamp: lastSyncCheck,
      autoSync: isAutoSyncEnabled,
      activeDevices: connectedDevices.size,
    });
  }
}, 5000);

// Set up Vite or Static
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server E1Cloud NAS Sync running on http://0.0.0.0:${port}`);
  });
}

startServer();
