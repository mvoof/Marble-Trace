#[test]
fn trybuild_tests() {
    let t = trybuild::TestCases::new();

    // Test successful compilations
    t.pass("tests/pitwall_frame/pass/*.rs");

    // Test expected failures
    t.compile_fail("tests/pitwall_frame/fail/*.rs");
}
