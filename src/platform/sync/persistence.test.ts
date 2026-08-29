import { describe, expect, it } from 'vitest';
import { DEFAULT_WIDGETS } from '@store/widget-catalog';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
import { restoreLayoutWidgets } from './persistence';

const CHAT_ID = 'stream-chat';
const FLAG = 'showPlaceholder';

// The settings of one widget differ per widget, so the union has no index
// signature. A test that pokes at one key by name reads them as a plain bag.
const settingsBag = (widget: WidgetDefaultConfig): Record<string, unknown> =>
  widget.userSettings as unknown as Record<string, unknown>;

const shippedChat = (): WidgetDefaultConfig => {
  const shipped = DEFAULT_WIDGETS.find((widget) => widget.id === CHAT_ID);

  if (!shipped) {
    throw new Error('the stream chat widget is missing from the catalog');
  }

  return shipped;
};

const savedChat = (
  userSettings: Record<string, unknown>
): WidgetDefaultConfig =>
  ({
    ...shippedChat(),
    userSettings,
  }) as unknown as WidgetDefaultConfig;

const chatFrom = (widgets: WidgetDefaultConfig[]): WidgetDefaultConfig => {
  const chat = widgets.find((widget) => widget.id === CHAT_ID);

  if (!chat) {
    throw new Error('the restored layout lost the stream chat widget');
  }

  return chat;
};

describe('restoreLayoutWidgets', () => {
  it('fills a setting the layout copy was written without', () => {
    const shipped = settingsBag(shippedChat());
    const { [FLAG]: _absent, ...withoutFlag } = shipped;

    const restored = restoreLayoutWidgets([savedChat(withoutFlag)]);

    expect(settingsBag(chatFrom(restored))[FLAG]).toBe(shipped[FLAG]);
  });

  it('keeps a value the user chose over the shipped default', () => {
    const restored = restoreLayoutWidgets([
      savedChat({ ...settingsBag(shippedChat()), [FLAG]: false }),
    ]);

    expect(settingsBag(chatFrom(restored))[FLAG]).toBe(false);
  });

  it('adds a widget the layout never had, switched off', () => {
    const restored = restoreLayoutWidgets([savedChat({})]);
    const added = restored.filter((widget) => widget.id !== CHAT_ID);

    expect(added.length).toBe(DEFAULT_WIDGETS.length - 1);
    expect(added.every((widget) => widget.userSettings.enabled === false)).toBe(
      true
    );
  });

  it('drops a stale design size a locked-ratio widget was saved with', () => {
    const shipped = DEFAULT_WIDGETS.find(
      (widget) => widget.lockAspectRatio && widget.designWidth > 0
    );

    if (!shipped) {
      throw new Error('the catalog ships no locked-ratio widget');
    }

    const restored = restoreLayoutWidgets([
      {
        ...shipped,
        designWidth: shipped.designWidth + 20,
        designHeight: shipped.designHeight + 120,
        userSettings: { ...shipped.userSettings },
      } as unknown as WidgetDefaultConfig,
    ]);

    const locked = restored.find((widget) => widget.id === shipped.id)!;

    expect(locked.designWidth).toBe(shipped.designWidth);
    expect(locked.designHeight).toBe(shipped.designHeight);
  });

  it('leaves a widget the layout already had enabled alone', () => {
    const restored = restoreLayoutWidgets([
      savedChat({ ...settingsBag(shippedChat()), enabled: true }),
    ]);

    expect(chatFrom(restored).userSettings.enabled).toBe(true);
  });
});
