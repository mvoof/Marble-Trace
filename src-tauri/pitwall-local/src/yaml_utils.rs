//! YAML utilities for iRacing data preprocessing
//!
//! iRacing's YAML output has several non-standard issues that need correction:
//! - Unescaped special characters in strings (quotes, backslashes, etc.)
//! - Control characters that break YAML parsers
//! - Inconsistent string quoting
//!
//! This module provides low-level YAML cleaning without parsing.

use crate::{Result, TelemetryError};

fn decode_cp1252(bytes: &[u8]) -> String {
    let (decoded, _, _) = encoding_rs::WINDOWS_1252.decode(bytes);
    decoded.into_owned()
}

/// Preprocess iRacing YAML to fix known issues
///
/// This function cleans up iRacing's non-standard YAML format to make it
/// parseable by standard YAML libraries. It handles:
/// - Control character removal (except \n, \r, \t)
/// - String escaping for special characters in problematic keys
/// - Consistent quoting for known unquoted string fields
///
/// Based on iRacing forum discussion: <https://forums.iracing.com/discussion/comment/374646#Comment_374646>
pub fn preprocess_iracing_yaml(yaml: &str) -> Result<String> {
    const PROBLEMATIC_KEYS: &[&str] = &[
        "AbbrevName:",
        "TeamName:",
        "UserName:",
        "Initials:",
        "DriverSetupName:",
        "CarDesignStr:",
        "HelmetDesignStr:",
        "SuitDesignStr:",
        "CarNumberDesignStr:",
        "LicString:",
        "LicColor:",
        "ClubName:",
        "CountryCode:",
        "CarClassShortName:",
    ];

    // Handle edge case where input is just whitespace/newlines
    if yaml.trim().is_empty() {
        return Ok(yaml.to_string());
    }

    // First pass: Remove all control characters (except \n, \r, \t)
    let mut cleaned = String::with_capacity(yaml.len());
    for ch in yaml.chars() {
        if ch.is_control() && ch != '\n' && ch != '\r' && ch != '\t' {
            // Skip control characters except basic whitespace
            continue;
        }
        cleaned.push(ch);
    }

    let lines: Vec<&str> = cleaned.lines().collect();
    let mut result_lines = Vec::with_capacity(lines.len());

    for line in lines {
        let mut processed_line = line.to_string();

        // Check if this line contains any problematic keys
        for &key in PROBLEMATIC_KEYS {
            if let Some(colon_pos) = line.find(key) {
                let after_colon = colon_pos + key.len();
                if let Some(value_start) = line[after_colon..].find(|c: char| !c.is_whitespace()) {
                    let actual_value_start = after_colon + value_start;
                    let value = line[actual_value_start..].trim();

                    if !value.is_empty() && !value.starts_with('\'') && !value.starts_with('"') {
                        // Need to quote this value
                        let escaped_value = value.replace('\'', "''");
                        processed_line = format!(
                            "{}{} '{}'",
                            &line[..after_colon],
                            &line[after_colon..actual_value_start],
                            escaped_value
                        );
                    }
                }
                break; // Only process first match per line
            }
        }

        result_lines.push(processed_line);
    }

    let result = result_lines.join("\n");

    if result.trim().is_empty() {
        return Err(TelemetryError::Parse {
            context: "YAML preprocessing".to_string(),
            details: "YAML is empty after preprocessing".to_string(),
        });
    }

    Ok(result)
}

/// Extract YAML from a memory buffer
///
/// Handles null-terminated strings and validates UTF-8 encoding.
/// Returns the raw YAML string without preprocessing.
pub fn extract_yaml_from_memory(data: &[u8], offset: i32, length: i32) -> Result<String> {
    // Validate parameters
    if offset < 0 {
        return Err(TelemetryError::Parse {
            context: "YAML extraction".to_string(),
            details: format!("Invalid offset: {}", offset),
        });
    }

    if length <= 0 {
        return Ok(String::new());
    }

    let offset = offset as usize;
    let length = length as usize;

    // Validate bounds
    if offset + length > data.len() {
        return Err(TelemetryError::Parse {
            context: "YAML extraction".to_string(),
            details: format!(
                "YAML extends beyond buffer bounds: offset={}, len={}, buffer_size={}",
                offset,
                length,
                data.len()
            ),
        });
    }

    // Extract the substring
    let yaml_data = &data[offset..offset + length];

    // Find null terminator or use entire length
    let yaml_len = yaml_data.iter().position(|&b| b == 0).unwrap_or(length);

    let yaml_str = decode_cp1252(&yaml_data[..yaml_len]);

    Ok(yaml_str)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preprocess_removes_control_characters() {
        let input = "WeekendInfo:\n\x00\x01\x02  TrackName: test\x03";
        let result = preprocess_iracing_yaml(input).unwrap();
        assert!(!result.contains('\x00'));
        assert!(!result.contains('\x01'));
        assert!(!result.contains('\x02'));
        assert!(!result.contains('\x03'));
        assert!(result.contains("WeekendInfo"));
        assert!(result.contains("TrackName"));
    }

    #[test]
    fn test_preprocess_keeps_valid_whitespace() {
        let input = "Key:\n\r\t  Value";
        let result = preprocess_iracing_yaml(input).unwrap();
        assert!(result.contains('\n'));
        assert!(result.contains('\r'));
        assert!(result.contains('\t'));
    }

    #[test]
    fn test_preprocess_quotes_problematic_values() {
        let input = "UserName: O'Connor, Mike\nTeamName: Fast & Furious";
        let result = preprocess_iracing_yaml(input).unwrap();
        assert!(result.contains("UserName: 'O''Connor, Mike'"));
        assert!(result.contains("TeamName: 'Fast & Furious'"));
    }

    #[test]
    fn test_extract_yaml_from_memory_with_null_terminator() {
        let data = b"SessionInfo:\n  TrackName: test\0padding";
        let result = extract_yaml_from_memory(data, 0, data.len() as i32).unwrap();
        assert_eq!(result, "SessionInfo:\n  TrackName: test");
    }

    #[test]
    fn test_extract_yaml_from_memory_without_null() {
        let data = b"SessionInfo:\n  TrackName: test";
        let result = extract_yaml_from_memory(data, 0, data.len() as i32).unwrap();
        assert_eq!(result, "SessionInfo:\n  TrackName: test");
    }

    #[test]
    fn test_extract_yaml_bounds_check() {
        let data = b"test";
        let result = extract_yaml_from_memory(data, 0, 100);
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_yaml_cp1252_driver_name() {
        // CP1252: é=0xE9, ü=0xFC, ñ=0xF1 — common in European driver names
        let mut data = b"UserName: ".to_vec();
        data.extend_from_slice(&[0xE9, 0xFC, 0xF1]); // éüñ in CP1252
        data.push(0x00);
        let result = extract_yaml_from_memory(&data, 0, data.len() as i32).unwrap();
        assert!(result.contains('é'), "é not decoded: {:?}", result);
        assert!(result.contains('ü'), "ü not decoded: {:?}", result);
        assert!(result.contains('ñ'), "ñ not decoded: {:?}", result);
    }

    #[test]
    fn test_extract_yaml_cp1252_interlagos() {
        // Autódromo José Carlos Pace — ó=0xF3, é=0xE9 in CP1252
        let mut data = b"TrackName: Aut".to_vec();
        data.push(0xF3); // ó
        data.extend_from_slice(b"dromo Jos");
        data.push(0xE9); // é
        data.extend_from_slice(b" Carlos Pace\0");
        let result = extract_yaml_from_memory(&data, 0, data.len() as i32).unwrap();
        assert!(result.contains("Autódromo"), "ó not decoded: {:?}", result);
        assert!(result.contains("José"), "é not decoded: {:?}", result);
    }
}
