// Animierte Persona-Portraets — parametrisches SVG-Gesichts-Rig.
//
// Statt Foto-Deepfakes (offline nicht machbar, rechtlich heikel) zeichnet
// LocalSpeech jede Legende als hochwertiges, wiedererkennbares Portraet im
// Duotone-Stil des Designsystems. Ein gemeinsames Rig animiert alle Gesichter:
//   - Lippensynchronisation in Echtzeit aus der TTS-Audio-Analyse
//     (Lautstaerke -> Mundoeffnung, Spektral-Schwerpunkt -> Mundform/Viseme)
//   - Blinzeln, Pupillen-Wandern, Brauen-Betonung, Kopf-Schwingen, Atmen
//   - Zustaende wie die Orb-Kugel: idle / listening / thinking / speaking
//
// Die Portraets entstehen komplett aus Parametern (personas.ts) — ein
// Renderer, viele Gesichter, konsistenter Stil, keine Bildrechte-Fragen.

export type AvatarState = 'loading' | 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

// Echtzeit-Sprachsignal des Players: Lautstaerke + spektraler Schwerpunkt.
export interface SpeechLevels {
  rms: number; // 0..~0.5
  centroid: number; // 0..1 (hell = Zischlaute/e/i, dunkel = o/u/m)
}

export interface Portrait {
  skin: string; // Grundhautton (hex)
  accent: string; // Akzentfarbe fuer Halo/Karten
  faceW?: number; // Gesichtsbreite 0.9..1.15 (1 = normal)
  chin?: 'round' | 'pointed' | 'square' | 'long';
  cleftChin?: boolean; // Kinngruebchen (Musk)
  nose?: 'small' | 'long' | 'aquiline' | 'broad';
  earSize?: number; // 1 = normal
  eyeColor?: string;
  browColor?: string;
  browW?: number; // Brauenstaerke 0.7..1.6
  browAngle?: number; // Grad; negativ = streng
  unibrow?: boolean;
  kohl?: boolean; // Kajal-Lidstrich (Kleopatra)
  lipColor?: string;
  lipFull?: number; // Lippenfuelle 0..1
  smile?: number; // Grundlaecheln 0..1
  beautyMark?: boolean;
  blush?: boolean;
  wrinkles?: boolean;
  hair: {
    style:
      | 'wild' | 'curls' | 'bobFringe' | 'bobSide' | 'bun' | 'long' | 'shortFringe'
      | 'short' | 'slick' | 'balding' | 'sweep' | 'updo' | 'bald' | 'sides' | 'crop';
    color: string;
  };
  facial?: {
    style: 'mustache' | 'walrus' | 'goatee' | 'vandyke' | 'full' | 'long' | 'chinstrap';
    color: string;
  };
  glasses?: 'round' | 'pince' | 'none';
  headwear?:
    | 'bicorne' | 'tophat' | 'flowers' | 'diadem' | 'panama' | 'fruit'
    | 'beret' | 'strawhat' | 'sariveil' | 'none';
  headwearColor?: string;
  jewelry?: ('pearls' | 'earrings' | 'hoops' | 'nosering' | 'bindi' | 'tikka' | 'goldcollar')[];
  clothes: {
    style:
      | 'suit' | 'ruff' | 'toga' | 'uniform' | 'dress' | 'highcollar' | 'armor'
      | 'breton' | 'shawl' | 'blouse' | 'sari' | 'robe' | 'tee';
    color: string;
    color2?: string;
    neck?: 'tie' | 'bow' | 'cravat' | 'none';
  };
}

// ------------------------------------------------------------ Farb-Helfer

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

// f > 0 hellt auf, f < 0 dunkelt ab (jeweils anteilig Richtung Weiss/Schwarz).
export function shade(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (f >= 0) return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
  return rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ------------------------------------------------------- Geometrie-Bausteine
// Koordinaten: viewBox 0 0 200 200, Kopfzentrum (100, 92), Kinn ~134.

function facePath(p: Portrait): string {
  const w = 33 * (p.faceW ?? 1);
  const chin = p.chin ?? 'round';
  const chinY = chin === 'long' ? 141 : 134;
  const cw = chin === 'square' ? 15 : chin === 'pointed' ? 6.5 : chin === 'long' ? 9 : 11;
  const jawY = chin === 'square' ? 122 : 116;
  return [
    `M ${100 - w * 0.99} 88`,
    `C ${100 - w * 1.04} 62, ${100 - w * 0.68} 49, 100 49`,
    `C ${100 + w * 0.68} 49, ${100 + w * 1.04} 62, ${100 + w * 0.99} 88`,
    `C ${100 + w * 0.97} ${jawY - 10}, ${100 + w * (chin === 'square' ? 0.9 : 0.78)} ${jawY}, ${100 + cw} ${chinY - 3}`,
    `Q 100 ${chinY + 3}, ${100 - cw} ${chinY - 3}`,
    `C ${100 - w * (chin === 'square' ? 0.9 : 0.78)} ${jawY}, ${100 - w * 0.97} ${jawY - 10}, ${100 - w * 0.99} 88`,
    'Z',
  ].join(' ');
}

function nosePath(p: Portrait): string {
  switch (p.nose ?? 'small') {
    case 'long':
      return 'M 100 86 C 101.5 92, 102.5 98, 102.5 103 Q 101 106.5 97.5 105.5 M 97 104.8 Q 100 107.5 104 105';
    case 'aquiline':
      return 'M 99.5 86 C 103 90, 104 95, 104 100 Q 103.5 105 98 104.8 M 97 104.4 Q 100.5 107 104.6 104.6';
    case 'broad':
      return 'M 100 88 C 101 93, 101.5 96, 101.8 100 M 94.5 103.4 Q 100 108, 105.5 103.4 M 94.5 103.4 Q 93 101.5 94.8 100 M 105.5 103.4 Q 107 101.5 105.2 100';
    default:
      return 'M 100 88 C 101 93, 102 97, 102 101 Q 100.8 104.4 97.8 103.6 M 96.5 103.2 Q 99.5 105.8 103.4 103.6';
  }
}

// --------------------------------------------------------------- Haar-Stile
// back = hinter dem Gesicht, front = vor dem Gesicht (bewegt sich mit).

function hairSVG(p: Portrait): { back: string; front: string } {
  const c = p.hair.color;
  const dark = shade(c, -0.22);
  const lite = shade(c, 0.12);
  switch (p.hair.style) {
    case 'wild': // Einstein: hohe freie Stirn, weisse Maehne steht seitlich/oben ab
      // back = grosse wolkige Masse, die ueber den Ohren weit ausschert und
      // ueber dem Scheitel aufsteigt; front = nur hoher, wispy Haaransatz auf
      // der Schaedeldecke + Schlaefenansatz — die Stirn bleibt frei.
      return {
        back: `<path fill="${c}" d="M 62 118
                 C 50 116 42 108 45 98
                 C 34 94 32 80 42 74
                 C 32 64 40 52 52 52
                 C 48 38 62 32 72 38
                 C 76 26 92 24 100 32
                 C 108 24 124 26 128 38
                 C 138 32 152 38 148 52
                 C 160 52 168 64 158 74
                 C 168 80 166 94 155 98
                 C 158 108 150 116 138 118
                 C 128 112 72 112 62 118 Z"/>
               <path fill="none" stroke="${lite}" stroke-width="1.6" opacity="0.55" d="M 46 92 C 38 84 38 72 46 68 M 154 92 C 162 84 162 72 154 68 M 78 40 C 84 32 96 30 102 34 M 122 40 C 116 33 108 30 102 33"/>
               <path fill="none" stroke="${dark}" stroke-width="1.5" opacity="0.28" d="M 66 100 C 60 88 62 72 70 64 M 134 100 C 140 88 138 72 130 64"/>`,
        front: `<path fill="${c}" d="M 64 90
                  C 60 74 60 60 68 52
                  C 76 44 90 41 100 41
                  C 110 41 124 44 132 52
                  C 140 60 140 74 136 90
                  C 133 88 131.5 84 131 80
                  C 130 70 132 64 128 60
                  Q 122 56.5 117 58.5
                  Q 111 55.5 105 58
                  Q 99 55.5 93 58.5
                  Q 87 56 81 59
                  C 75 61 70.5 66 69.5 74
                  C 69 80 68 84 66 87
                  C 65.5 88 64.5 89 64 90 Z"/>
                <path fill="none" stroke="${dark}" stroke-width="1.2" opacity="0.22" d="M 84 58 C 82 52 84 46 88 43 M 100 57 C 100 50 102 45 104 42 M 116 58 C 118 52 116 46 112 43"/>`,
      };
    case 'curls': // Monroe: weiche Wellen bis zum Kiefer
      return {
        back: `<path fill="${c}" d="M 62 118 C 50 112 48 96 54 84 C 48 66 62 48 80 46 C 90 38 110 38 120 46 C 138 48 152 66 146 84 C 152 96 150 112 138 118 C 146 106 142 96 136 92 C 142 78 134 62 120 60 C 112 52 88 52 80 60 C 66 62 58 78 64 92 C 58 96 54 106 62 118 Z"/>
               <path fill="${dark}" opacity="0.35" d="M 58 108 C 54 98 56 90 61 86 M 142 108 C 146 98 144 90 139 86"/>`,
        front: `<path fill="${c}" d="M 66 86 C 62 62 76 49 92 51 C 104 43 124 49 130 61 C 134 70 134 78 133 86 C 127 70 117 63 105 66 C 97 59 84 61 78 69 C 72 74 68 79 66 86 Z"/>
                <path fill="${lite}" opacity="0.5" d="M 82 62 C 90 55 102 55 108 61 M 112 60 C 120 60 126 66 128 73"/>`,
      };
    case 'bobFringe': // Kleopatra: strenger Bob + gerader Pony
      return {
        back: `<path fill="${c}" d="M 63 132 L 63 84 C 63 58 80 46 100 46 C 120 46 137 58 137 84 L 137 132 C 137 138 127 140 124 134 L 124 96 L 76 96 L 76 134 C 73 140 63 138 63 132 Z"/>`,
        front: `<path fill="${c}" d="M 66 78 C 66 56 82 47 100 47 C 118 47 134 56 134 78 L 134 82 C 124 78 118 70 116 64 C 108 70 92 70 84 64 C 82 70 76 78 66 82 Z"/>`,
      };
    case 'bobSide': // Chanel / Jeanne: Bob mit Seitenscheitel
      return {
        back: `<path fill="${c}" d="M 64 124 L 64 84 C 64 58 80 46 100 46 C 120 46 136 58 136 84 L 136 124 C 136 132 124 133 122 126 L 122 92 L 78 92 L 78 126 C 76 133 64 132 64 124 Z"/>`,
        front: `<path fill="${c}" d="M 66 84 C 64 58 82 46 100 46 C 118 46 136 58 134 84 C 128 72 122 66 112 62 C 96 70 78 72 72 78 C 69 80 67 82 66 84 Z"/>
                <path fill="${dark}" opacity="0.3" d="M 110 62 C 100 68 86 70 76 75"/>`,
      };
    case 'bun': // Curie: streng zurueck, Dutt oben
      return {
        back: `<circle cx="100" cy="46" r="13" fill="${c}"/><circle cx="100" cy="44" r="9" fill="${lite}" opacity="0.4"/>
               <path fill="${c}" d="M 64 96 C 60 62 78 45 100 45 C 122 45 140 62 136 96 C 133 84 130 78 127 76 L 73 76 C 70 78 67 84 64 96 Z"/>`,
        front: `<path fill="${c}" d="M 66 82 C 66 58 82 47 100 47 C 118 47 134 58 134 82 C 128 68 116 61 100 61 C 84 61 72 68 66 82 Z"/>
                <path fill="${dark}" opacity="0.35" d="M 100 48 L 100 60 M 88 50 C 84 54 80 58 76 66 M 112 50 C 116 54 120 58 124 66"/>`,
      };
    case 'long': // da Vinci / Lakshmibai: lang bis auf die Schultern
      return {
        back: `<path fill="${c}" d="M 60 150 C 54 120 56 86 62 72 C 70 50 130 50 138 72 C 144 86 146 120 140 150 C 134 158 120 158 118 150 L 118 100 L 82 100 L 82 150 C 80 158 66 158 60 150 Z"/>`,
        front: `<path fill="${c}" d="M 66 88 C 64 60 82 47 100 47 C 118 47 136 60 134 88 C 128 72 118 64 100 64 C 82 64 72 72 66 88 Z"/>`,
      };
    case 'shortFringe': // Napoleon: kurz, glatt in die Stirn gekaemmt
      return {
        back: `<path fill="${c}" d="M 64 92 C 60 60 78 45 100 45 C 122 45 140 60 136 92 C 133 80 130 72 127 70 L 73 70 C 70 72 67 80 64 92 Z"/>`,
        front: `<path fill="${c}" d="M 66 82 C 66 56 82 46 100 46 C 118 46 134 56 134 82 C 129 71 124 67 116 68 Q 108 61 101 66 Q 92 60 84 68 C 77 69 70 75 66 82 Z"/>`,
      };
    case 'short': // Lincoln u. a.: kurzes volles Haar
      return {
        back: `<path fill="${c}" d="M 63 96 C 58 58 78 44 100 44 C 122 44 142 58 137 96 C 134 82 131 74 128 72 L 72 72 C 69 74 66 82 63 96 Z"/>`,
        front: `<path fill="${c}" d="M 65 82 C 64 54 82 45 100 45 C 118 45 136 54 135 82 C 128 66 120 62 108 63 C 96 58 78 62 72 70 C 69 73 67 77 65 82 Z"/>`,
      };
    case 'crop': // Musk: volles, kurzes dunkles Haar mit Volumen am Oberkopf,
      // weich gerundeter Ansatz, vorne leicht hochgebuerstete Tolle (Quiff).
      return {
        back: `<path fill="${c}" d="M 65 88 C 59 50 80 38 100 38 C 120 38 141 50 135 88 C 132 78 129 71 126 69 L 74 69 C 71 71 68 78 65 88 Z"/>`,
        front: `<path fill="${c}" d="M 64 82
                  C 61 68 62 46 76 40
                  C 87 34.5 114 35 125 40
                  C 138 46 139 68 136 82
                  C 133 80 132 77 131.5 74
                  C 131 66 128 61 122 59.5
                  C 116 58.8 110 58.8 104 59.2
                  C 98 59.6 92 59 88.5 57
                  C 86 52.5 81.5 51.5 78.5 55
                  C 74 57.5 70.5 62.5 69.5 68
                  C 68.5 73 67 78 65.5 80.5
                  C 65 81 64.5 81.5 64 82 Z"/>
                <path fill="none" stroke="${dark}" stroke-width="1.3" opacity="0.26" d="M 78 56 C 82 49 88 45 95 44 M 100 58 C 104 52 110 49 116 49 M 122 59 C 126 55 130 54 133 55"/>
                <path fill="none" stroke="${lite}" stroke-width="1.1" opacity="0.35" d="M 84 48 C 90 43 98 41.5 106 43"/>`,
      };
    case 'slick': // Tesla: dunkel, streng mit Scheitel
      return {
        back: `<path fill="${c}" d="M 64 90 C 61 58 80 45 100 45 C 120 45 139 58 136 90 C 133 78 130 72 127 70 L 73 70 C 70 72 67 78 64 90 Z"/>`,
        front: `<path fill="${c}" d="M 66 78 C 66 55 82 46 100 46 C 118 46 134 55 134 78 C 128 66 120 62 110 63 L 92 60 C 82 62 70 68 66 78 Z"/>
                <path fill="${lite}" opacity="0.4" d="M 92 60 C 98 58 106 59 110 62"/>`,
      };
    case 'balding': // Shakespeare & Co.: hohe Stirn, Haar seitlich am Kopf
      return {
        back: `<path fill="${c}" d="M 60 102 C 58 92 59 82 64 76 C 66 86 70 96 76 102 C 80 110 72 116 65 111 C 62 109 61 106 60 102 Z M 140 102 C 142 92 141 82 136 76 C 134 86 130 96 124 102 C 120 110 128 116 135 111 C 138 109 139 106 140 102 Z"/>`,
        front: '',
      };
    case 'sweep': // Kalam: silbern, nach hinten geschwungen, voluminoes
      return {
        back: `<path fill="${c}" d="M 62 104 C 54 78 64 48 84 46 C 92 40 112 40 120 46 C 140 48 150 78 138 104 C 136 92 134 84 130 80 C 134 66 124 54 112 56 C 104 50 90 52 86 58 C 74 58 66 70 70 82 C 66 86 64 94 62 104 Z"/>`,
        front: `<path fill="${c}" d="M 65 84 C 63 62 78 48 96 48 C 110 44 128 52 132 66 C 134 72 134 78 133 84 C 128 70 118 63 106 64 C 94 60 78 66 72 74 C 68 76 66 80 65 84 Z"/>
                <path fill="${lite}" opacity="0.5" d="M 74 70 C 82 62 96 58 106 62 M 110 63 C 120 63 128 70 131 78"/>`,
      };
    case 'updo': // Frida: Mittelscheitel + geflochtene Krone
      return {
        back: `<path fill="${c}" d="M 64 98 C 60 64 78 46 100 46 C 122 46 140 64 136 98 C 133 84 130 76 127 74 L 73 74 C 70 76 67 84 64 98 Z"/>`,
        front: `<path fill="${c}" d="M 66 84 C 66 58 82 47 100 47 C 118 47 134 58 134 84 C 128 68 116 62 101.5 62 L 98.5 62 C 84 62 72 68 66 84 Z"/>
                <path fill="${dark}" d="M 100 47 L 100 61" stroke="${dark}" stroke-width="1.6"/>
                <path fill="none" stroke="${dark}" stroke-width="7" stroke-linecap="round" d="M 74 56 C 84 48 116 48 126 56"/>
                <path fill="none" stroke="${lite}" stroke-width="1.4" opacity="0.6" d="M 78 54 L 82 58 M 86 51 L 90 55 M 95 49 L 98 54 M 104 49 L 106 54 M 112 51 L 115 55 M 120 54 L 123 58"/>`,
      };
    case 'sides': // Picasso: kahl, weisses Haar nur an den Seiten
      return {
        back: `<path fill="${c}" d="M 63 104 C 61 96 62 88 66 84 C 68 94 70 100 74 106 C 76 112 70 114 66 110 Z M 137 104 C 139 96 138 88 134 84 C 132 94 130 100 126 106 C 124 112 130 114 134 110 Z"/>`,
        front: '',
      };
    case 'bald':
    default:
      return { back: '', front: '' };
  }
}

// ------------------------------------------------------------------ Baerte

function facialBackSVG(p: Portrait): string {
  if (!p.facial) return '';
  const c = p.facial.color;
  const lite = shade(c, 0.14);
  switch (p.facial.style) {
    case 'full': // voller Bart bis unters Kinn
      return `<path fill="${c}" d="M 68 96 C 66 118 72 142 84 150 C 92 156 108 156 116 150 C 128 142 134 118 132 96 C 128 104 124 108 120 110 L 120 118 C 120 128 112 132 100 132 C 88 132 80 128 80 118 L 80 110 C 76 108 72 104 68 96 Z"/>
              <path fill="${lite}" opacity="0.4" d="M 76 116 C 76 130 82 142 90 147 M 124 116 C 124 130 118 142 110 147"/>`;
    case 'long': // langer Gelehrtenbart (da Vinci)
      return `<path fill="${c}" d="M 68 96 C 64 124 70 158 84 172 C 92 180 108 180 116 172 C 130 158 136 124 132 96 C 128 104 124 108 120 110 L 120 118 C 120 128 112 132 100 132 C 88 132 80 128 80 118 L 80 110 C 76 108 72 104 68 96 Z"/>
              <path fill="${lite}" opacity="0.4" d="M 78 120 C 76 140 82 160 90 168 M 122 120 C 124 140 118 160 110 168"/>`;
    case 'chinstrap': // Lincoln: Backen-/Kinnbart ohne Schnurrbart
      return `<path fill="${c}" d="M 67 92 C 66 112 72 132 84 142 C 92 148 108 148 116 142 C 128 132 134 112 133 92 C 130 102 127 108 123 112 C 124 122 116 130 100 130 C 84 130 76 122 77 112 C 73 108 70 102 67 92 Z"/>`;
    case 'goatee':
    case 'vandyke':
      return `<path fill="${c}" d="M 89 128 C 90 136 94 141 100 141 C 106 141 110 136 111 128 C 107 131 93 131 89 128 Z"/>`;
    default:
      return '';
  }
}

// Schnurrbart liegt VOR dem Mund (oberhalb der Oberlippe).
function mustacheSVG(p: Portrait): string {
  if (!p.facial) return '';
  const c = p.facial.color;
  switch (p.facial.style) {
    case 'walrus': // Einstein: dicht, haengend, Mitte frei fuer den Mund
      return `<path fill="${c}" d="M 100 106 C 90 104 82 106 78 112 C 74 118 76 124 80 126 C 84 128 90 126 94 121 Q 97 117 100 117 Q 103 117 106 121 C 110 126 116 128 120 126 C 124 124 126 118 122 112 C 118 106 110 104 100 106 Z"/>`;
    case 'mustache': // schmal-markant (Tesla, Dumont)
      return `<path fill="${c}" d="M 100 108.5 C 93 106.5 87 108 84.5 111.5 C 88 114 94 114.5 98 112 Q 100 110.8 102 112 C 106 114.5 112 114 115.5 111.5 C 113 108 107 106.5 100 108.5 Z"/>`;
    case 'vandyke':
    case 'goatee':
      return `<path fill="${c}" d="M 100 108 C 94 106 88 107.5 86 110.5 C 90 113 95 113 98.5 111 Q 100 110 101.5 111 C 105 113 110 113 114 110.5 C 112 107.5 106 106 100 108 Z"/>`;
    case 'full':
    case 'long':
      return `<path fill="${c}" d="M 100 107 C 92 105 85 107 82 111 C 86 115 93 115.5 98 112.5 Q 100 111.4 102 112.5 C 107 115.5 114 115 118 111 C 115 107 108 105 100 107 Z"/>`;
    default:
      return '';
  }
}

// ------------------------------------------------------------- Kopfschmuck

function headwearSVG(p: Portrait): string {
  const hc = p.headwearColor ?? '#26262b';
  switch (p.headwear) {
    case 'bicorne': // Napoleon: breiter, flacher Zweispitz mit seitlichen Spitzen
      return `<path fill="${hc}" stroke="rgba(255,255,255,0.22)" stroke-width="1.2" d="M 34 66 C 48 46 80 39 100 39 C 120 39 152 46 166 66 C 168 69 165 72 161 70 C 144 58 121 54 100 54 C 79 54 56 58 39 70 C 35 72 32 69 34 66 Z"/>
              <path fill="none" stroke="${shade(hc, 0.55)}" stroke-width="1.2" opacity="0.8" d="M 42 61 C 58 47 82 42 100 42 C 118 42 142 47 158 61"/>
              <circle cx="100" cy="47" r="3.8" fill="#c8a24a"/><circle cx="100" cy="47" r="1.7" fill="#8f2f36"/>`;
    case 'tophat': // Lincoln
      return `<path fill="${hc}" d="M 74 58 L 74 16 C 74 12 126 12 126 16 L 126 58 Z"/>
              <rect x="58" y="54" width="84" height="7" rx="3.5" fill="${hc}"/>
              <rect x="74" y="46" width="52" height="7" fill="${shade(hc, 0.18)}"/>`;
    case 'flowers': { // Frida
      const f = (x: number, y: number, r: number, col: string) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/><circle cx="${x}" cy="${y}" r="${r * 0.42}" fill="${shade(col, 0.45)}"/>`;
      return `${f(78, 52, 7, '#c2455a')}${f(92, 46, 8, '#d4694a')}${f(108, 45, 7.5, '#b83a6e')}${f(122, 51, 7, '#cf8a3a')}
              <circle cx="86" cy="56" r="3" fill="#4a7a4a"/><circle cx="115" cy="54" r="3" fill="#4a7a4a"/>`;
    }
    case 'diadem': // Kleopatra: Goldreif mit Uraeus-Andeutung
      return `<path fill="none" stroke="#d4af37" stroke-width="4" d="M 66 72 C 78 64 122 64 134 72"/>
              <path fill="#d4af37" d="M 96 60 Q 100 50 104 60 Q 100 66 96 60 Z"/>`;
    case 'panama': // Santos Dumont
      return `<ellipse cx="100" cy="58" rx="46" ry="10" fill="${shade(hc, 0.5)}"/>
              <path fill="${shade(hc, 0.62)}" d="M 72 58 C 72 36 128 36 128 58 C 118 63 82 63 72 58 Z"/>
              <path fill="${hc}" d="M 72 56 C 72 50 128 50 128 56 C 118 60 82 60 72 56 Z"/>`;
    case 'fruit': { // Carmen Miranda: Turban + Fruechte
      const t = p.headwearColor ?? '#c23a4a';
      return `<path fill="${t}" d="M 64 70 C 62 48 80 36 100 36 C 120 36 138 48 136 70 C 124 60 76 60 64 70 Z"/>
              <path fill="none" stroke="${shade(t, -0.25)}" stroke-width="2" d="M 70 58 C 84 48 116 48 130 58 M 78 50 C 90 43 110 43 122 50"/>
              <circle cx="84" cy="34" r="6.5" fill="#d8b23a"/><circle cx="98" cy="29" r="7" fill="#b83a3a"/><circle cx="113" cy="33" r="6.5" fill="#7a9a3a"/>
              <path fill="#e8cf6a" d="M 120 28 C 126 22 134 22 138 28 C 132 30 124 31 120 28 Z"/>
              <circle cx="90" cy="24" r="4.5" fill="#8a5a9a"/><circle cx="106" cy="22" r="4.5" fill="#c2455a"/>`;
    }
    case 'beret': // da Vinci
      return `<path fill="${hc}" d="M 62 66 C 58 44 82 34 100 34 C 118 34 142 44 138 66 C 124 56 76 56 62 66 Z"/>
              <path fill="${shade(hc, -0.2)}" d="M 64 66 C 76 58 124 58 136 66 C 124 62 76 62 64 66 Z"/>`;
    case 'strawhat': // van Gogh
      return `<ellipse cx="100" cy="60" rx="52" ry="11" fill="#d8b45a"/>
              <ellipse cx="100" cy="57.5" rx="52" ry="11" fill="#e5c876"/>
              <path fill="#e5c876" d="M 72 58 C 72 38 128 38 128 58 C 116 62 84 62 72 58 Z"/>
              <path fill="#b0813a" d="M 72 56 C 72 51 128 51 128 56 C 116 59 84 59 72 56 Z"/>`;
    case 'sariveil': { // Lakshmibai: Sari-Tuch ueber dem Hinterkopf
      const s = p.headwearColor ?? '#8f2f36';
      return `<path fill="${s}" d="M 58 130 C 52 84 66 44 100 44 C 134 44 148 84 142 130 C 138 138 130 138 128 130 C 132 92 124 60 100 60 C 76 60 68 92 72 130 C 70 138 62 138 58 130 Z"/>
              <path fill="none" stroke="#d4af37" stroke-width="2" d="M 70 100 C 66 76 76 54 100 54 C 124 54 134 76 130 100"/>`;
    }
    default:
      return '';
  }
}

// ------------------------------------------------------------------ Kleidung
// Schultern/Oberkoerper unterhalb des Kopfes; einfacher Bogen + Stil-Details.

function clothesSVG(p: Portrait): string {
  const { style, color } = p.clothes;
  const c2 = p.clothes.color2 ?? shade(color, 0.3);
  const dark = shade(color, -0.25);
  // Grund-Silhouette der Schultern
  const base = (fill: string) =>
    `<path fill="${fill}" d="M 22 200 L 22 178 C 26 154 52 142 76 138 L 88 134 L 112 134 L 124 138 C 148 142 174 154 178 178 L 178 200 Z"/>`;
  switch (style) {
    case 'suit':
      return `${base(color)}
        <path fill="#e8e4dc" d="M 87 133 L 100 162 L 113 133 C 106 137 94 137 87 133 Z"/>
        <path fill="${dark}" d="M 88 134 L 74 140 C 82 152 90 160 96 164 L 100 156 Z M 112 134 L 126 140 C 118 152 110 160 104 164 L 100 156 Z"/>
        ${p.clothes.neck === 'bow'
          ? '<path fill="#1d1d22" d="M 100 152 L 88 146 L 88 158 Z M 100 152 L 112 146 L 112 158 Z"/><circle cx="100" cy="152" r="2.6" fill="#1d1d22"/>'
          : p.clothes.neck === 'cravat'
            ? '<path fill="#ded8ca" d="M 94 140 C 96 150 104 150 106 140 L 104 162 Q 100 168 96 162 Z"/>'
            : p.clothes.neck === 'tie'
              ? `<path fill="${c2}" d="M 97 144 L 103 144 L 102 166 L 100 170 L 98 166 Z"/>`
              : ''}`;
    case 'highcollar': // Tesla/Dumont: hoher weisser Kragen
      return `${base(color)}
        <path fill="#eceadf" d="M 86 132 L 114 132 L 112 148 L 88 148 Z"/>
        <path fill="${dark}" d="M 86 133 L 72 140 C 80 150 88 156 94 160 L 90 148 Z M 114 133 L 128 140 C 120 150 112 156 106 160 L 110 148 Z"/>
        <path fill="${c2}" d="M 96 148 L 104 148 L 102 160 L 98 160 Z"/>`;
    case 'ruff': // Halskrause (Shakespeare, Cervantes)
      return `${base(color)}
        <path fill="#efece2" d="M 62 140 Q 68 130 76 136 Q 80 126 90 132 Q 96 124 104 130 Q 112 124 118 132 Q 126 128 130 136 Q 138 132 138 142 Q 130 150 118 150 Q 108 154 92 152 Q 76 152 68 148 Q 62 146 62 140 Z"/>
        <path fill="none" stroke="#c9c4b2" stroke-width="1.3" d="M 70 140 Q 84 146 100 146 Q 116 146 130 140"/>`;
    case 'toga':
      return `${base('#d8d2c2')}
        <path fill="#c4bda8" d="M 60 200 L 118 138 C 126 140 134 144 140 150 L 92 200 Z"/>
        <path fill="${shade('#d8d2c2', 0.2)}" d="M 88 134 L 100 152 L 112 134 L 110 146 L 100 164 L 90 146 Z"/>`;
    case 'uniform': // Napoleon
      return `${base(color)}
        <path fill="#e8e4d8" d="M 89 133 L 100 158 L 111 133 C 105 137 95 137 89 133 Z"/>
        <path fill="${dark}" d="M 90 134 L 76 140 L 92 168 L 96 160 Z M 110 134 L 124 140 L 108 168 L 104 160 Z"/>
        <circle cx="100" cy="164" r="1.7" fill="#c8a24a"/><circle cx="100" cy="172" r="1.7" fill="#c8a24a"/><circle cx="100" cy="180" r="1.7" fill="#c8a24a"/>
        <path fill="#c8a24a" d="M 24 168 C 30 156 44 148 60 144 L 68 142 L 72 152 L 62 156 C 48 160 34 166 28 174 Z M 176 168 C 170 156 156 148 140 144 L 132 142 L 128 152 L 138 156 C 152 160 166 166 172 174 Z"/>`;
    case 'dress': // Monroe u. a.: Neckholder + freie Schultern
      return `<path fill="${p.skin}" d="M 30 200 L 30 184 C 38 162 62 148 84 142 L 116 142 L 138 142 C 160 148 166 162 170 184 L 170 200 Z"/>
        <path fill="${shade(p.skin, -0.14)}" d="M 84 142 C 92 148 108 148 116 142 L 112 134 L 88 134 Z"/>
        <path fill="${color}" d="M 84 143 L 100 200 L 62 200 C 66 176 72 156 84 143 Z M 116 143 L 100 200 L 138 200 C 134 176 128 156 116 143 Z"/>
        <path fill="${shade(color, 0.25)}" d="M 84 143 L 100 200 L 116 143 L 110 158 L 100 186 L 90 158 Z"/>`;
    case 'armor': // Jeanne d'Arc
      return `${base('#8f99a4')}
        <path fill="#a8b2bd" d="M 30 176 C 40 156 60 146 80 140 L 78 158 C 60 162 44 170 38 182 Z M 170 176 C 160 156 140 146 120 140 L 122 158 C 140 162 156 170 162 182 Z"/>
        <path fill="#7a848f" d="M 86 134 L 114 134 L 112 150 C 106 154 94 154 88 150 Z"/>
        <path fill="none" stroke="#66707a" stroke-width="1.6" d="M 66 158 C 80 166 120 166 134 158 M 60 174 C 78 184 122 184 140 174"/>`;
    case 'breton': // Picasso
      return `${base('#20303f')}
        <path fill="#e8e4dc" d="M 88 134 C 92 140 108 140 112 134 L 114 142 C 106 148 94 148 86 142 Z"/>
        <path fill="none" stroke="#e8e4dc" stroke-width="4" d="M 30 176 C 52 158 148 158 170 176 M 26 190 C 50 170 150 170 174 190 M 42 162 C 64 148 136 148 158 162"/>`;
    case 'shawl': // Gandhi: weisses Tuch
      return `${base('#eceadf')}
        <path fill="#dcd8c8" d="M 60 200 L 116 140 C 124 142 132 146 138 152 L 92 200 Z"/>
        <path fill="${shade(p.skin, -0.06)}" d="M 88 134 C 92 142 108 142 112 134 L 110 148 C 104 152 96 152 90 148 Z"/>`;
    case 'blouse': // Frida / Carmen: Bluse + Farbborte
      return `${base(color)}
        <path fill="${c2}" d="M 84 138 C 92 146 108 146 116 138 L 120 146 C 108 156 92 156 80 146 Z"/>
        <path fill="none" stroke="${shade(color, 0.4)}" stroke-width="2.4" d="M 40 172 C 62 156 138 156 160 172 M 52 160 C 72 148 128 148 148 160"/>`;
    case 'sari': // Lakshmibai: Drapierung mit Goldborte
      return `${base(color)}
        <path fill="${shade(color, -0.18)}" d="M 56 200 L 124 136 C 134 140 144 146 150 154 L 96 200 Z"/>
        <path fill="none" stroke="#d4af37" stroke-width="2.6" d="M 60 196 L 126 138 M 68 200 L 132 144"/>`;
    case 'tee': // Musk: schlichtes Crew-Neck-T-Shirt — Ausschnitt zeigt etwas
      // Halsansatz, darunter ein duenner Ripp-Kragen als Naht.
      return `${base(color)}
        <path fill="${shade(p.skin, -0.12)}" d="M 86 128 C 90 133.5 110 133.5 114 128 L 116.5 141 C 109 149.5 91 149.5 83.5 141 Z"/>
        <path fill="none" stroke="${shade(color, 0.22)}" stroke-width="3" stroke-linecap="round" d="M 83.5 141 C 91 149.5 109 149.5 116.5 141"/>
        <path fill="none" stroke="${dark}" stroke-width="1.4" opacity="0.7" d="M 58 148 C 56 160 55 174 55 188 M 142 148 C 144 160 145 174 145 188"/>`;
    case 'robe': // Gelehrtenrobe (Galileo, Sokrates-Alternative)
      return `${base(color)}
        <path fill="#e2ddcd" d="M 90 134 L 100 150 L 110 134 L 108 144 L 100 158 L 92 144 Z"/>
        <path fill="${dark}" d="M 96 150 L 104 150 L 103 200 L 97 200 Z"/>`;
    default:
      return base(color);
  }
}

function jewelrySVG(p: Portrait): { head: string; body: string } {
  let head = '';
  let body = '';
  for (const j of p.jewelry ?? []) {
    switch (j) {
      case 'pearls':
        body += `<g fill="#ece7da">${[-18, -12, -6, 0, 6, 12, 18]
          .map((x) => `<circle cx="${100 + x}" cy="${148 + Math.abs(x) * -0.25 + 4}" r="2.6"/>`)
          .join('')}</g>`;
        break;
      case 'earrings': {
        const ex = 33 * (p.faceW ?? 1) + 4;
        head += `<circle cx="${100 - ex}" cy="102" r="2.8" fill="#d4af37"/><circle cx="${100 + ex}" cy="102" r="2.8" fill="#d4af37"/>`;
        break;
      }
      case 'hoops': {
        const ex = 33 * (p.faceW ?? 1) + 4;
        head += `<circle cx="${100 - ex}" cy="104" r="5" fill="none" stroke="#d4af37" stroke-width="1.8"/><circle cx="${100 + ex}" cy="104" r="5" fill="none" stroke="#d4af37" stroke-width="1.8"/>`;
        break;
      }
      case 'nosering':
        head += `<circle cx="105.5" cy="103" r="3.2" fill="none" stroke="#d4af37" stroke-width="1.4"/>`;
        break;
      case 'bindi':
        head += `<circle cx="100" cy="72" r="2.2" fill="#b03040"/>`;
        break;
      case 'tikka':
        head += `<path fill="none" stroke="#d4af37" stroke-width="1.4" d="M 100 50 L 100 66"/><circle cx="100" cy="68" r="3" fill="#d4af37"/><circle cx="100" cy="68" r="1.4" fill="#8f2f36"/>`;
        break;
      case 'goldcollar':
        body += `<path fill="#d4af37" d="M 74 138 C 84 150 116 150 126 138 L 130 148 C 116 162 84 162 70 148 Z"/>
                 <path fill="none" stroke="#a8842a" stroke-width="1.4" d="M 76 144 C 88 154 112 154 124 144"/>`;
        break;
    }
  }
  return { head, body };
}

function glassesSVG(p: Portrait): string {
  if (!p.glasses || p.glasses === 'none') return '';
  const r = p.glasses === 'round' ? 9.5 : 7.5;
  const y = 84;
  return `<g fill="none" stroke="#3a3a40" stroke-width="1.8" opacity="0.92">
    <circle cx="86" cy="${y}" r="${r}"/><circle cx="114" cy="${y}" r="${r}"/>
    <path d="M ${86 + r} ${y - 2} Q 100 ${y - 6} ${114 - r} ${y - 2}"/>
    <path d="M ${86 - r} ${y - 2} L ${100 - 33 * (p.faceW ?? 1) - 2} ${y - 4} M ${114 + r} ${y - 2} L ${100 + 33 * (p.faceW ?? 1) + 2} ${y - 4}"/>
    <circle cx="${86 - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" stroke="none" fill="rgba(255,255,255,0.14)"/>
    <circle cx="${114 - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" stroke="none" fill="rgba(255,255,255,0.14)"/>
  </g>`;
}

// --------------------------------------------------------------- SVG-Aufbau

let uid = 0;

function buildSVG(p: Portrait, prefix: string): string {
  const skin = p.skin;
  const skinDark = shade(skin, -0.16);
  const skinLine = shade(skin, -0.38);
  const hw = 33 * (p.faceW ?? 1);
  const hair = hairSVG(p);
  const jew = jewelrySVG(p);
  const brow = p.browColor ?? p.hair.color;
  const bw = p.browW ?? 1;
  const ba = p.browAngle ?? 0;
  const eyeC = p.eyeColor ?? '#5b4632';
  const ear = p.earSize ?? 1;

  // Brauen als gefuellte Boegen; Winkel > 0 = aussen abfallend (freundlich)
  const browPath = (sx: number) =>
    `<path class="av-brow" fill="${brow}" transform="rotate(${ba * sx} ${100 + 14 * sx} 74)"
       d="M ${100 + (14 - 10 * bw) * sx} 76 Q ${100 + 14 * sx} ${74 - 3.4 * bw} ${100 + (14 + 10 * bw) * sx} 75
          L ${100 + (14 + 10 * bw) * sx} ${75 + 2 * bw} Q ${100 + 14 * sx} ${74 - 3.4 * bw + 2.6 * bw} ${100 + (14 - 10 * bw) * sx} ${76 + 2.2 * bw} Z"/>`;

  const eye = (sx: number) => `
    <g class="av-eye" transform="translate(${100 + 14 * sx} 84)">
      <path fill="#f6f2ea" d="M -8.4 0.4 Q 0 -5.4 8.4 0.4 Q 0 5.6 -8.4 0.4 Z"/>
      <g class="av-pupil">
        <circle r="4.2" cy="0.3" fill="${eyeC}"/>
        <circle r="2.1" cy="0.3" fill="#17151a"/>
        <circle r="0.95" cx="-1.3" cy="-1.1" fill="#fff" opacity="0.9"/>
      </g>
      <path fill="none" stroke="${skinLine}" stroke-width="1.1" d="M -8.4 0.4 Q 0 -5.4 8.4 0.4" opacity="0.55"/>
      ${p.kohl ? `<path fill="none" stroke="#1d1a20" stroke-width="1.7" d="M -8.4 0.4 Q 0 -5.6 8.4 0.2 L ${12.5 * sx > 0 ? 12.5 : 12.5} -1.6" transform="scale(${sx} 1)"/>` : ''}
    </g>`;

  return `<svg viewBox="0 0 200 200" class="avatar-svg" role="img" aria-hidden="true">
  <defs>
    <radialGradient id="${prefix}-halo" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.34"/>
      <stop offset="55%" stop-color="${p.accent}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#0a0a0c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${prefix}-skin" cx="46%" cy="36%" r="72%">
      <stop offset="0%" stop-color="${shade(skin, 0.1)}"/>
      <stop offset="70%" stop-color="${skin}"/>
      <stop offset="100%" stop-color="${skinDark}"/>
    </radialGradient>
    <clipPath id="${prefix}-frame"><circle cx="100" cy="100" r="99"/></clipPath>
    <clipPath id="${prefix}-mouthclip"><path class="av-mouth-clip" d=""/></clipPath>
  </defs>
  <g clip-path="url(#${prefix}-frame)">
    <rect width="200" height="200" fill="#101013"/>
    <rect width="200" height="200" fill="url(#${prefix}-halo)"/>
    <g class="av-body">
      ${hair.back ? `<g class="av-hairback">${hair.back}</g>` : ''}
      <path fill="${skinDark}" d="M 88 112 L 112 112 L 112 142 C 112 148 88 148 88 142 Z"/>
      ${clothesSVG(p)}
      ${jew.body}
    </g>
    <g class="av-head">
      <ellipse cx="${100 - hw - 2.5}" cy="94" rx="${5.5 * ear}" ry="${9 * ear}" fill="${skin}"/>
      <ellipse cx="${100 + hw + 2.5}" cy="94" rx="${5.5 * ear}" ry="${9 * ear}" fill="${skin}"/>
      <path d="${facePath(p)}" fill="url(#${prefix}-skin)"/>
      <path d="${facePath(p)}" fill="none" stroke="${skinLine}" stroke-width="0.8" opacity="0.35"/>
      ${p.wrinkles ? `<g fill="none" stroke="${skinLine}" stroke-width="1" opacity="0.4">
        <path d="M 88 64 Q 100 61 112 64 M 90 69 Q 100 66.5 110 69"/>
        <path d="M 76 92 L 71 95 M 124 92 L 129 95"/>
        <path d="M 90 122 Q 88 118 88.5 114 M 110 122 Q 112 118 111.5 114"/>
      </g>` : ''}
      ${p.blush ? `<g fill="#d86a5a" opacity="0.13"><ellipse cx="80" cy="102" rx="7" ry="4.4"/><ellipse cx="120" cy="102" rx="7" ry="4.4"/></g>` : ''}
      ${facialBackSVG(p)}
      ${browPath(-1)}${browPath(1)}
      ${p.unibrow ? `<path fill="${brow}" d="M 92 74.5 Q 100 71.5 108 74.5 L 108 76.5 Q 100 74 92 76.5 Z"/>` : ''}
      ${eye(-1)}${eye(1)}
      <g class="av-lids">
        <path class="av-lid" fill="${skin}" d="M 77.6 84 Q 86 78 94.4 84 Q 86 79 77.6 84 Z"/>
        <path class="av-lid" fill="${skin}" d="M 105.6 84 Q 114 78 122.4 84 Q 114 79 105.6 84 Z"/>
      </g>
      <path fill="none" stroke="${skinLine}" stroke-width="1.5" stroke-linecap="round" opacity="0.85" d="${nosePath(p)}"/>
      ${p.cleftChin ? `<path fill="none" stroke="${skinLine}" stroke-width="1.2" stroke-linecap="round" opacity="0.45" d="M 100 127 C 99.3 129 99.3 130.5 100 132"/>` : ''}
      ${p.beautyMark ? `<circle cx="112" cy="113" r="1.5" fill="#3a2e28"/>` : ''}
      <g class="av-mouth" transform="translate(100 116)">
        <path class="av-mouth-inner" fill="#2d1418" d=""/>
        <g clip-path="url(#${prefix}-mouthclip)">
          <rect class="av-teeth" x="-12" y="-8" width="24" height="6" fill="#f3eee2"/>
          <ellipse class="av-tongue" cx="0" cy="8" rx="7" ry="4" fill="#a84a52"/>
        </g>
        <path class="av-lip-top" fill="none" stroke="${p.lipColor ?? shade(skin, -0.32)}" stroke-linecap="round" d=""/>
        <path class="av-lip-bot" fill="none" stroke="${p.lipColor ?? shade(skin, -0.32)}" stroke-linecap="round" d=""/>
      </g>
      ${mustacheSVG(p)}
      ${glassesSVG(p)}
      ${jew.head}
      ${hair.front ? `<g class="av-hairfront">${hair.front}</g>` : ''}
      ${headwearSVG(p)}
    </g>
    <ellipse cx="66" cy="46" rx="70" ry="52" fill="#ffffff" opacity="0.05"/>
    <circle cx="100" cy="100" r="99" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.5"/>
  </g>
</svg>`;
}

// Statisches Portraet (Galerie-Karten): neutraler, freundlicher Ausdruck.
export function portraitSVG(p: Portrait): string {
  const prefix = `avs${++uid}`;
  const holder = document.createElement('div');
  holder.innerHTML = buildSVG(p, prefix);
  const svg = holder.firstElementChild as SVGSVGElement;
  poseMouth(svg, p, 0, 0.5, p.smile ?? 0.5);
  return holder.innerHTML;
}

// Mundform aus (Oeffnung, Breite, Laecheln) -> Pfade setzen.
// open 0..1, wide 0..1 (0 = rund/o, 1 = breit/e), smile 0..1
function poseMouth(root: SVGElement | HTMLElement, p: Portrait, open: number, wide: number, smile: number) {
  const lf = p.lipFull ?? 0.35;
  const w = 13.5 * (0.82 + wide * 0.36) * (0.94 + (p.faceW ?? 1) * 0.06);
  const h = open * (13 + (1 - wide) * 4.5);
  const c = -smile * 2.6 + open * 1.2;
  const o2 = Math.min(1, open * 3);
  const cTop = c - (1.6 + h * 0.45) * o2;
  const cBot = c + (1.6 + h * 0.62) * o2;
  const inner = o2 <= 0.02
    ? ''
    : `M ${-w} ${c} Q ${-w * 0.45} ${cTop} 0 ${cTop} Q ${w * 0.45} ${cTop} ${w} ${c} Q ${w * 0.45} ${cBot} 0 ${cBot} Q ${-w * 0.45} ${cBot} ${-w} ${c} Z`;

  const q = (sel: string) => root.querySelector<SVGPathElement>(sel);
  q('.av-mouth-inner')?.setAttribute('d', inner);
  q('.av-mouth-clip')?.setAttribute('d', inner);

  // Zaehne oben, Zunge unten — nur bei deutlich geoeffnetem Mund sichtbar
  const teeth = root.querySelector<SVGRectElement>('.av-teeth');
  if (teeth) {
    teeth.setAttribute('x', String(-w * 0.82));
    teeth.setAttribute('width', String(w * 1.64));
    teeth.setAttribute('y', String(cTop - 0.5));
    teeth.setAttribute('height', String(Math.max(0, h * 0.34 + 1.4)));
  }
  const tongue = root.querySelector<SVGEllipseElement>('.av-tongue');
  if (tongue) {
    tongue.setAttribute('cy', String(cBot - h * 0.2));
    tongue.setAttribute('rx', String(w * 0.5));
    tongue.setAttribute('ry', String(Math.max(0, h * 0.3)));
    tongue.setAttribute('opacity', h > 7 ? '1' : '0');
  }

  // Lippen: Kontur ueber/unter der Oeffnung; geschlossen = Lippenlinie
  const bow = 1.1 + lf * 1.2; // Amorbogen-Tiefe
  const top = `M ${-w} ${c} Q ${-w * 0.5} ${cTop - bow} ${-w * 0.16} ${cTop - bow * 0.55} Q 0 ${cTop + 0.4} ${w * 0.16} ${cTop - bow * 0.55} Q ${w * 0.5} ${cTop - bow} ${w} ${c}`;
  const bot = `M ${-w} ${c} Q 0 ${cBot + 1.2 + lf * 2.4} ${w} ${c}`;
  const lt = q('.av-lip-top');
  const lb = q('.av-lip-bot');
  if (lt) {
    lt.setAttribute('d', top);
    lt.setAttribute('stroke-width', String(1.7 + lf * 1.6));
  }
  if (lb) {
    lb.setAttribute('d', bot);
    lb.setAttribute('stroke-width', String(2 + lf * 2.6));
  }
}

// ------------------------------------------------------------ Animations-Rig

export class AvatarStage {
  private host: HTMLElement;
  private root: HTMLDivElement;
  private svg: SVGSVGElement | null = null;
  private portrait: Portrait | null = null;
  private getSpeech: () => SpeechLevels;
  private state: AvatarState = 'idle';
  private micLevel = 0;

  private raf = 0;
  private running = false;
  private last = 0;
  private t = 0;

  // Geglaettete Animationswerte
  private open = 0;
  private wide = 0.5;
  private smile = 0.4;
  private browLift = 0;
  private blink = 1; // 1 = offen, 0 = zu
  private nextBlink = 2;
  private px = 0; // Pupillen-Versatz
  private py = 0;
  private lookX = 0;
  private lookY = 0;
  private nextLook = 1.5;

  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(host: HTMLElement, getSpeech: () => SpeechLevels) {
    this.host = host;
    this.getSpeech = getSpeech;
    this.root = document.createElement('div');
    this.root.className = 'avatar-layer';
    this.root.setAttribute('aria-hidden', 'true');
    host.appendChild(this.root);
  }

  setPortrait(p: Portrait | null) {
    if (p === this.portrait) return;
    this.portrait = p;
    if (!p) {
      this.root.innerHTML = '';
      this.svg = null;
      this.host.classList.remove('has-avatar');
      return;
    }
    const prefix = `av${++uid}`;
    this.root.innerHTML = buildSVG(p, prefix);
    this.svg = this.root.querySelector('svg');
    this.host.classList.add('has-avatar');
    this.open = 0;
    this.smile = p.smile ?? 0.4;
    this.pose(0);
  }

  setState(s: AvatarState) {
    this.state = s;
  }

  setMicLevel(v: number) {
    this.micLevel = clamp01(v);
  }

  start() {
    if (this.running) return;
    this.running = true;
    if (this.reduced) {
      this.pose(0);
      return;
    }
    this.last = performance.now();
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.stop();
    this.root.remove();
  }

  private loop = () => {
    this.raf = requestAnimationFrame((now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.step(dt);
      this.pose(this.t);
      if (this.running && document.visibilityState === 'visible' && this.portrait) this.loop();
      else this.raf = 0;
    });
  };

  private step(dt: number) {
    const speaking = this.state === 'speaking';
    const s = speaking ? this.getSpeech() : { rms: 0, centroid: 0 };

    // Mund: schnelle Attack, langsamere Release — wirkt wie echtes Artikulieren
    const targetOpen = speaking ? clamp01(Math.pow(s.rms * 7.5, 0.85)) : 0;
    const k = targetOpen > this.open ? 1 - Math.exp(-dt * 34) : 1 - Math.exp(-dt * 14);
    this.open += (targetOpen - this.open) * k;

    // Mundform aus dem Spektrum: heller Schwerpunkt = breit (i/e/s),
    // dunkler = rund (o/u/m). Traegheit macht daraus fluessige Viseme.
    const targetWide = speaking && s.rms > 0.015 ? clamp01((s.centroid - 0.16) / 0.34) : 0.5;
    this.wide += (targetWide - this.wide) * (1 - Math.exp(-dt * 10));

    // Grundausdruck je Zustand
    const baseSmile = this.portrait?.smile ?? 0.4;
    const targetSmile =
      this.state === 'listening' ? baseSmile + 0.25
      : this.state === 'thinking' || this.state === 'transcribing' ? baseSmile - 0.2
      : speaking ? baseSmile * (1 - this.open * 0.7)
      : baseSmile;
    this.smile += (clamp01(targetSmile) - this.smile) * (1 - Math.exp(-dt * 6));

    // Brauen: heben sich bei Betonung (Pegel-Spitzen) und beim Zuhoeren
    const targetBrow =
      this.state === 'listening' ? 0.5 + this.micLevel * 0.8
      : speaking ? clamp01(this.open - 0.45) * 1.4
      : this.state === 'thinking' ? -0.35
      : 0;
    this.browLift += (targetBrow - this.browLift) * (1 - Math.exp(-dt * 8));

    // Blinzeln: alle 2–6 s, beim Nachdenken haeufiger
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.nextBlink = 2 + Math.random() * (this.state === 'thinking' ? 2 : 4);
      this.blink = -0.35; // kleiner Unterlauf = kurze Schliesszeit
    }
    if (this.blink < 1) this.blink = Math.min(1, this.blink + dt * 9);

    // Blickziel: beim Nachdenken nach oben, sonst kleines Wandern
    this.nextLook -= dt;
    if (this.nextLook <= 0) {
      this.nextLook = 1.2 + Math.random() * 2.6;
      if (this.state === 'thinking') {
        this.lookX = -1.6 - Math.random();
        this.lookY = -1.8 - Math.random();
      } else if (this.state === 'listening' || speaking) {
        this.lookX = (Math.random() - 0.5) * 1.2;
        this.lookY = (Math.random() - 0.5) * 0.8;
      } else {
        this.lookX = (Math.random() - 0.5) * 2.4;
        this.lookY = (Math.random() - 0.5) * 1.6;
      }
    }
    const lk = 1 - Math.exp(-dt * 7);
    this.px += (this.lookX - this.px) * lk;
    this.py += (this.lookY - this.py) * lk;
  }

  private pose(t: number) {
    const svg = this.svg;
    const p = this.portrait;
    if (!svg || !p) return;

    poseMouth(svg, p, this.open, this.wide, this.smile);

    // Kopf: langsames Schwingen + Nicken im Takt des Sprechens
    const speakNod = this.open * 1.1;
    const tilt =
      this.state === 'listening' ? 2.6
      : this.state === 'thinking' ? -2.2
      : Math.sin(t * 0.55) * 1.3;
    const bob = Math.sin(t * 1.7) * 0.7 + speakNod;
    const head = svg.querySelector<SVGGElement>('.av-head');
    head?.setAttribute('transform', `rotate(${tilt.toFixed(2)} 100 110) translate(0 ${bob.toFixed(2)})`);

    // Atmen des Oberkoerpers
    const body = svg.querySelector<SVGGElement>('.av-body');
    body?.setAttribute('transform', `translate(0 ${(Math.sin(t * 1.1) * 0.6).toFixed(2)})`);

    // Lider: blink 1 -> unsichtbar, 0 -> geschlossen (Lid faehrt herunter)
    const lid = clamp01(1 - Math.max(0, this.blink));
    svg.querySelectorAll<SVGPathElement>('.av-lid').forEach((el, i) => {
      const cx = i === 0 ? 86 : 114;
      el.setAttribute('transform', `translate(0 ${(lid * 6.2).toFixed(2)}) scale(1 ${(0.2 + lid * 1.1).toFixed(2)})`);
      el.setAttribute('transform-origin', `${cx} 81`);
      el.setAttribute('opacity', lid < 0.05 ? '0' : '1');
    });

    // Pupillen
    svg.querySelectorAll<SVGGElement>('.av-pupil').forEach((el) => {
      el.setAttribute('transform', `translate(${this.px.toFixed(2)} ${this.py.toFixed(2)})`);
    });

    // Brauen heben/senken
    svg.querySelectorAll<SVGPathElement>('.av-brow').forEach((el) => {
      const base = el.getAttribute('data-tf') ?? el.getAttribute('transform') ?? '';
      if (!el.getAttribute('data-tf')) el.setAttribute('data-tf', base);
      el.setAttribute('transform', `translate(0 ${(-this.browLift * 2.6).toFixed(2)}) ${el.getAttribute('data-tf')}`);
    });
  }
}
