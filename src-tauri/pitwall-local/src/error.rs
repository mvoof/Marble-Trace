//! Error types for telemetry processing.
//!
//! This module provides comprehensive error handling for the pitwall telemetry library.
//! All errors implement the `std::error::Error` trait and include structured context
//! for debugging and recovery guidance.
//!
//! ## Error Categories
//!
//! - **Connection Errors**: Issues connecting to iRacing or shared memory
//! - **File Errors**: Problems reading or processing IBT files
//! - **Memory Errors**: Memory access violations or boundary issues
//! - **Parse Errors**: Data format or schema parsing failures
//! - **Type Conversion Errors**: Invalid type conversions or casts
//! - **Windows API Errors**: Platform-specific Windows operation failures
//!
//! ## Recovery and Retry
//!
//! Errors provide methods to determine if they are recoverable:
//!
//! ```rust
//! use pitwall::TelemetryError;
//!
//! let error = TelemetryError::connection_failed("iRacing not running");
//! if error.is_retryable() {
//!     println!("Can retry this operation");
//!     for suggestion in error.recovery_suggestions() {
//!         println!("  - {}", suggestion);
//!     }
//! }
//! ```
//!
//! ## Helper Constructors
//!
//! Use helper methods for common error scenarios:
//!
//! ```rust
//! use pitwall::TelemetryError;
//! use std::path::PathBuf;
//!
//! // File operations
//! let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
//! let file_error = TelemetryError::file_error(PathBuf::from("/path/to/file.ibt"), io_err);
//!
//! // Connection failures
//! let conn_error = TelemetryError::connection_failed("iRacing not detected");
//!
//! // Memory access errors
//! let mem_error = TelemetryError::memory_access_error(0x1000);
//! ```

use std::path::PathBuf;
use std::time::Duration;
use thiserror::Error;

#[cfg(windows)]
use windows_core as core;

/// Result type alias for telemetry operations.
pub type Result<T, E = TelemetryError> = std::result::Result<T, E>;

/// Main error type for telemetry operations.
#[derive(Error, Debug)]
#[non_exhaustive]
pub enum TelemetryError {
    #[error("Failed to connect to iRacing: {reason}")]
    Connection {
        reason: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("IBT file error: {path}")]
    File {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("SDK version mismatch: expected {expected}, found {found}")]
    Version { expected: u32, found: u32 },

    #[error("Memory access violation at offset {offset:#x}")]
    Memory {
        offset: usize,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Parse error in {context}: {details}")]
    Parse { context: String, details: String },

    #[error("Operation timed out after {duration:?}")]
    Timeout { duration: Duration },

    #[error("Field '{field}' not found in telemetry data")]
    FieldNotFound { field: String },

    #[error("Type conversion error: {details}")]
    TypeConversion { details: String },

    #[error("{feature} is only available on {required_platform}")]
    UnsupportedPlatform { feature: String, required_platform: String },

    #[error("Windows API error: {operation}")]
    #[cfg(windows)]
    WindowsApi {
        operation: String,
        #[source]
        source: core::Error,
    },

    #[error("Schema validation failed: {reason}")]
    SchemaValidation { reason: String, expected_version: Option<u32>, actual_version: Option<u32> },

    #[error("Buffer operation failed: {context}")]
    Buffer {
        context: String,
        buffer_index: Option<usize>,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },
}

impl TelemetryError {
    /// Returns whether this error is potentially recoverable through retry.
    pub fn is_retryable(&self) -> bool {
        match self {
            TelemetryError::Connection { .. } => true,
            TelemetryError::Timeout { .. } => true,
            TelemetryError::Buffer { .. } => true,
            TelemetryError::Memory { .. } => false,
            TelemetryError::File { .. } => false,
            TelemetryError::Version { .. } => false,
            TelemetryError::Parse { .. } => false,
            TelemetryError::FieldNotFound { .. } => false,
            TelemetryError::TypeConversion { .. } => false,
            TelemetryError::UnsupportedPlatform { .. } => false,
            #[cfg(windows)]
            TelemetryError::WindowsApi { .. } => true,
            TelemetryError::SchemaValidation { .. } => false,
        }
    }

    /// Returns suggested recovery actions for this error.
    pub fn recovery_suggestions(&self) -> Vec<&'static str> {
        match self {
            TelemetryError::Connection { .. } => vec![
                "Ensure iRacing is running",
                "Check Windows permissions for shared memory access",
                "Verify iRacing SDK version compatibility",
                "Try restarting iRacing",
            ],
            TelemetryError::File { .. } => vec![
                "Check file exists and is readable",
                "Verify IBT file format and version",
                "Ensure sufficient disk space",
                "Check file permissions",
            ],
            TelemetryError::Memory { .. } => vec![
                "Check memory access bounds",
                "Verify shared memory is still valid",
                "Restart the application",
            ],
            TelemetryError::Timeout { .. } => vec![
                "Increase timeout duration",
                "Check system performance",
                "Verify iRacing is responding",
            ],
            TelemetryError::Version { .. } => vec![
                "Update iRacing to latest version",
                "Update library to compatible version",
                "Check SDK compatibility matrix",
            ],
            TelemetryError::Parse { .. } => vec![
                "Check data format compatibility",
                "Verify source data integrity",
                "Update parsing logic if needed",
            ],
            TelemetryError::FieldNotFound { .. } => vec![
                "Check field name spelling",
                "Verify field exists in current iRacing version",
                "Use optional field access patterns",
            ],
            TelemetryError::TypeConversion { .. } => vec![
                "Check data type compatibility",
                "Verify expected vs actual data types",
                "Use appropriate conversion methods",
            ],
            TelemetryError::UnsupportedPlatform { .. } => vec![
                "Use platform-appropriate features",
                "Consider IBT file replay for cross-platform testing",
                "Check documentation for platform requirements",
            ],
            #[cfg(windows)]
            TelemetryError::WindowsApi { .. } => vec![
                "Check Windows API permissions",
                "Verify system resources availability",
                "Check Windows version compatibility",
            ],
            TelemetryError::SchemaValidation { .. } => vec![
                "Check schema version compatibility",
                "Update to compatible data format",
                "Verify data structure integrity",
            ],
            TelemetryError::Buffer { .. } => vec![
                "Check buffer synchronization",
                "Verify buffer access patterns",
                "Restart buffer management",
            ],
        }
    }

    /// Helper constructor for file errors with path context.
    pub fn file_error(path: PathBuf, source: std::io::Error) -> Self {
        TelemetryError::File { path, source }
    }

    /// Helper constructor for connection errors.
    pub fn connection_failed(reason: impl Into<String>) -> Self {
        TelemetryError::Connection { reason: reason.into(), source: None }
    }

    /// Helper constructor for connection errors with source.
    pub fn connection_failed_with_source(
        reason: impl Into<String>,
        source: Box<dyn std::error::Error + Send + Sync>,
    ) -> Self {
        TelemetryError::Connection { reason: reason.into(), source: Some(source) }
    }

    /// Helper constructor for memory access errors.
    pub fn memory_access_error(offset: usize) -> Self {
        TelemetryError::Memory { offset, source: None }
    }

    /// Helper constructor for Windows API errors.
    #[cfg(windows)]
    pub fn windows_api_error(operation: impl Into<String>, source: core::Error) -> Self {
        TelemetryError::WindowsApi { operation: operation.into(), source }
    }

    /// Helper constructor for schema validation errors.
    pub fn schema_validation_error(
        reason: impl Into<String>,
        expected_version: Option<u32>,
        actual_version: Option<u32>,
    ) -> Self {
        TelemetryError::SchemaValidation { reason: reason.into(), expected_version, actual_version }
    }

    /// Helper constructor for buffer operation errors.
    pub fn buffer_operation_error(context: impl Into<String>, buffer_index: Option<usize>) -> Self {
        TelemetryError::Buffer { context: context.into(), buffer_index, source: None }
    }

    /// Helper constructor for unsupported platform errors.
    pub fn unsupported_platform(
        feature: impl Into<String>,
        required_platform: impl Into<String>,
    ) -> Self {
        TelemetryError::UnsupportedPlatform {
            feature: feature.into(),
            required_platform: required_platform.into(),
        }
    }
}

// Comprehensive From implementations
impl From<std::io::Error> for TelemetryError {
    fn from(err: std::io::Error) -> Self {
        TelemetryError::File { path: PathBuf::from("<unknown>"), source: err }
    }
}

#[cfg(windows)]
impl From<core::Error> for TelemetryError {
    fn from(err: core::Error) -> Self {
        TelemetryError::WindowsApi {
            operation: "Unknown Windows operation".to_string(),
            source: err,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::Duration;

    #[cfg(test)]
    mod property_tests {
        use super::*;
        use proptest::prelude::*;

        proptest! {
          #[test]
          fn error_conversions_work_for_all_generated_variants(
            reason in ".*",
            offset in 0usize..0x10000usize,
            duration_ms in 1u64..60000u64
          ) {
            // Property: Error conversions work for all generated error variants

            // Test From<std::io::Error> conversion
            let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, reason.clone());
            let converted: TelemetryError = io_err.into();
            match converted {
              TelemetryError::File { source, .. } => {
                prop_assert_eq!(source.to_string(), reason.clone());
              }
              _ => prop_assert!(false, "Expected File error from io::Error conversion"),
            }

            // Test various error variant creations
            let connection_err = TelemetryError::connection_failed(reason.clone());
            let memory_err = TelemetryError::memory_access_error(offset);
            let timeout_err = TelemetryError::Timeout { duration: Duration::from_millis(duration_ms) };

            // Property: All variants should be constructible and display correctly
            prop_assert!(!connection_err.to_string().is_empty());
            prop_assert!(!memory_err.to_string().is_empty());
            prop_assert!(!timeout_err.to_string().is_empty());
          }

          #[test]
          fn error_messages_format_correctly_with_arbitrary_context(
            reason in ".*",
            field_name in "\\w+",
            offset in 0usize..0x10000usize,
            expected_version in 1u32..10u32,
            found_version in 1u32..10u32,
            details in ".*"
          ) {
            // Property: Error messages format correctly with arbitrary context strings
            let connection_error = TelemetryError::Connection { reason: reason.clone(), source: None };
            let field_error = TelemetryError::FieldNotFound { field: field_name.clone() };
            let memory_error = TelemetryError::Memory { offset, source: None };
            let version_error = TelemetryError::Version { expected: expected_version, found: found_version };
            let conversion_error = TelemetryError::TypeConversion { details: details.clone() };

            // Property: All error messages should contain their context
            let connection_msg = connection_error.to_string();
            prop_assert!(connection_msg.contains(&reason));

            let field_msg = field_error.to_string();
            prop_assert!(field_msg.contains(&field_name));

            let memory_msg = memory_error.to_string();
            let offset_hex = format!("{:#x}", offset);
            prop_assert!(memory_msg.contains(&offset_hex));

            let version_msg = version_error.to_string();
            prop_assert!(version_msg.contains(&expected_version.to_string()));
            prop_assert!(version_msg.contains(&found_version.to_string()));

            let conversion_msg = conversion_error.to_string();
            prop_assert!(conversion_msg.contains(&details));

            // Property: No error message should be empty
            prop_assert!(!connection_msg.is_empty());
            prop_assert!(!field_msg.is_empty());
            prop_assert!(!memory_msg.is_empty());
            prop_assert!(!version_msg.is_empty());
            prop_assert!(!conversion_msg.is_empty());
          }

          #[test]
          fn error_source_chaining_preserves_information_through_nested_trees(
            chain_depth in 1usize..5usize,
            base_message in ".*",
            intermediate_reasons in prop::collection::vec(".*", 1..5)
          ) {
            // Property: Error source chaining preserves information through nested trees
            let mut current_error: Box<dyn std::error::Error + Send + Sync> =
              Box::new(std::io::Error::other(base_message.clone()));

            // Add intermediate layers
            for (i, reason) in intermediate_reasons.iter().enumerate().take(chain_depth.saturating_sub(1)) {
              current_error = Box::new(TelemetryError::Connection {
                reason: format!("Level {}: {}", i, reason),
                source: Some(current_error),
              });
            }

            // Create top-level error
            let top_error = TelemetryError::Connection {
              reason: "Top level".to_string(),
              source: Some(current_error),
            };

            // Property: Should be able to traverse the entire chain
            let mut traversed_count = 0;
            let mut current = std::error::Error::source(&top_error);
            let mut found_base_message = false;

            while let Some(source) = current {
              traversed_count += 1;

              // Check if we found the base message
              if source.to_string().contains(&base_message) {
                found_base_message = true;
              }

              current = std::error::Error::source(source);

              // Prevent infinite loops
              if traversed_count > 10 {
                break;
              }
            }

            // Property: Chain depth should be reasonable (1 base + intermediate layers)
            let expected_depth = 1 + intermediate_reasons.len().min(chain_depth.saturating_sub(1));
            prop_assert_eq!(traversed_count, expected_depth);

            // Property: Base message should be preserved
            prop_assert!(found_base_message, "Base message '{}' not found in chain", base_message);
          }

          #[test]
          fn platform_error_handling_works_across_failure_modes(
            operation in ".*",
            _error_code in 0u32..1000u32
          ) {
            // Property: Platform error handling works across generated failure modes

            // Test cross-platform error creation
            let generic_error = TelemetryError::connection_failed(operation.clone());
            prop_assert!(generic_error.to_string().contains(&operation));

            #[cfg(not(windows))]
            {
              // On non-Windows platforms, ensure graceful degradation
              let fallback_error = TelemetryError::connection_failed(format!("Platform error: {}", _error_code));
              prop_assert!(!fallback_error.to_string().is_empty());
            }
          }
        }
    }

    #[test]
    fn error_constructors_validation() {
        // Unit test: Simple error constructor validation
        let file_error = TelemetryError::file_error(
            PathBuf::from("/test"),
            std::io::Error::new(std::io::ErrorKind::NotFound, "test"),
        );
        assert!(matches!(file_error, TelemetryError::File { .. }));

        let conn_error = TelemetryError::connection_failed("test");
        assert!(matches!(conn_error, TelemetryError::Connection { .. }));

        let mem_error = TelemetryError::memory_access_error(0x1000);
        assert!(matches!(mem_error, TelemetryError::Memory { .. }));
    }

    #[test]
    fn error_traits_validation() {
        // Compile-time check: TelemetryError must be Send + Sync + 'static
        fn assert_send_sync_static<T: Send + Sync + 'static>() {}
        assert_send_sync_static::<TelemetryError>();

        // Runtime check: Error trait is implemented
        let error = TelemetryError::connection_failed("test");
        let _: &dyn std::error::Error = &error;
    }

    #[test]
    fn recovery_methods_work() {
        // Test that recovery methods provide actionable guidance
        let connection_error = TelemetryError::connection_failed("test");
        let memory_error = TelemetryError::memory_access_error(0x1000);
        let version_error = TelemetryError::Version { expected: 2, found: 1 };

        // Test is_retryable classification
        assert!(connection_error.is_retryable());
        assert!(!memory_error.is_retryable());
        assert!(!version_error.is_retryable());

        // Test recovery suggestions are provided
        let conn_suggestions = connection_error.recovery_suggestions();
        let mem_suggestions = memory_error.recovery_suggestions();
        let ver_suggestions = version_error.recovery_suggestions();

        assert!(!conn_suggestions.is_empty());
        assert!(!mem_suggestions.is_empty());
        assert!(!ver_suggestions.is_empty());

        // All suggestions should be actionable (non-empty strings)
        for suggestion in &conn_suggestions {
            assert!(!suggestion.is_empty());
            assert!(suggestion.len() > 5); // Should be descriptive
        }
    }

    #[test]
    fn from_conversions_work() {
        // Test From trait implementations
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "test file");
        let telemetry_err: TelemetryError = io_err.into();

        match telemetry_err {
            TelemetryError::File { source, .. } => {
                assert_eq!(source.to_string(), "test file");
            }
            _ => panic!("Expected File error variant"),
        }
    }
}
