//! OAuth token storage backed by the OS credential store.
//!
//! Tokens never travel to the frontend and never touch `settings.json`. The
//! refresh token in particular is long-lived and can mint new access tokens, so
//! a plaintext JSON file next to the layout config is the wrong home for it.
//!
//! Everything here degrades to "not signed in" on failure rather than
//! propagating errors — a broken credential store must not take chat down,
//! since reading chat needs no token at all.

use keyring::Entry;
use tracing::warn;

const SERVICE: &str = "marble-trace";
const ACCESS_ACCOUNT: &str = "twitch-access-token";
const REFRESH_ACCOUNT: &str = "twitch-refresh-token";

fn entry(account: &str) -> Option<Entry> {
    match Entry::new(SERVICE, account) {
        Ok(entry) => Some(entry),
        Err(error) => {
            warn!("credential store unavailable for {account}: {error}");

            None
        }
    }
}

fn read(account: &str) -> Option<String> {
    let entry = entry(account)?;

    match entry.get_password() {
        Ok(value) if !value.is_empty() => Some(value),
        Ok(_) => None,
        // A missing entry is the normal "not signed in" case, not a fault.
        Err(keyring::Error::NoEntry) => None,
        Err(error) => {
            warn!("failed to read {account}: {error}");

            None
        }
    }
}

fn write(account: &str, value: &str) -> bool {
    let Some(entry) = entry(account) else {
        return false;
    };

    match entry.set_password(value) {
        Ok(()) => true,
        Err(error) => {
            warn!("failed to store {account}: {error}");

            false
        }
    }
}

fn remove(account: &str) {
    let Some(entry) = entry(account) else {
        return;
    };

    match entry.delete_credential() {
        Ok(()) => {}
        Err(keyring::Error::NoEntry) => {}
        Err(error) => warn!("failed to clear {account}: {error}"),
    }
}

pub fn access_token() -> Option<String> {
    read(ACCESS_ACCOUNT)
}

pub fn refresh_token() -> Option<String> {
    read(REFRESH_ACCOUNT)
}

pub fn is_signed_in() -> bool {
    access_token().is_some()
}

/// Stores a freshly issued pair. An absent refresh token leaves the stored one
/// untouched — Twitch rotates it, but a response may legitimately omit it.
pub fn save(access: &str, refresh: Option<&str>) -> bool {
    let stored = write(ACCESS_ACCOUNT, access);

    if let Some(refresh) = refresh.filter(|value| !value.is_empty()) {
        write(REFRESH_ACCOUNT, refresh);
    }

    stored
}

pub fn clear() {
    remove(ACCESS_ACCOUNT);
    remove(REFRESH_ACCOUNT);
}
