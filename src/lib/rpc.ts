// Minimales Promise-basiertes RPC zwischen Hauptthread und Web Workern.

interface Pending {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  onProgress?: (p: any) => void;
}

export class WorkerClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor(worker: Worker) {
    this.worker = worker;
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      if ('progress' in msg) {
        p.onProgress?.(msg.progress);
        return;
      }
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.data);
      else p.reject(new Error(msg.error));
    };
    worker.onerror = (e) => {
      const err = new Error(e.message || 'Worker-Fehler');
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    };
  }

  call<T = any>(
    type: string,
    data?: any,
    opts?: { transfer?: Transferable[]; onProgress?: (p: any) => void },
  ): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress: opts?.onProgress });
      this.worker.postMessage({ id, type, data }, opts?.transfer ?? []);
    });
  }

  terminate() {
    this.worker.terminate();
    this.pending.clear();
  }
}

type Handler = (data: any, progress: (p: any) => void) => Promise<any>;

// Worker-Seite: Handler registrieren. Ein Handler kann `__transfer` am
// Ergebnis setzen, um ArrayBuffer ohne Kopie zurueckzugeben.
export function serve(handlers: Record<string, Handler>) {
  self.onmessage = async (e: MessageEvent) => {
    const { id, type, data } = e.data;
    const handler = handlers[type];
    try {
      if (!handler) throw new Error(`Unbekannter RPC-Typ: ${type}`);
      const result = await handler(data, (p) => self.postMessage({ id, progress: p }));
      const transfer: Transferable[] = result?.__transfer ?? [];
      if (result && result.__transfer) delete result.__transfer;
      (self as any).postMessage({ id, ok: true, data: result }, transfer);
    } catch (err: any) {
      self.postMessage({ id, ok: false, error: String(err?.message ?? err) });
    }
  };
}

export interface DownloadProgress {
  pct: number; // 0..100
  loadedMB: number;
  totalMB: number;
  text?: string;
}

// Aggregiert die Datei-weisen progress_callback-Events von transformers.js
// zu einem Gesamt-Fortschritt.
export function makeAggregator(report: (p: DownloadProgress) => void) {
  const files = new Map<string, { loaded: number; total: number }>();
  return (ev: any) => {
    if (!ev || typeof ev !== 'object') return;
    if (ev.status === 'progress' && ev.file && ev.total) {
      files.set(ev.file, { loaded: ev.loaded ?? 0, total: ev.total });
    } else if (ev.status === 'done' && ev.file) {
      const f = files.get(ev.file);
      if (f) f.loaded = f.total;
    } else {
      return;
    }
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    if (total > 0) {
      report({
        pct: Math.min(100, (loaded / total) * 100),
        loadedMB: loaded / 1e6,
        totalMB: total / 1e6,
      });
    }
  };
}
