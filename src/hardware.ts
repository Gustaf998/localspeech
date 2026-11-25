// Hardware-Erkennung: prueft WebGPU, schaetzt die Leistungsklasse und
// empfiehlt daraus passende Modelle.

import { LLM_OPTIONS, type Tier } from './catalog';
import { t } from './i18n';

export interface HardwareInfo {
  webgpu: boolean;
  f16: boolean;
  vendor: string;
  maxBufferGB: number;
  deviceMemoryGB: number | null;
  cores: number;
  tier: Tier;
  cpuOnly: boolean; // kein WebGPU -> LLM laeuft auf Multithread-WASM (langsamer)
  recommendedLLM: string; // Katalog-id des empfohlenen LLM
  recommendedStt: string;
  lightMode: boolean;
  recommendedBrowser: boolean;
}

// Grobe Formfaktor-Erkennung ueber den User-Agent (nicht die Leistungsklasse!)
// — Smartphones erhalten das kompakte 0.5B-Modell, selbst wenn sie genug
// RAM/Kerne fuer eine hoehere abstrakte Leistungsklasse melden.
export function isMobileDevice(): boolean {
  return /Android|iPhone|iPod|Mobile|Windows Phone/i.test(navigator.userAgent);
}

// iPadOS meldet sich als "Macintosh" (Desktop-UA) -> ueber Touchpunkte erkennen.
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// Smartphone ODER schwache Hardware (Leistungsklasse "light" ohne WebGPU) —
// beides rechtfertigt die Empfehlung, LocalSpeech auf einem staerkeren
// Laptop/PC/Tablet zu nutzen.
export function isWeakDevice(hw: HardwareInfo): boolean {
  return hw.lightMode || isMobileDevice();
}

// Chrome und Edge (Chromium) sind aktuell die zuverlässigsten Browser für
// WebGPU und die großen lokalen Modelle.
export function isRecommendedBrowser(): boolean {
  const ua = navigator.userAgent;
  if (/Edg(?:A|iOS)?\//.test(ua) || /CriOS\//.test(ua)) return true;
  const chromiumChrome = /Chrome\//.test(ua) && !/OPR\//.test(ua) && !/SamsungBrowser\//.test(ua);
  return chromiumChrome && !(navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave;
}

export async function detectHardware(): Promise<HardwareInfo> {
  const cores = navigator.hardwareConcurrency ?? 4;
  const deviceMemoryGB = (navigator as any).deviceMemory ?? null;

  let webgpu = false;
  let f16 = false;
  let vendor = '';
  let maxBufferGB = 0;

  try {
    const gpu = (navigator as any).gpu;
    if (gpu) {
      // requestAdapter kann in kaputten Umgebungen ewig haengen -> Timeout,
      // damit die App sauber auf dem "Kein WebGPU"-Hinweis landet.
      const adapter = await Promise.race([
        gpu.requestAdapter(),
        new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (adapter) {
        webgpu = true;
        f16 = adapter.features?.has?.('shader-f16') ?? false;
        maxBufferGB = (adapter.limits?.maxBufferSize ?? 0) / 2 ** 30;
        vendor = adapter.info?.vendor ?? '';
      }
    }
  } catch {
    webgpu = false;
  }

  let tier: Tier = 'light';
  if (webgpu) {
    // Safari/Firefox kennen deviceMemory nicht -> auf Mobilgeraeten vorsichtig 4 annehmen.
    // Fehlende Werte nicht als 8 GB behandeln: Safari/Firefox melden RAM nicht,
    // und eine optimistische Annahme führt auf schwachen Geräten zu OOM.
    const mem = deviceMemoryGB ?? (isMobileDevice() || isIOS() ? 3 : 4);
    if (maxBufferGB >= 3.5 && mem >= 8) tier = 'strong';
    else if (maxBufferGB >= 1.8 && mem >= 4) tier = 'balanced';
  } else if (cores >= 8 && deviceMemoryGB !== null && deviceMemoryGB >= 8) {
    // Ohne WebGPU rechnet llama.cpp auf Multithread-WASM: auf starken CPUs
    // ist das mittlere Modell noch benutzbar (~4-8 Token/s).
    tier = 'balanced';
  }
  // Mobile Browser begrenzen den Speicher pro Tab stark. Das kleine Modell
  // bleibt daher auch auf leistungsfaehigen Handys die Empfehlung.
  if (isMobileDevice() || isIOS()) tier = 'light';
  const cpuOnly = !webgpu;

  // strong-Geraete (GPU mit >=3.5-GiB-Puffern) tragen das 4B (Q3_K_S, s.
  // catalog.ts), balanced mit GPU das 2B; light und Handys erhalten das 0.5B.
  const recommendedLLM =
    isMobileDevice() || isIOS() || tier === 'light'
      ? 'qwen25-0.5b'
      : !cpuOnly && tier === 'strong'
      ? 'qwen35-4b'
      : !cpuOnly && tier === 'balanced'
        ? 'qwen35-2b'
        : 'qwen35-0.8b';

  const recommendedStt =
    tier === 'light' ? 'onnx-community/whisper-tiny' : 'onnx-community/whisper-small';

  // Auch WebGPU-Geräte können wenig RAM haben. Bei unklarer RAM-Angabe setzen
  // wir das Profil anhand von CPU-Kernen und Formfaktor konservativ herab.
  const lowMemory = (deviceMemoryGB !== null && deviceMemoryGB <= 4) || cores <= 4;
  const lightMode = isMobileDevice() || isIOS() || lowMemory || (tier === 'light' && cpuOnly);
  const recommendedBrowser = isRecommendedBrowser();

  console.info('[hw]', {
    webgpu,
    f16,
    vendor,
    maxBufferGB,
    deviceMemoryGB,
    cores,
    tier,
    recommendedLLM,
    crossOriginIsolated: self.crossOriginIsolated,
    ios: isIOS(),
    lightMode,
    recommendedBrowser,
  });
  return { webgpu, f16, vendor, maxBufferGB, deviceMemoryGB, cores, tier, cpuOnly, recommendedLLM, recommendedStt, lightMode, recommendedBrowser };
}

export function tierLabel(tier: Tier): string {
  return t(`tier.${tier}`);
}

export function describeHardware(hw: HardwareInfo): string {
  const parts: string[] = [];
  parts.push(hw.webgpu ? `${t('hw.webgpuYes')}${hw.vendor ? ` (${hw.vendor})` : ''}` : t('hw.cpuMode'));
  if (hw.deviceMemoryGB) parts.push(t('hw.ram', { n: hw.deviceMemoryGB }));
  parts.push(t('hw.cores', { n: hw.cores }));
  if (hw.webgpu && hw.maxBufferGB > 0) parts.push(t('hw.buffer', { n: hw.maxBufferGB.toFixed(1) }));
  return parts.join(' · ');
}

// Sortiert Optionen so, dass die empfohlene zuerst steht.
export function llmOptionsForTier(hw: HardwareInfo) {
  const order: Tier[] = ['light', 'balanced', 'strong', 'max'];
  const maxIdx = order.indexOf(hw.tier);
  return LLM_OPTIONS.map((o) => ({
    ...o,
    recommended: o.id === hw.recommendedLLM,
    feasible: order.indexOf(o.tier) <= maxIdx,
  }));
}
