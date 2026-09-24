// Typen fuer den Emscripten-Build von eSpeak NG (Paket hat keine eigenen).
declare module 'espeak-ng' {
  interface ESpeakNgModule {
    FS: {
      readFile(path: string, opts: { encoding: 'utf8' }): string;
      unlink(path: string): void;
    };
  }
  interface ESpeakNgOptions {
    arguments?: string[];
    wasmBinary?: ArrayBuffer | Uint8Array;
    noInitialRun?: boolean;
  }
  export default function ESpeakNg(opts?: ESpeakNgOptions): Promise<ESpeakNgModule>;
}
