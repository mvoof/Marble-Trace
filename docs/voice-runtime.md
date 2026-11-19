# Voice runtime

## Piper text to speech

Piper 1.5 is installed on demand as the `piper-engine` voice component; it is
not included in the application installer. The pinned files in
`src-tauri/crates/mt-voice/voice-catalog.json` include the embeddable CPython
archive from python.org and Piper's wheel packages from Python Package Index.
The installer verifies each file's SHA-256 before unpacking it into the voice
data folder. Users do not need to install Python separately.

The Rust voice worker starts this portable `python.exe` and calls Piper through
its Python API. It loads the selected voice model once, then stays alive and
accepts synthesis requests over JSON lines. This avoids starting Python and
loading the model again for every engineer reply. Piper writes each reply to a
WAV file for the app's audio output.
