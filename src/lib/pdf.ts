// PDF-Textauszug — vollständig offline über pdfjs-dist (von Vite gebündelt,
// kein CDN). Der Worker wird als lokales ES-Modul geladen; so bleibt die App
// auch ohne Netz nutzbar. Wir ziehen nur den reinen Text (kein Layout/Bilder),
// denn die KI braucht zum Reden über ein Dokument bloß den Inhalt.

import * as pdfjs from 'pdfjs-dist';
// Vite löst diese URL zur gebündelten, lokal ausgelieferten Worker-Datei auf.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Liest den Text aller Seiten (bis maxChars) aus einem PDF. Wirft bei kaputten
// oder passwortgeschützten Dateien — der Aufrufer fängt das ab und meldet es.
export async function extractPdfText(file: File, maxChars: number): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  try {
    const parts: string[] = [];
    let total = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Textstücke einer Seite mit Leerzeichen verbinden; leere Items überspringen.
      const pageText = content.items
        .map((it: any) => ('str' in it ? it.str : ''))
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
      page.cleanup();
      if (pageText) {
        parts.push(pageText);
        total += pageText.length;
      }
      if (total >= maxChars) break;
    }
    return parts.join('\n\n').slice(0, maxChars);
  } finally {
    await task.destroy();
  }
}
