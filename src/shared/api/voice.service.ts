import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

import {
  CREW_DOWNLOAD_EVENT,
  CREW_RADIO_EVENT,
} from '@shared/contracts/generated/backend-events';
import type {
  CrewRadioEvent,
  VoiceCrewSettings,
  VoiceDownloadProgress,
  VoiceDraftCheck,
  VoicePackView,
  VoiceRecognisedView,
  VoiceStatus,
} from '@shared/contracts/generated/bindings';

const PACK_EXTENSIONS = ['zip'];
const VOICE_EXTENSIONS = ['onnx'];

/** Starts, reconfigures or stops the backend's voice crew. */
export const configureVoiceCrewSilent = (settings: VoiceCrewSettings): void => {
  invoke('configure_voice_crew', { settings }).catch((error) =>
    console.error('[voice.service] configure_voice_crew failed:', error)
  );
};

export const voiceStatus = (): Promise<VoiceStatus> => invoke('voice_status');

export const installVoiceComponent = (id: string): Promise<void> =>
  invoke('install_voice_component', { id });

export const cancelVoiceDownload = (): Promise<void> =>
  invoke('cancel_voice_download');

export const importVoiceFiles = (id: string, paths: string[]): Promise<void> =>
  invoke('import_voice_files', { id, paths });

export const importCustomVoice = (path: string): Promise<string> =>
  invoke('import_custom_voice', { path });

/** Applies the crew's settings and waits until they are in use. */
export const configureVoiceCrew = (
  settings: VoiceCrewSettings
): Promise<void> => invoke('configure_voice_crew', { settings });

/** Moves the voice folder's contents; empty `folder` is the app's own. */
export const moveVoiceFolder = (folder: string): Promise<void> =>
  invoke('move_voice_folder', { folder });

export const importCustomVoiceFolder = (path: string): Promise<string[]> =>
  invoke('import_custom_voice_folder', { path });

export const removeCustomVoice = (name: string): Promise<void> =>
  invoke('remove_custom_voice', { name });

export const removeVoiceComponent = (id: string): Promise<void> =>
  invoke('remove_voice_component', { id });

export const voicePack = (language: string): Promise<VoicePackView> =>
  invoke('voice_pack', { language });

export const saveVoicePack = (pack: VoicePackView): Promise<VoicePackView> =>
  invoke('save_voice_pack', { pack });

export const checkVoiceDraft = (
  pack: VoicePackView
): Promise<VoiceDraftCheck> => invoke('check_voice_draft', { pack });

export const recogniseVoiceSentence = (
  pack: VoicePackView,
  sentence: string
): Promise<VoiceRecognisedView[]> =>
  invoke('recognise_voice_sentence', { pack, sentence });

export const generateVoiceLines = (language: string): Promise<number> =>
  invoke('generate_voice_lines', { language });

export const previewVoiceLine = (
  language: string,
  key: string,
  index: number
): Promise<void> => invoke('preview_voice_line', { language, key, index });

/** `draft`: the pack being edited, listened for before it is saved. */
export const voiceTestPtt = (
  held: boolean,
  draft: VoicePackView | null
): Promise<void> => invoke('voice_test_ptt', { held, draft });

export const exportVoicePack = (
  language: string,
  path: string
): Promise<void> => invoke('export_voice_pack', { language, path });

export const importVoicePack = (
  language: string,
  path: string
): Promise<void> => invoke('import_voice_pack', { language, path });

export const listenCrewRadio = (
  onEvent: (event: CrewRadioEvent) => void
): Promise<UnlistenFn> =>
  listen<CrewRadioEvent>(CREW_RADIO_EVENT, (event) => onEvent(event.payload));

export const listenCrewDownload = (
  onProgress: (progress: VoiceDownloadProgress) => void
): Promise<UnlistenFn> =>
  listen<VoiceDownloadProgress>(CREW_DOWNLOAD_EVENT, (event) =>
    onProgress(event.payload)
  );

const pickedPaths = (picked: string | string[] | null): string[] => {
  if (picked === null) {
    return [];
  }

  return Array.isArray(picked) ? picked : [picked];
};

export const pickVoiceFiles = async (): Promise<string[]> =>
  pickedPaths(await open({ multiple: true, directory: false }));

export const pickCustomVoice = async (): Promise<string | null> =>
  pickedPaths(
    await open({
      multiple: false,
      filters: [{ name: 'Piper voice', extensions: VOICE_EXTENSIONS }],
    })
  )[0] ?? null;

export const pickVoiceFolder = async (): Promise<string | null> =>
  pickedPaths(await open({ multiple: false, directory: true }))[0] ?? null;

export const pickPackArchive = async (): Promise<string | null> =>
  pickedPaths(
    await open({
      multiple: false,
      filters: [{ name: 'Voice pack', extensions: PACK_EXTENSIONS }],
    })
  )[0] ?? null;

export const pickPackArchiveTarget = (
  language: string
): Promise<string | null> =>
  save({
    defaultPath: `marble-trace-voice-${language}.zip`,
    filters: [{ name: 'Voice pack', extensions: PACK_EXTENSIONS }],
  });

export const revealVoiceFolder = (path: string): Promise<void> =>
  revealItemInDir(path);
