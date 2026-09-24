# LocalSpeech 🗣️

Sprachen sprechen. Frei. Offline. Für immer kostenlos.

LocalSpeech ist eine Sprachlern-Web-App für gesprochene Konversationen mit einem KI-Gesprächspartner – in Englisch, Spanisch, Französisch, Italienisch und Portugiesisch (BR). Spracherkennung, Sprachmodell und Sprachausgabe laufen komplett lokal im Browser: kein Server, kein Konto, kein Tracking.

## Funktionen

- 🔒 **Privat & offline** – die Stimme verlässt nie das Gerät, nach dem einmaligen Modell-Download funktioniert alles ohne Internet
- 💶 **Kostenlos** – kein Abo, keine Kontopflicht
- ⚡ **Hardware-adaptiv** – automatische Modellauswahl je nach Gerät
- ✨ **Legenden-Modus** – Gespräche mit KI-Simulationen historischer Persönlichkeiten sowie fiktiven „Natives“


## Technik

LocalSpeech nutzt Web-Worker und WebAssembly/WebGPU, um Spracherkennung (Whisper), Sprachmodell (Qwen/Granite) und Sprachausgabe (Kokoro) direkt im Browser auszuführen. Details zu den einzelnen Bausteinen befinden sich im Quellcode unter `src/`.


## Lizenz

LocalSpeech steht unter der [GNU General Public License v3.0 oder später](LICENSE). Eine Übersicht der verwendeten Drittanbieter-Lizenzen findet sich unter `public/third-party-licenses.txt` bzw. in der App unter „Lizenzen“.

Copyright © 2026 Chris Velten. Der Name „LocalSpeech“ und das Logo sind hiervon ausgenommen – Marken- und Namensrechte bleiben vorbehalten. 