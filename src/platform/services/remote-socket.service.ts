import type { RemoteConnectionState, RemoteMessage } from '@/types/remote';

/**
 * WebSocket transport for a remote screen — the browser-side counterpart of the
 * Tauri event bus the overlay windows use.
 *
 * Read-only by construction: the socket is never written to. A remote screen
 * cannot change anything in the app, so a device on the network is not a way
 * into the user's settings.
 */

const RECONNECT_DELAY_MS = 1000;

/** Resizing a window fires continuously; the app only needs the resting size. */
const VIEWPORT_REPORT_DEBOUNCE_MS = 400;
const MAX_RECONNECT_DELAY_MS = 15_000;

/** Closed by the server when the token is wrong; retrying will not help. */
const CLOSE_UNAUTHORIZED = 1008;

/**
 * The one thing a remote screen ever sends: what its display looks like.
 *
 * It changes nothing on the app side — the settings UI shows it so the user can
 * match a screen's size to the device it actually runs on, which is a decision
 * they make, not one the tablet makes for them.
 *
 * `screen.*` is the panel, `visualViewport` is what the page really gets; on a
 * phone the browser chrome sits between the two, and in standalone mode they
 * finally agree.
 */
const describeDevice = () => {
  const viewport = window.visualViewport;

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && window.navigator.standalone === true);

  return {
    type: 'hello',
    viewportWidth: Math.round(viewport?.width ?? window.innerWidth),
    viewportHeight: Math.round(viewport?.height ?? window.innerHeight),
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    pixelRatio: window.devicePixelRatio,
    standalone,
  };
};

interface RemoteSocketOptions {
  screen: string;
  token: string;
  onMessage: (message: RemoteMessage) => void;
  onState: (state: RemoteConnectionState) => void;
}

export const openRemoteSocket = ({
  screen,
  token,
  onMessage,
  onState,
}: RemoteSocketOptions) => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const params = new URLSearchParams({ screen });

  if (token) {
    params.set('t', token);
  }

  const url = `${protocol}://${window.location.host}/ws?${params.toString()}`;

  let socket: WebSocket | null = null;
  let reportTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = RECONNECT_DELAY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const report = () => {
    if (socket?.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(describeDevice()));
  };

  // Re-reported on every resize, so the settings UI shows what this device
  // looks like right now. It still changes nothing on its own — the app decides
  // whether to match the screen to it.
  const scheduleReport = () => {
    if (reportTimer) {
      clearTimeout(reportTimer);
    }

    reportTimer = setTimeout(report, VIEWPORT_REPORT_DEBOUNCE_MS);
  };

  const scheduleReconnect = () => {
    if (closed || retryTimer) return;

    onState('reconnecting');

    retryTimer = setTimeout(() => {
      retryTimer = null;
      // Backs off so a tablet left on a dead network does not hammer the
      // socket, but stays quick enough that waking the app feels immediate.
      retryDelay = Math.min(retryDelay * 2, MAX_RECONNECT_DELAY_MS);
      connect();
    }, retryDelay);
  };

  const connect = () => {
    if (closed) return;

    onState(socket === null ? 'connecting' : 'reconnecting');

    socket = new WebSocket(url);

    socket.onopen = () => {
      retryDelay = RECONNECT_DELAY_MS;
      onState('connected');
      report();
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;

      try {
        onMessage(JSON.parse(event.data) as RemoteMessage);
      } catch (error) {
        console.error('[remote-socket] malformed message', error);
      }
    };

    socket.onclose = (event) => {
      if (event.code === CLOSE_UNAUTHORIZED) {
        closed = true;
        onState('unauthorized');

        return;
      }

      scheduleReconnect();
    };

    // An error is always followed by a close event, which does the retrying.
    socket.onerror = () => socket?.close();
  };

  connect();

  window.visualViewport?.addEventListener('resize', scheduleReport);
  window.addEventListener('resize', scheduleReport);
  window.addEventListener('orientationchange', scheduleReport);

  return () => {
    closed = true;

    if (retryTimer) {
      clearTimeout(retryTimer);
    }

    if (reportTimer) {
      clearTimeout(reportTimer);
    }

    window.visualViewport?.removeEventListener('resize', scheduleReport);
    window.removeEventListener('resize', scheduleReport);
    window.removeEventListener('orientationchange', scheduleReport);

    socket?.close();
  };
};
