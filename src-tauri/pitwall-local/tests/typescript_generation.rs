//! TypeScript Generation Tests
//!
//! Validates that Pitwall types can be successfully exported to TypeScript
//! when the tauri feature is enabled.

#[cfg(feature = "tauri")]
#[test]
fn test_core_types_implement_specta_type() {
    use specta::Type;

    // These assertions verify that the Type trait is implemented correctly.
    // If this compiles, all types are properly configured for TypeScript export.

    // Session types
    fn assert_type<T: Type>() {}

    assert_type::<pitwall::SessionInfo>();
    assert_type::<pitwall::UpdateRate>();
    assert_type::<pitwall::VariableSchema>();
    assert_type::<pitwall::VariableInfo>();
    assert_type::<pitwall::VariableType>();
}

#[cfg(not(feature = "tauri"))]
#[test]
fn test_tauri_feature_disabled() {
    // When tauri feature is disabled, types should still compile without specta::Type
    // This test just needs to compile - the actual type generation tests above are skipped
    let _ = pitwall::UpdateRate::Native;
}
