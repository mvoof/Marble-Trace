import { openExternalUrl } from '@platform/services/opener.service';

/**
 * Opens a link in the user's browser — the footer's links, the Twitch
 * activation page. Holds no state, so it is a function rather than a store;
 * it sits here so a component reaches the OS through the store layer like
 * every other action.
 */
export const openExternalLink = (url: string) => {
  openExternalUrl(url).catch((error) =>
    console.error('Failed to open URL:', error)
  );
};
