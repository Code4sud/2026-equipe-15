"""Régénère l'audio FICTIF, hors ligne, avec la bibliothèque système eSpeak NG.

Optionnel : python3 scripts/audio-fictif.py (libespeak-ng nécessaire).
Le site et sa compilation utilisent le WAV déjà présent, sans dépendre de Python.
"""
import ctypes
import ctypes.util
import json
from pathlib import Path
import wave

racine = Path(__file__).resolve().parent.parent
donnees = json.loads((racine / 'src/data/synthese-fictive.json').read_text())
assert donnees['rdv'] == 'Rdv FICTIF'
lib = ctypes.CDLL(ctypes.util.find_library('espeak-ng') or 'libespeak-ng.so.1')
callback_type = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
echantillons = []

@callback_type
def recevoir(wav, taille, evenements):
    if wav and taille:
        echantillons.append(ctypes.string_at(wav, taille * 2))
    return 0

lib.espeak_Initialize.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
lib.espeak_SetSynthCallback.argtypes = [callback_type]
lib.espeak_SetVoiceByName.argtypes = [ctypes.c_char_p]
lib.espeak_Synth.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint, ctypes.c_int,
                            ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p, ctypes.c_void_p]
frequence = lib.espeak_Initialize(2, 0, None, 0)
assert frequence > 0, 'Initialisation audio impossible'
lib.espeak_SetSynthCallback(recevoir)
assert lib.espeak_SetVoiceByName(b'fr') == 0, 'Voix française indisponible'
lib.espeak_SetParameter(1, 155, 0)
texte = '\n\n'.join(p['texte'] for p in donnees['paragraphes']).encode('utf-8')
buffer = ctypes.create_string_buffer(texte)
assert lib.espeak_Synth(buffer, len(texte) + 1, 0, 1, 0, 1, None, None) == 0
lib.espeak_Synchronize()
sortie = racine / 'public/audio/synthese-fictive.wav'
sortie.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(sortie), 'wb') as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(frequence)
    audio.writeframes(b''.join(echantillons))
lib.espeak_Terminate()
print(f'Audio FICTIF généré : {sortie.relative_to(racine)} ({sortie.stat().st_size} octets)')
