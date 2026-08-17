import { runInAction } from 'mobx';

import { openRemoteSocket } from '@platform/services/remote-socket.service';
import { applyTelemetryBundle } from '@store/sim/apply-bundle';
import type { RemoteScreenStore } from '@store/remote/remote-screen.store';
import type { RootStore } from '@store/root-store';
import type { RemoteMessage, RemoteScreenSnapshot } from '@/types/remote';
import type {
  CapabilitiesPayload,
  ChatDeletion,
  ChatMessage,
  ChatPresence,
  ReferenceLapData,
  SessionSnapshot,
  SimStatus,
  TelemetryBundle,
  TrackShapePayload,
  WeatherForecastEntry,
} from '@/types/bindings';

/**
 * Everything a remote screen owns.
 *
 * The overlay equivalent is `overlay-sync.ts`, and the difference is the point:
 * that one reads the settings file and emits back to the main window, this one
 * does neither. A remote screen receives, and never sends — so a browser on the
 * network cannot write into the user's layout.
 */
export const initRemoteSync = (
  root: RootStore,
  screen: RemoteScreenStore,
  token: string
) => {
  const applySnapshot = (snapshot: RemoteScreenSnapshot) => {
    runInAction(() => {
      screen.setSnapshot(snapshot);
      root.units.setSystem(snapshot.units);
      root.appSettings.setSteeringLock(snapshot.steeringLock);
      root.widgetSettings.applySettingsSync(snapshot.widgets);
    });

    root.appSettings.setLanguage(snapshot.language);
  };

  const handle = (message: RemoteMessage) => {
    switch (message.type) {
      case 'snapshot': {
        const payload = message.data as
          | RemoteScreenSnapshot
          | { slug: string; snapshot: RemoteScreenSnapshot };

        // Cached snapshots arrive bare, live ones carry the slug they belong
        // to — a screen ignores updates meant for another device.
        const snapshot =
          'snapshot' in payload
            ? payload.snapshot
            : (payload as RemoteScreenSnapshot);

        const slug = 'slug' in payload ? payload.slug : snapshot.slug;

        if (slug && slug !== screen.slug) return;

        applySnapshot(snapshot);

        return;
      }

      case 'telemetry': {
        applyTelemetryBundle(root, message.data as TelemetryBundle, () => {
          root.sim.markRemoteFrame();
        });

        return;
      }

      case 'session': {
        root.session.updateSessionInfo(message.data as SessionSnapshot);

        return;
      }

      case 'status': {
        root.sim.applyRemoteStatus(message.data as SimStatus);

        return;
      }

      case 'weather': {
        runInAction(() => {
          root.environment.updateWeatherForecast(
            message.data as WeatherForecastEntry[]
          );
        });

        return;
      }

      case 'capabilities': {
        runInAction(() => {
          root.sim.capabilities = message.data as CapabilitiesPayload;
        });

        return;
      }

      case 'disconnected': {
        root.sim.applyRemoteDisconnected();

        return;
      }

      // The track map draws nothing until a shape arrives, and the shape is
      // emitted once when the track loads — so it is replayed to whichever
      // device connects afterwards.
      case 'track-shape': {
        runInAction(() => {
          root.trackMapWidget.onTrackShapeReceived(
            message.data as TrackShapePayload
          );
        });

        return;
      }

      case 'reference-lap': {
        runInAction(() => {
          root.referenceLap.updateReferenceLap(
            message.data as ReferenceLapData
          );
        });

        return;
      }

      // Chat runs with no sim connected at all, so these keep arriving on a
      // remote screen even between sessions.
      case 'chat-message': {
        runInAction(() => root.chat.appendMessage(message.data as ChatMessage));

        return;
      }

      case 'chat-presence': {
        runInAction(() =>
          root.chat.updatePresence(message.data as ChatPresence)
        );

        return;
      }

      case 'chat-deletion': {
        runInAction(() =>
          root.chat.applyDeletion(message.data as ChatDeletion)
        );

        return;
      }
    }
  };

  return openRemoteSocket({
    screen: screen.slug,
    token,
    onMessage: handle,
    onState: (state) => runInAction(() => screen.setConnection(state)),
  });
};
