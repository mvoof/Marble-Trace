//! Which actions one binding edge fires — the pure half of the dispatcher.

use std::collections::BTreeMap;

use crate::model::hotkeys::{
    find_action, visibility_action_owner, Binding, HotkeyActionDecl, HotkeyContext, HotkeyTrigger,
    APP_OWNER,
};

/// `actionId -> the bindings that fire it`, defaults already folded in by the
/// main window. Ordered, so a key bound to two actions runs them in a fixed
/// order.
pub type BindingMap = BTreeMap<String, Vec<Binding>>;

/// An action a binding edge fired.
#[derive(Debug, Clone)]
pub enum Fired {
    Declared(&'static HotkeyActionDecl),
    /// A per-widget show/hide action, by id: the frontend generates those from
    /// its catalog, so they carry no declaration here.
    Visibility(String),
}

/// Every action bound to `binding` that may run on this edge. Conflicts are
/// allowed, so this is a fan-out.
///
/// A widget's actions fire only while it is on screen: nothing should run for a
/// widget that is not in the layout — no control messages, no pit orders. The
/// visibility action is the one exception, because it acts on the layout
/// rather than on the widget, and a key that puts a widget back is not the
/// widget doing anything. An id this build does not know is kept in the file
/// but never dispatched.
pub fn fired_actions(
    bindings: &BindingMap,
    binding: &Binding,
    pressed: bool,
    context: &HotkeyContext,
) -> Vec<Fired> {
    let is_on_screen =
        |owner: &str| owner == APP_OWNER || context.widgets_on_screen.iter().any(|on| on == owner);

    bindings
        .iter()
        .filter(|(_, bound)| bound.contains(binding))
        .filter_map(|(action_id, _)| {
            if let Some(decl) = find_action(action_id) {
                let edge_counts = pressed || decl.effect.trigger() == HotkeyTrigger::Hold;

                return (edge_counts && is_on_screen(decl.owner)).then_some(Fired::Declared(decl));
            }

            visibility_action_owner(action_id)
                .filter(|_| pressed)
                .map(|_| Fired::Visibility(action_id.clone()))
        })
        .collect()
}

/// The accelerators the OS has to deliver, once each.
pub fn keyboard_accelerators(bindings: &BindingMap) -> Vec<String> {
    let mut accelerators: Vec<String> = bindings
        .values()
        .flatten()
        .filter_map(|binding| match binding {
            Binding::Keyboard { accelerator } => Some(accelerator.clone()),
            Binding::Device { .. } => None,
        })
        .collect();

    accelerators.sort();
    accelerators.dedup();

    accelerators
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(accelerator: &str) -> Binding {
        Binding::Keyboard {
            accelerator: accelerator.into(),
        }
    }

    fn bound(entries: &[(&str, Binding)]) -> BindingMap {
        let mut map = BindingMap::new();

        for (action_id, binding) in entries {
            map.entry(action_id.to_string())
                .or_default()
                .push(binding.clone());
        }

        map
    }

    fn on_screen(widgets: &[&str]) -> HotkeyContext {
        HotkeyContext {
            widgets_on_screen: widgets.iter().map(|widget| widget.to_string()).collect(),
            ..HotkeyContext::default()
        }
    }

    fn ids(fired: Vec<Fired>) -> Vec<String> {
        fired
            .into_iter()
            .map(|fired| match fired {
                Fired::Declared(decl) => decl.id.to_string(),
                Fired::Visibility(id) => id,
            })
            .collect()
    }

    #[test]
    fn runs_a_widget_action_while_the_widget_is_on_screen() {
        let bindings = bound(&[("standings:scroll-down", key("PageDown"))]);

        assert_eq!(
            ids(fired_actions(
                &bindings,
                &key("PageDown"),
                true,
                &on_screen(&["standings"])
            )),
            vec!["standings:scroll-down"]
        );
    }

    #[test]
    fn does_nothing_for_a_widget_that_is_not_on_screen() {
        let bindings = bound(&[("pit-service:fuel", key("F5"))]);

        assert!(fired_actions(&bindings, &key("F5"), true, &on_screen(&[])).is_empty());
    }

    #[test]
    fn runs_an_app_action_with_no_widget_on_screen() {
        let bindings = bound(&[("app:toggle-drag-mode", key("F9"))]);

        assert_eq!(
            ids(fired_actions(&bindings, &key("F9"), true, &on_screen(&[]))),
            vec!["app:toggle-drag-mode"]
        );
    }

    #[test]
    fn lets_the_visibility_action_past_the_layout_gate() {
        let bindings = bound(&[("widget:track-map:toggle-visibility", key("F4"))]);

        assert_eq!(
            ids(fired_actions(&bindings, &key("F4"), true, &on_screen(&[]))),
            vec!["widget:track-map:toggle-visibility"]
        );
    }

    #[test]
    fn runs_a_press_action_on_key_down_only() {
        let bindings = bound(&[("app:toggle-drag-mode", key("F9"))]);

        assert!(fired_actions(&bindings, &key("F9"), false, &on_screen(&[])).is_empty());
    }

    #[test]
    fn runs_a_hold_action_on_both_edges() {
        let bindings = bound(&[("app:toggle-interact-mode", key("F8"))]);

        for pressed in [true, false] {
            assert_eq!(
                fired_actions(&bindings, &key("F8"), pressed, &on_screen(&[])).len(),
                1
            );
        }
    }

    #[test]
    fn fans_a_conflicting_key_out_to_every_action_bound_to_it() {
        let bindings = bound(&[
            ("standings:scroll-down", key("F6")),
            ("pit-service:toggle", key("F6")),
        ]);

        assert_eq!(
            fired_actions(
                &bindings,
                &key("F6"),
                true,
                &on_screen(&["standings", "pit-service"])
            )
            .len(),
            2
        );
    }

    #[test]
    fn matches_a_device_button_by_device_and_button() {
        let button = |button| Binding::Device {
            device_id: "wheel".into(),
            button,
        };
        let bindings = bound(&[("pit-service:fuel", button(3))]);
        let context = on_screen(&["pit-service"]);

        assert_eq!(
            fired_actions(&bindings, &button(3), true, &context).len(),
            1
        );
        assert!(fired_actions(&bindings, &button(4), true, &context).is_empty());
    }

    #[test]
    fn never_dispatches_an_action_this_build_does_not_know() {
        let bindings = bound(&[("future:action", key("F1"))]);

        assert!(fired_actions(&bindings, &key("F1"), true, &on_screen(&[])).is_empty());
    }

    #[test]
    fn registers_each_accelerator_once() {
        let bindings = bound(&[
            ("app:toggle-drag-mode", key("F9")),
            ("standings:scroll-up", key("F9")),
            (
                "pit-service:fuel",
                Binding::Device {
                    device_id: "wheel".into(),
                    button: 1,
                },
            ),
        ]);

        assert_eq!(keyboard_accelerators(&bindings), vec!["F9".to_string()]);
    }
}
