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
}

// Grobe Formfaktor-Erkennung ueber den User-Agent (nicht die Leistungsklasse!)
// — ein Smartphone bekommt die Empfehlung auf ein staerkeres Geraet zu
// wechseln, selbst wenn es zufaellig genug RAM/Kerne fuer "balanced" hat.
export function isMobileDevice(): boolean {
  return /Android|iPhone|iPod|Mobile|Windows Phone/i.test(navigator.userAgent);
}

// Smartphone ODER schwache Hardware (Leistungsklasse "light" ohne WebGPU) —
// beides rechtfertigt die Empfehlung, LocalSpeech auf einem staerkeren
// Laptop/PC/Tablet zu nutzen.
export function isWeakDevice(hw: HardwareInfo): boolean {
  return isMobileDevice() || (hw.tier === 'light' && hw.cpuOnly);
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
    const mem = deviceMemoryGB ?? 8; // Chrome deckelt deviceMemory bei 8
    if (maxBufferGB >= 3.5 && mem >= 8) tier = 'strong';
    else if (maxBufferGB >= 1.8 && mem >= 4) tier = 'balanced';
  } else if (cores >= 8 && (deviceMemoryGB ?? 8) >= 8) {
    // Ohne WebGPU rechnet llama.cpp auf Multithread-WASM: auf starken CPUs
    // ist das mittlere Modell noch benutzbar (~4-8 Token/s).
    tier = 'balanced';
  }
  const cpuOnly = !webgpu;

  // strong-Geraete (GPU mit >=3.5-GiB-Puffern) tragen das 4B (Q3_K_S, s.
  // catalog.ts), balanced mit GPU das 2B; CPU-only und light bleiben beim 0.8B.
  const recommendedLLM =
    !cpuOnly && tier === 'strong'
      ? 'qwen35-4b'
      : !cpuOnly && tier === 'balanced'
        ? 'qwen35-2b'
        : 'qwen35-0.8b';

  const recommendedStt =
    tier === 'light' ? 'onnx-community/whisper-tiny' : 'onnx-community/whisper-small';

  return { webgpu, f16, vendor, maxBufferGB, deviceMemoryGB, cores, tier, cpuOnly, recommendedLLM, recommendedStt };
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
