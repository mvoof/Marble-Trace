//! Shared runtime state for the chat connectors.

use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use crate::model::chat::ChatConfig;

/// Managed Tauri state. `generation` is the cooperative stop signal: every
/// connector loop captures the value it started with and exits as soon as the
/// stored one moves past it, so a restart never leaves two loops racing on the
/// same channel.
pub struct ChatServiceState {
    pub running: AtomicBool,
    pub generation: std::sync::atomic::AtomicU64,
    pub config: Mutex<ChatConfig>,
    /// Twitch badge artwork, keyed `"set_id/version"`. Filled asynchronously
    /// after connecting and only while signed in — Helix is the only source
    /// left since the anonymous badge host was retired. Empty means every
    /// badge falls back to its text plate.
    pub badges: Mutex<std::collections::HashMap<String, String>>,
}

impl ChatServiceState {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
            generation: std::sync::atomic::AtomicU64::new(0),
            config: Mutex::new(ChatConfig::default()),
            badges: Mutex::new(std::collections::HashMap::new()),
        }
    }

    /// Badge artwork is per channel, so a reconnect to a different channel must
    /// not keep serving the previous one's subscriber icons.
    pub fn clear_badges(&self) {
        if let Ok(mut badges) = self.badges.lock() {
            badges.clear();
        }
    }

    pub fn badge_url(&self, set_id: &str, version: &str) -> Option<String> {
        self.badges
            .lock()
            .ok()?
            .get(&format!("{set_id}/{version}"))
            .cloned()
    }

    /// Invalidates every running loop and returns the id the new ones must use.
    pub fn next_generation(&self) -> u64 {
        self.generation
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
            + 1
    }

    pub fn is_current(&self, generation: u64) -> bool {
        self.running.load(std::sync::atomic::Ordering::SeqCst)
            && self.generation.load(std::sync::atomic::Ordering::SeqCst) == generation
    }
}

impl Default for ChatServiceState {
    fn default() -> Self {
        Self::new()
    }
}

pub struct ChatState {
    pub service: Arc<ChatServiceState>,
}
