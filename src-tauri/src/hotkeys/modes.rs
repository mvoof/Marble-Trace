//! The overlay's drag and interact modes — the pure rules; the runtime keeps
//! the state, the timer and the broadcast.

use crate::model::hotkeys::{InteractHotkeyMode, OverlayModes};

/// Drag and interact both take the mouse but want it for opposite things, so
/// switching one on switches the other off.
pub fn with_drag(modes: OverlayModes, on: bool) -> OverlayModes {
    OverlayModes {
        drag_mode: on,
        interact_mode: modes.interact_mode && !on,
    }
}

pub fn with_interact(modes: OverlayModes, on: bool) -> OverlayModes {
    OverlayModes {
        interact_mode: on,
        drag_mode: modes.drag_mode && !on,
    }
}

/// Where the interact key leaves interact mode: held, it follows the key; as a
/// toggle, a press flips it and the release does nothing.
pub fn interact_after_key(
    modes: OverlayModes,
    mode: InteractHotkeyMode,
    pressed: bool,
) -> Option<bool> {
    match mode {
        InteractHotkeyMode::Hold => Some(pressed),
        InteractHotkeyMode::Toggle => pressed.then_some(!modes.interact_mode),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DRAGGING: OverlayModes = OverlayModes {
        drag_mode: true,
        interact_mode: false,
    };
    const INTERACTING: OverlayModes = OverlayModes {
        drag_mode: false,
        interact_mode: true,
    };

    #[test]
    fn only_one_mode_holds_the_mouse() {
        assert_eq!(with_interact(DRAGGING, true), INTERACTING);
        assert_eq!(with_drag(INTERACTING, true), DRAGGING);
    }

    #[test]
    fn switching_one_off_leaves_the_other_alone() {
        assert_eq!(with_drag(INTERACTING, false), INTERACTING);
        assert_eq!(with_interact(DRAGGING, false), DRAGGING);
    }

    #[test]
    fn the_held_key_follows_both_edges() {
        let mode = InteractHotkeyMode::Hold;

        assert_eq!(interact_after_key(DRAGGING, mode, true), Some(true));
        assert_eq!(interact_after_key(INTERACTING, mode, false), Some(false));
    }

    #[test]
    fn the_toggle_key_flips_on_press_and_ignores_the_release() {
        let mode = InteractHotkeyMode::Toggle;

        assert_eq!(interact_after_key(INTERACTING, mode, true), Some(false));
        assert_eq!(interact_after_key(DRAGGING, mode, true), Some(true));
        assert_eq!(interact_after_key(INTERACTING, mode, false), None);
    }
}
