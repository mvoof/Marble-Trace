import { runInAction } from 'mobx';

import { openRemoteSocket } from '@platform/services/remote-socket.service';
import { applyTelemetryBundle } from '@store/sim/apply-bundle';
import type { RemoteScreenStore } from '@store/remote/remote-screen.store';
import type { RendererCore } from '@store/roots/renderer-core';
import type { RemoteMessage } from '@/types/remote';
import type { ClientSnapshot } from '@/types/client-protocol';
import { applyClientSnapshot, applyControl } from './client-sync';
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
 * The remote screen's transport for the client of ADR-0007
 * (`client-sync.ts`): one WebSocket, carrying the snapshot, the signals and
 * the mirrored sim streams.
 *
 * Its difference from the overlay is the point: a remote screen sends no
 * `hello` and no command — the hub refuses one — so a browser on the network
 * cannot write into the user's layout. The one thing it reports is its own
 * viewport (`openRemoteSocket`).
 */
export const initRemoteSync = (
  root: RendererCore,
  screen: RemoteScreenStore,
  token: string
) => {
  const applySnapshot = (snapshot: ClientSnapshot) => {
    runInAction(() => screen.setSnapshot(snapshot));
    applyClientSnapshot(root, snapshot);
  };

  const handle = (message: RemoteMessage) => {
    const kind = message.type;

    switch (kind) {
      case 'snapshot': {
        const payload = message.data as
          | ClientSnapshot
          | { slug: string; snapshot: ClientSnapshot };

        // Cached snapshots arrive bare, live ones carry the slug they belong
        // to — a screen ignores updates meant for another device.
        const snapshot = 'snapshot' in payload ? payload.snapshot : payload;
        const slug = 'slug' in payload ? payload.slug : snapshot.monitor.slug;

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
          const reference = message.data as ReferenceLapData | null;

          if (reference) {
            root.referenceLap.updateReferenceLap(reference);
          } else {
            root.referenceLap.reset();
          }
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

      // Every stream kind is handled above, so what is left is a signal to
      // the widgets — run exactly as an overlay runs it.
      default: {
        applyControl(root, { type: kind, data: message.data });
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
