import { makeAutoObservable, reaction, runInAction, toJS } from 'mobx';

import {
  cancelVoiceDownload,
  checkVoiceDraft,
  exportVoicePack,
  generateVoiceLines,
  importCustomVoice,
  configureVoiceCrew,
  importCustomVoiceFolder,
  moveVoiceFolder,
  importVoiceFiles,
  importVoicePack,
  installVoiceComponent,
  listenCrewDownload,
  listenCrewRadio,
  pickCustomVoice,
  pickPackArchive,
  pickPackArchiveTarget,
  pickVoiceFiles,
  pickVoiceFolder,
  previewVoiceLine,
  recogniseVoiceSentence,
  removeCustomVoice,
  removeVoiceComponent,
  revealVoiceFolder,
  saveVoicePack,
  voicePack,
  voiceStatus,
  voiceTestPtt,
} from '@shared/api/voice.service';
import { openExternalLink } from '@shared/api/external-link';
import { getRawVarMeta } from '@shared/api/telemetry.service';
import {
  VOICE_CHAT_MACRO_ACTION,
  VOICE_QUESTION_PREFIX,
} from '@shared/contracts/generated/backend-constants';
import type {
  CrewRadioEvent,
  RawVarMeta,
  VoiceComponentView,
  VoiceDownloadProgress,
  VoiceDraftCheck,
  VoicePackView,
  VoiceQuestionView,
  VoiceRecognisedView,
  VoiceStatus,
  VoiceStep,
  VoiceTemplateCheck,
  VoiceVariantCheck,
} from '@shared/contracts/generated/bindings';
import {
  resolveAppLanguage,
  voiceCrewSettingsOf,
  type AppSettingsStore,
} from '@entities/app-settings/app-settings.store';
import { OVERLAY_VARIABLES, type OverlayVariable } from './sim-values';

interface VoiceCrewDeps {
  appSettings: AppSettingsStore;
}

/** What the test button heard, shown until the next press. */
export interface VoiceTestResult {
  text: string;
  /** The commands it holds, in the order said; empty when none. */
  intents: string[];
  confidence: number;
}

/** A typed sentence and the commands the pack being edited hears in it. */
/** A sentence tried against the pack being edited: typed, or said into the microphone. */
export interface VoiceSentenceTrial {
  sentence: string;
  heard: VoiceRecognisedView[];
  /** How sure the ear was of a spoken sentence; `null` for a typed one. */
  confidence: number | null;
}

/** A pit action a question can carry out, or the chat macro, and its slot. */
export interface StepAction {
  action: string;
  slot: string | null;
}

const CUSTOM_VOICE_PREFIX = 'custom:';
const PIT_ACTION_PREFIX = 'pit.';
/** The slot every number is said with — its words are built in, not edited. */
export const NUMBER_SLOT = 'number';
/** Edits settle this long before the draft is checked again. */
const DRAFT_CHECK_DELAY_MS = 300;
/** A reply variant's status while it has no recording. */
const UNVOICED_STATUS = 'missing';
const CREW_LANGUAGES = ['ru', 'en', 'es', 'zh'] as const;
const FALLBACK_LANGUAGE = 'en';

/**
 * The Crew tab: the downloads, the language pack being edited, the test
 * press. Main window only — the overlays only ever hear the crew.
 */
export class VoiceCrewStore {
  status: VoiceStatus | null = null;
  downloads: Record<string, VoiceDownloadProgress> = {};
  pack: VoicePackView | null = null;
  /** The pack has edits not yet written. */
  dirty = false;
  busy = false;
  lastError: string | null = null;
  lastTest: VoiceTestResult | null = null;
  testing = false;
  /** The test press under way listens for the unsaved edits. */
  testingDraft = false;
  /** The pack being edited, checked: examples, samples, mistakes, conflicts. */
  draftCheck: VoiceDraftCheck | null = null;
  trial: VoiceSentenceTrial | null = null;
  /** The component whose sample is playing. */
  playingSample: string | null = null;
  /** The running sim's own variable list; empty while it is not running. */
  liveVariables: RawVarMeta[] = [];
  /** Sentences and replies edited as blocks; off, as the text they are. */
  blockEditing = true;

  private sampleAudio: HTMLAudioElement | null = null;
  private unlisteners: (() => void)[] = [];
  private draftCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  constructor(private root: VoiceCrewDeps) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** The language the crew speaks, which is the pack the tab edits. */
  get language(): string {
    const settings = this.root.appSettings.appSettings;
    const chosen =
      settings.voiceLanguage === 'app'
        ? resolveAppLanguage(settings.language)
        : settings.voiceLanguage;

    return CREW_LANGUAGES.some((language) => language === chosen)
      ? chosen
      : FALLBACK_LANGUAGE;
  }

  /**
   * The language of the pack being edited. It stays the pack's own while its
   * edits are unsaved, even when the crew's language has moved on.
   */
  get packLanguage(): string {
    return this.pack?.language ?? this.language;
  }

  /** Unsaved edits hold a pack of a language the crew no longer speaks. */
  get packOutdated(): boolean {
    return this.pack !== null && this.pack.language !== this.language;
  }

  get components(): VoiceComponentView[] {
    return this.status?.components ?? [];
  }

  /**
   * The languages there are voices for and how many each has, the crew's
   * own first.
   */
  get voiceLanguages(): { language: string; count: number }[] {
    const counts = new Map<string, number>();

    for (const component of this.components) {
      if (component.kind === 'ttsVoice' && component.language !== null) {
        counts.set(
          component.language,
          (counts.get(component.language) ?? 0) + 1
        );
      }
    }

    return [...counts]
      .map(([language, count]) => ({ language, count }))
      .sort(
        (left, right) =>
          Number(right.language === this.language) -
            Number(left.language === this.language) ||
          left.language.localeCompare(right.language)
      );
  }

  /** What "download the recommended set" fetches for the crew's language. */
  get recommendedMissing(): VoiceComponentView[] {
    return this.components.filter(
      (component) =>
        component.recommended &&
        component.state !== 'installed' &&
        (component.language === null || component.language === this.language)
    );
  }

  get recommendedMissingBytes(): number {
    return this.recommendedMissing.reduce(
      (total, component) => total + component.sizeBytes,
      0
    );
  }

  get ready(): boolean {
    const installed = (kind: string) =>
      this.components.some(
        (component) =>
          component.kind === kind &&
          component.state === 'installed' &&
          (component.language === null || component.language === this.language)
      );

    return (
      installed('ttsEngine') &&
      installed('sttEngine') &&
      installed('sttModel') &&
      (installed('ttsVoice') || (this.status?.customVoices.length ?? 0) > 0)
    );
  }

  /** The voices the crew can speak with in its language. */
  get voiceOptions(): { value: string; label: string }[] {
    const catalogVoices = this.components
      .filter(
        (component) =>
          component.kind === 'ttsVoice' &&
          component.state === 'installed' &&
          component.language === this.language
      )
      .map((component) => ({ value: component.id, label: component.title }));
    const customVoices = (this.status?.customVoices ?? []).map((name) => ({
      value: `${CUSTOM_VOICE_PREFIX}${name}`,
      label: name,
    }));

    return [...catalogVoices, ...customVoices];
  }

  /** What a question's reply may read from the sim: the variables the overlay reads. */
  get simVariables(): OverlayVariable[] {
    return OVERLAY_VARIABLES;
  }

  get simVariablesLive(): boolean {
    return this.liveVariables.length > 0;
  }

  /** Listed variables the running sim lacks for this car; none while it is not running. */
  get missingSimVariables(): Set<string> {
    if (!this.simVariablesLive) {
      return new Set();
    }

    const live = new Set(this.liveVariables.map((variable) => variable.name));

    return new Set(
      OVERLAY_VARIABLES.filter((variable) => !live.has(variable.name)).map(
        (variable) => variable.name
      )
    );
  }

  async loadSimVariables() {
    try {
      const variables = await getRawVarMeta();

      runInAction(() => {
        this.liveVariables = variables;
      });
    } catch (error) {
      console.error('[voice-crew] variable list failed:', error);
    }
  }

  get templateChecks(): Map<string, VoiceTemplateCheck> {
    return new Map(
      (this.draftCheck?.templates ?? []).map((check) => [
        `${check.intent}#${check.index}`,
        check,
      ])
    );
  }

  get variantChecks(): Map<string, VoiceVariantCheck> {
    return new Map(
      (this.draftCheck?.variants ?? []).map((check) => [
        `${check.key}#${check.index}`,
        check,
      ])
    );
  }

  /** Templates and variants in the draft that cannot be read out. */
  get draftErrors(): number {
    const templates = this.draftCheck?.templates ?? [];
    const variants = this.draftCheck?.variants ?? [];

    return [...templates, ...variants].filter((check) => check.error !== null)
      .length;
  }

  /** Saved reply variants with no recording yet: what "generate" would make. */
  get unvoicedLines(): number {
    return (this.pack?.phrases ?? [])
      .flatMap((phrase) => phrase.variants)
      .filter((variant) => variant.status === UNVOICED_STATUS).length;
  }

  /** The voice folder is one the user chose, not the app's own. */
  get customFolder(): boolean {
    return this.root.appSettings.appSettings.voiceFolder !== '';
  }

  get downloading(): boolean {
    return Object.values(this.downloads).some((progress) => !progress.finished);
  }

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    void this.refresh();

    // Edits outlive leaving the tab; coming back must not reload over them.
    if (!this.dirty) {
      void this.loadPack();
    }

    this.keep(
      reaction(
        () => this.language,
        () => {
          if (!this.dirty) {
            void this.loadPack();
          }
        }
      )
    );
    void listenCrewDownload((progress) => this.onDownload(progress)).then(
      (unlisten) => this.keep(unlisten)
    );
    void listenCrewRadio((event) => this.onRadio(event)).then((unlisten) =>
      this.keep(unlisten)
    );
  }

  dispose() {
    this.unlisteners.forEach((unlisten) => unlisten());
    this.unlisteners = [];
    this.started = false;
    this.clearDraftCheckTimer();
    this.stopSample();
  }

  private keep(unlisten: () => void) {
    if (this.started) {
      this.unlisteners.push(unlisten);
    } else {
      unlisten();
    }
  }

  private onDownload(progress: VoiceDownloadProgress) {
    this.downloads[progress.component] = progress;

    if (progress.error) {
      this.lastError = progress.error;
    }
  }

  private onRadio(event: CrewRadioEvent) {
    if (event.kind === 'tested') {
      this.lastTest = {
        text: event.text,
        intents: event.intents,
        confidence: event.confidence,
      };
      void this.understandSpoken(event.text, event.confidence);
    }
  }

  /**
   * A spoken sentence read against the pack being edited, as a typed one is,
   * so the values it named show too.
   */
  private async understandSpoken(sentence: string, confidence: number) {
    const pack = this.pack;

    if (!pack || sentence.trim() === '') {
      this.trial = { sentence: '', heard: [], confidence };

      return;
    }

    try {
      const heard = await recogniseVoiceSentence(toJS(pack), sentence);

      runInAction(() => {
        this.trial = { sentence, heard, confidence };
      });
    } catch (error) {
      runInAction(() => {
        this.lastError = String(error);
      });
    }
  }

  get voiceEnabled(): boolean {
    return this.root.appSettings.appSettings.voiceEnabled;
  }

  /** Below it the crew does not carry out a pit order or a question's steps. */
  get confidenceThreshold(): number {
    return this.root.appSettings.appSettings.voiceConfidence;
  }

  private async run<T>(work: () => Promise<T>): Promise<T | null> {
    this.busy = true;
    this.lastError = null;

    try {
      return await work();
    } catch (error) {
      runInAction(() => {
        this.lastError = String(error);
      });

      return null;
    } finally {
      runInAction(() => {
        this.busy = false;
      });
    }
  }

  async refresh() {
    const status = await this.run(voiceStatus);

    if (status) {
      runInAction(() => {
        this.status = status;
      });
    }
  }

  async install(id: string) {
    await this.run(() => installVoiceComponent(id));
    await this.refresh();
  }

  async installRecommended() {
    for (const component of this.recommendedMissing) {
      await this.run(() => installVoiceComponent(component.id));
    }

    await this.refresh();
  }

  cancelDownload() {
    void cancelVoiceDownload();
  }

  async importFiles(id: string) {
    const paths = await pickVoiceFiles();

    if (paths.length === 0) {
      return;
    }

    await this.run(() => importVoiceFiles(id, paths));
    await this.refresh();
  }

  async importCustomVoice() {
    const path = await pickCustomVoice();

    if (path === null) {
      return;
    }

    const name = await this.run(() => importCustomVoice(path));

    await this.refresh();

    if (name) {
      this.root.appSettings.setVoiceSettings({
        voiceName: `${CUSTOM_VOICE_PREFIX}${name}`,
      });
    }
  }

  /**
   * Moves the voice folder to one the user picks, or back to the app's own
   * with `toDefault`, and takes it into use. A folder that is not empty is
   * refused: nothing of the user's is overwritten.
   */
  async changeFolder(toDefault = false) {
    const folder = toDefault ? '' : await pickVoiceFolder();

    if (folder === null) {
      return;
    }

    const moved = await this.run(async () => {
      await moveVoiceFolder(folder);

      return true;
    });

    if (!moved) {
      return;
    }

    this.root.appSettings.setVoiceSettings({ voiceFolder: folder });
    await this.run(() =>
      configureVoiceCrew(voiceCrewSettingsOf(this.root.appSettings.appSettings))
    );
    await this.refresh();
    await this.loadPack();
  }

  async importCustomVoiceFolder() {
    const path = await pickVoiceFolder();

    if (path === null) {
      return;
    }

    await this.run(() => importCustomVoiceFolder(path));
    await this.refresh();
  }

  async removeCustomVoice(name: string) {
    const settings = this.root.appSettings.appSettings;
    const id = `${CUSTOM_VOICE_PREFIX}${name}`;

    await this.run(() => removeCustomVoice(name));
    await this.refresh();

    if (settings.voiceName === id) {
      this.root.appSettings.setVoiceSettings({ voiceName: '' });
    }
  }

  /** Plays a voice's sample, or stops it when it is the one playing. */
  toggleSample(component: VoiceComponentView) {
    const playing = this.playingSample === component.id;

    this.stopSample();

    if (playing || component.sampleUrl === null) {
      return;
    }

    const audio = new Audio(component.sampleUrl);

    audio.onended = () => this.stopSample();
    audio.onerror = () => {
      this.stopSample();
      runInAction(() => {
        this.lastError = `${component.title}: sample unavailable`;
      });
    };
    this.sampleAudio = audio;
    this.playingSample = component.id;
    void audio.play().catch(() => this.stopSample());
  }

  openLicense(component: VoiceComponentView) {
    openExternalLink(component.licenseUrl);
  }

  stopSample() {
    this.sampleAudio?.pause();
    this.sampleAudio = null;
    this.playingSample = null;
  }

  async remove(id: string) {
    await this.run(() => removeVoiceComponent(id));
    await this.refresh();
  }

  revealFolder(path: string) {
    void revealVoiceFolder(path);
  }

  async loadPack() {
    const pack = await this.run(() => voicePack(this.language));

    if (pack) {
      runInAction(() => {
        this.pack = pack;
        this.dirty = false;
      });
      this.scheduleDraftCheck();
    }
  }

  /** Drops the edits: the pack as last saved. */
  discardEdits() {
    void this.loadPack();
  }

  async savePack() {
    const pack = this.pack;

    if (!pack) {
      return;
    }

    for (const intent of pack.intents) {
      intent.templates = intent.templates
        .map((template) => template.trim())
        .filter((template) => template.length > 0);
    }

    const saved = await this.run(() => saveVoicePack(pack));

    if (saved) {
      runInAction(() => {
        this.pack = saved;
        this.dirty = false;
      });

      if (this.packOutdated) {
        await this.loadPack();
      } else {
        this.scheduleDraftCheck();
      }
    }
  }

  /** The pack changed in the editor: unsaved, and due a fresh check. */
  private edited() {
    this.dirty = true;
    this.scheduleDraftCheck();
  }

  private scheduleDraftCheck() {
    this.clearDraftCheckTimer();
    this.draftCheckTimer = setTimeout(() => {
      this.draftCheckTimer = null;
      void this.checkDraft();
    }, DRAFT_CHECK_DELAY_MS);
  }

  private clearDraftCheckTimer() {
    if (this.draftCheckTimer) {
      clearTimeout(this.draftCheckTimer);
      this.draftCheckTimer = null;
    }
  }

  private async checkDraft() {
    const pack = this.pack;

    if (!pack) {
      return;
    }

    try {
      const check = await checkVoiceDraft(toJS(pack));

      runInAction(() => {
        this.draftCheck = check;
      });
    } catch (error) {
      runInAction(() => {
        this.lastError = String(error);
      });
    }
  }

  async trySentence(sentence: string) {
    const pack = this.pack;
    const trimmed = sentence.trim();

    if (!pack || trimmed.length === 0) {
      this.trial = null;

      return;
    }

    const heard = await this.run(() =>
      recogniseVoiceSentence(toJS(pack), trimmed)
    );

    runInAction(() => {
      this.trial = { sentence: trimmed, heard: heard ?? [], confidence: null };
    });
  }

  private variant(key: string, index: number) {
    return this.pack?.phrases.find((phrase) => phrase.key === key)?.variants[
      index
    ];
  }

  setVariantText(key: string, index: number, text: string) {
    const variant = this.variant(key, index);

    if (variant) {
      variant.text = text;
      this.edited();
    }
  }

  addVariant(key: string) {
    const phrase = this.pack?.phrases.find((entry) => entry.key === key);

    if (phrase) {
      phrase.variants.push({ text: '', status: 'missing' });
      this.edited();
    }
  }

  removeVariant(key: string, index: number) {
    const phrase = this.pack?.phrases.find((entry) => entry.key === key);

    if (phrase) {
      phrase.variants.splice(index, 1);
      this.edited();
    }
  }

  private intent(id: string) {
    return this.pack?.intents.find((entry) => entry.id === id);
  }

  setTemplate(id: string, index: number, template: string) {
    const intent = this.intent(id);

    if (intent && index < intent.templates.length) {
      intent.templates[index] = template;
      this.edited();
    }
  }

  addTemplate(id: string) {
    const intent = this.intent(id);

    if (intent) {
      intent.templates.push('');
      this.edited();
    }
  }

  removeTemplate(id: string, index: number) {
    const intent = this.intent(id);

    if (intent) {
      intent.templates.splice(index, 1);
      this.edited();
    }
  }

  /** What an intent takes when its value is not said, or `ask`. */
  setWhenUnsaid(id: string, value: string) {
    const intent = this.intent(id);

    if (intent && intent.whenUnsaid !== null) {
      intent.whenUnsaid = value;
      this.edited();
    }
  }

  setBlockEditing(on: boolean) {
    this.blockEditing = on;
  }

  /** The words that say one value of a slot, e.g. tires `front`. */
  setSlotPhrases(slot: string, value: string, phrases: string[]) {
    const entry = this.pack?.slots
      .find((candidate) => candidate.slot === slot)
      ?.values.find((candidate) => candidate.value === value);

    if (entry) {
      entry.phrases = phrases
        .map((phrase) => phrase.trim())
        .filter((phrase) => phrase.length > 0);
      this.edited();
    }
  }

  /**
   * A new question of the driver's own: listed with the actions for its
   * sentences and with the phrases for its answers, both under its key.
   */
  addQuestion(name: string): string | null {
    const pack = this.pack;

    if (!pack) {
      return null;
    }

    const id = `q${Date.now().toString(36)}`;
    const key = `${VOICE_QUESTION_PREFIX}${id}`;

    pack.questions.push({ id, name, steps: [] });
    pack.intents.push({
      id: key,
      slots: [],
      templates: [''],
      sentences: 0,
      replies: [key],
      whenUnsaid: null,
    });
    pack.phrases.push({
      key,
      values: [...pack.questionValues],
      variants: [],
    });
    this.addVariant(key);

    return key;
  }

  renameQuestion(id: string, name: string) {
    const question = this.findQuestion(id);

    if (question) {
      question.name = name;
      this.edited();
    }
  }

  removeQuestion(id: string) {
    const pack = this.pack;

    if (!pack) {
      return;
    }

    const key = `${VOICE_QUESTION_PREFIX}${id}`;

    pack.questions = pack.questions.filter((entry) => entry.id !== id);
    pack.intents = pack.intents.filter((entry) => entry.id !== key);
    pack.phrases = pack.phrases.filter((entry) => entry.key !== key);
    this.edited();
  }

  /**
   * What a question can carry out before it answers: every pit action, then
   * the sim's chat macro — each with the one slot its value fills, if any.
   */
  get stepActions(): StepAction[] {
    const pitActions = (this.pack?.intents ?? [])
      .filter((intent) => intent.id.startsWith(PIT_ACTION_PREFIX))
      .map((intent) => ({ action: intent.id, slot: intent.slots[0] ?? null }));

    return [
      ...pitActions,
      { action: VOICE_CHAT_MACRO_ACTION, slot: NUMBER_SLOT },
    ];
  }

  /** A step's value to start from: a slot's first value, or the number 1. */
  defaultStepValue(action: string): string | null {
    const slot = this.stepActions.find(
      (candidate) => candidate.action === action
    )?.slot;

    if (!slot) {
      return null;
    }

    if (slot === NUMBER_SLOT) {
      return '1';
    }

    return (
      this.pack?.slots.find((candidate) => candidate.slot === slot)?.values[0]
        ?.value ?? null
    );
  }

  addStep(questionId: string, action: string) {
    const question = this.findQuestion(questionId);

    if (question) {
      question.steps.push({ action, value: this.defaultStepValue(action) });
      this.edited();
    }
  }

  setStep(questionId: string, index: number, step: VoiceStep) {
    const question = this.findQuestion(questionId);

    if (question && index < question.steps.length) {
      question.steps[index] = step;
      this.edited();
    }
  }

  removeStep(questionId: string, index: number) {
    const question = this.findQuestion(questionId);

    if (question) {
      question.steps.splice(index, 1);
      this.edited();
    }
  }

  findQuestion(id: string): VoiceQuestionView | undefined {
    return this.pack?.questions.find((entry) => entry.id === id);
  }

  /** A question's name for a key or intent id, `null` for a built-in one. */
  questionName(key: string): string | null {
    if (!key.startsWith(VOICE_QUESTION_PREFIX)) {
      return null;
    }

    const id = key.slice(VOICE_QUESTION_PREFIX.length);

    return this.pack?.questions.find((entry) => entry.id === id)?.name ?? '';
  }

  preview(key: string, index: number) {
    void this.run(() => previewVoiceLine(this.packLanguage, key, index));
  }

  async generate() {
    await this.run(() => generateVoiceLines(this.packLanguage));
    await this.loadPack();
  }

  /** A test press listens for the unsaved edits too, so a sentence just made can be said. */
  testPress(held: boolean) {
    this.testing = held;

    if (held) {
      this.lastTest = null;
      this.testingDraft = this.dirty;
    }

    const draft = held && this.dirty && this.pack ? toJS(this.pack) : null;

    void voiceTestPtt(held, draft);
  }

  async exportPack() {
    const path = await pickPackArchiveTarget(this.language);

    if (path === null) {
      return;
    }

    await this.run(() => exportVoicePack(this.language, path));
  }

  async importPack() {
    const path = await pickPackArchive();

    if (path === null) {
      return;
    }

    await this.run(() => importVoicePack(this.language, path));
    await this.loadPack();
  }
}
