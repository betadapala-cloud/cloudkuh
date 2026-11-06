import { NasFolderData, NasStatus, SyncState, WebCredentials, Device, NasStorageStats } from '../types';

export class UploadCancelledError extends Error {
  constructor(message = 'Unggahan dibatalkan') {
    super(message);
    this.name = 'UploadCancelledError';
  }
}

export interface UploadController {
  setActiveXhr: (xhr: XMLHttpRequest | null) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  isPaused: () => boolean;
  isCancelled: () => boolean;
  setResumeCallback: (cb: () => void) => void;
  setUploadId?: (uploadId: string) => void;
  getUploadId?: () => string | null;
}

export function createUploadController(): UploadController {
  let isPausedState = false;
  let isCancelledState = false;
  let currentXhr: XMLHttpRequest | null = null;
  let resumeCallback: (() => void) | null = null;
  let activeUploadId: string | null = null;

  return {
    setActiveXhr: (xhr) => {
      currentXhr = xhr;
    },
    pause: () => {
      if (isCancelledState || isPausedState) return;
      isPausedState = true;
      if (currentXhr) {
        currentXhr.abort();
      }
    },
    resume: () => {
      if (isCancelledState || !isPausedState) return;
      isPausedState = false;
      if (resumeCallback) {
        const cb = resumeCallback;
        resumeCallback = null;
        cb();
      }
    },
    cancel: () => {
      if (isCancelledState) return;
      isCancelledState = true;
      isPausedState = false;
      if (currentXhr) {
        currentXhr.abort();
      }
      if (resumeCallback) {
        const cb = resumeCallback;
        resumeCallback = null;
        cb();
      }
    },
    isPaused: () => isPausedState,
    isCancelled: () => isCancelledState,
    setResumeCallback: (cb) => {
      resumeCallback = cb;
    },
    setUploadId: (uid) => {
      activeUploadId = uid;
    },
    getUploadId: () => activeUploadId,
  };
}

export const api = {
  async getStatus(): Promise<NasStatus> {
    const res = await fetch('/api/nas/status');
    return res.json();
  },

  async getFiles(path = '/'): Promise<{ success: boolean; currentPath: string; data: NasFolderData }> {
    const res = await fetch(`/api/nas/files?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Gagal memuat berkas' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async abortChunkedUpload(uploadId: string): Promise<void> {
    try {
      await fetch('/api/nas/upload-abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
      });
    } catch {
      // Ignore cleanup error
    }
  },

  uploadFile(
    dir: string,
    file: File,
    onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void,
    controller?: UploadController
  ): Promise<{ success: boolean; path: string; message: string }> {
    const CHUNK_SIZE = 15 * 1024 * 1024; // 15 MB per chunk (well below Cloud Run's 32 MB limit to prevent HTTP 413)

    // For files smaller than or equal to 15 MB, standard upload is fast and direct
    if (file.size <= CHUNK_SIZE) {
      return new Promise((resolve, reject) => {
        const doUpload = () => {
          if (controller?.isCancelled()) {
            return reject(new UploadCancelledError());
          }

          const formData = new FormData();
          formData.append('file', file);
          formData.append('dir', dir);

          const xhr = new XMLHttpRequest();
          controller?.setActiveXhr(xhr);
          xhr.open('POST', '/api/nas/upload');

          if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percentage = Math.round((event.loaded / event.total) * 100);
                onProgress({
                  loaded: event.loaded,
                  total: event.total,
                  percentage,
                });
              }
            };
          }

          xhr.onload = () => {
            controller?.setActiveXhr(null);
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const res = JSON.parse(xhr.responseText);
                resolve(res);
              } catch {
                resolve({ success: true, path: `${dir}/${file.name}`, message: 'Selesai diunggah' });
              }
            } else {
              try {
                const err = JSON.parse(xhr.responseText);
                reject(new Error(err.error || `HTTP ${xhr.status}`));
              } catch {
                reject(new Error(`Gagal mengunggah (HTTP ${xhr.status})`));
              }
            }
          };

          xhr.onabort = () => {
            controller?.setActiveXhr(null);
            if (controller?.isCancelled()) {
              return reject(new UploadCancelledError());
            }
            if (controller?.isPaused()) {
              controller.setResumeCallback(() => {
                doUpload();
              });
              return;
            }
            reject(new Error('Unggahan dihentikan'));
          };

          xhr.onerror = () => {
            controller?.setActiveXhr(null);
            if (controller?.isCancelled()) {
              return reject(new UploadCancelledError());
            }
            if (controller?.isPaused()) {
              controller.setResumeCallback(() => {
                doUpload();
              });
              return;
            }
            reject(new Error('Koneksi terputus saat mengunggah'));
          };

          xhr.send(formData);
        };

        if (controller?.isPaused()) {
          controller.setResumeCallback(() => {
            doUpload();
          });
        } else {
          doUpload();
        }
      });
    }

    // For large files (> 15 MB like videos, ISOs, or large archives):
    // Use chunked upload in 15 MB fragments to bypass Cloud Run's 32 MB request cap
    return new Promise(async (resolve, reject) => {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = `up-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      controller?.setUploadId?.(uploadId);

      let chunkIndex = 0;
      let uploadedBytesPriorChunks = 0;
      let finalResponse: any = null;

      while (chunkIndex < totalChunks) {
        // 1. Check if cancelled
        if (controller?.isCancelled()) {
          api.abortChunkedUpload(uploadId);
          return reject(new UploadCancelledError());
        }

        // 2. Check if paused - wait until resume() is called
        if (controller?.isPaused()) {
          await new Promise<void>((resWait) => {
            controller.setResumeCallback(resWait);
          });
          if (controller?.isCancelled()) {
            api.abortChunkedUpload(uploadId);
            return reject(new UploadCancelledError());
          }
        }

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunkBlob = file.slice(start, end);

        let attempts = 0;
        let chunkSuccess = false;
        let lastError: any = null;

        while (attempts < 3 && !chunkSuccess) {
          if (controller?.isCancelled()) {
            api.abortChunkedUpload(uploadId);
            return reject(new UploadCancelledError());
          }
          if (controller?.isPaused()) {
            break;
          }

          attempts++;
          try {
            finalResponse = await new Promise((resChunk, rejChunk) => {
              const formData = new FormData();
              formData.append('chunk', chunkBlob, file.name);
              formData.append('uploadId', uploadId);
              formData.append('chunkIndex', chunkIndex.toString());
              formData.append('totalChunks', totalChunks.toString());
              formData.append('fileName', file.name);
              formData.append('dir', dir);
              formData.append('totalSize', file.size.toString());
              formData.append('mimeType', file.type || 'application/octet-stream');

              const xhr = new XMLHttpRequest();
              controller?.setActiveXhr(xhr);
              xhr.open('POST', '/api/nas/upload-chunk');

              if (xhr.upload && onProgress) {
                xhr.upload.onprogress = (event) => {
                  if (event.lengthComputable) {
                    const currentLoaded = uploadedBytesPriorChunks + event.loaded;
                    const percentage = Math.min(
                      99,
                      Math.round((currentLoaded / file.size) * 100)
                    );
                    onProgress({
                      loaded: currentLoaded,
                      total: file.size,
                      percentage,
                    });
                  }
                };
              }

              xhr.onload = () => {
                controller?.setActiveXhr(null);
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const parsed = JSON.parse(xhr.responseText);
                    resChunk(parsed);
                  } catch {
                    resChunk({ success: true });
                  }
                } else {
                  try {
                    const err = JSON.parse(xhr.responseText);
                    rejChunk(new Error(err.error || `HTTP ${xhr.status}`));
                  } catch {
                    rejChunk(new Error(`Gagal mengunggah fragmen ${chunkIndex + 1}/${totalChunks} (HTTP ${xhr.status})`));
                  }
                }
              };

              xhr.onabort = () => {
                controller?.setActiveXhr(null);
                if (controller?.isCancelled()) {
                  return rejChunk(new UploadCancelledError());
                }
                if (controller?.isPaused()) {
                  return rejChunk(new Error('PAUSED'));
                }
                rejChunk(new Error('Fragmen dibatalkan'));
              };

              xhr.onerror = () => {
                controller?.setActiveXhr(null);
                if (controller?.isCancelled()) {
                  return rejChunk(new UploadCancelledError());
                }
                if (controller?.isPaused()) {
                  return rejChunk(new Error('PAUSED'));
                }
                rejChunk(new Error(`Koneksi terputus pada fragmen ${chunkIndex + 1}/${totalChunks}`));
              };

              xhr.send(formData);
            });

            uploadedBytesPriorChunks += (end - start);
            chunkSuccess = true;
            chunkIndex++;
          } catch (err: any) {
            if (err instanceof UploadCancelledError || controller?.isCancelled()) {
              api.abortChunkedUpload(uploadId);
              return reject(new UploadCancelledError());
            }
            if (controller?.isPaused() || err.message === 'PAUSED') {
              break;
            }
            lastError = err;
            if (attempts < 3) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
        }

        if (!chunkSuccess && !controller?.isPaused() && !controller?.isCancelled()) {
          api.abortChunkedUpload(uploadId);
          return reject(lastError || new Error(`Gagal mengunggah fragmen ${chunkIndex + 1}/${totalChunks}`));
        }
      }

      // Completed all chunks
      if (onProgress) {
        onProgress({
          loaded: file.size,
          total: file.size,
          percentage: 100,
        });
      }

      resolve(finalResponse || { success: true, path: `${dir}/${file.name}`, message: 'Selesai diunggah' });
    });
  },

  async createFolder(folderPath: string): Promise<{ success: boolean; path: string; message: string }> {
    const res = await fetch('/api/nas/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Gagal membuat folder' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async deleteItem(path: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/nas/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Gagal menghapus item' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async renameItem(sourcePath: string, destinationPath: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/nas/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath, destinationPath }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Gagal mengubah nama' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async copyItem(sourcePath: string, destinationPath: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/nas/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath, destinationPath }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Gagal menyalin item' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async moveItem(sourcePath: string, destinationPath: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/nas/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath, destinationPath }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Gagal memindahkan item' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  getRawFileUrl(filePath: string, download = false): string {
    return `/api/nas/raw?path=${encodeURIComponent(filePath)}&download=${download ? 'true' : 'false'}`;
  },

  async getDirectDownloadUrl(filePath: string): Promise<string> {
    const res = await fetch(`/api/nas/direct-url?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error('Gagal mendapatkan tautan unduh langsung');
    const data = await res.json();
    return data.directUrl;
  },

  getThumbnailUrl(filePath: string, size: 'thumb' | 'big' = 'thumb'): string {
    return `/api/nas/thumb?path=${encodeURIComponent(filePath)}&size=${size}`;
  },

  async getWebCredentials(): Promise<WebCredentials> {
    const res = await fetch('/api/nas/web-credentials');
    return res.json();
  },

  async getSyncState(): Promise<SyncState> {
    const res = await fetch('/api/sync/state');
    return res.json();
  },

  async toggleAutoSync(enabled: boolean, intervalMs?: number): Promise<{ success: boolean }> {
    const res = await fetch('/api/sync/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, intervalMs }),
    });
    return res.json();
  },

  async triggerSync(path?: string): Promise<{ success: boolean; syncedAt: number }> {
    const res = await fetch('/api/sync/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    return res.json();
  },

  async registerDevice(name: string, type: string): Promise<{ success: boolean; device: Device }> {
    const res = await fetch('/api/sync/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type }),
    });
    return res.json();
  },

  async removeDevice(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/sync/devices/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async getNasStorageStats(): Promise<NasStorageStats> {
    const res = await fetch('/api/nas/storage-stats');
    if (!res.ok) throw new Error('Gagal memuat statistik kapasitas penyimpanan');
    return res.json();
  },
};
