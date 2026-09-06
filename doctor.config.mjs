/**
 * React Doctor — the static layer of the rendering work.
 *
 * It reports generic React and JavaScript anti-patterns when run by hand — it
 * is a sweep, not a gate, and `docs/agents/react-doctor.md` says why. It
 * knows nothing about which of this project's telemetry fields are hot, so it
 * cannot check the rendering rule; that is what the render budgets in the
 * `*.perf.test.tsx` files are for. See `docs/rendering.md`.
 *
 * Every rule switched off below was reviewed once against the code that
 * triggered it. A rule stays on unless leaving it on would mean carrying
 * findings nobody intends to act on.
 */
export default {
  rules: {
    // Its defaults contradict this repo's own layering, which is enforced by
    // `no-restricted-imports` overrides in `.oxlintrc.json`. Every hit is a
    // `platform/` module importing `@tauri-apps/*` — the one layer allowed to.
    'eslint/no-restricted-imports': 'off',

    // Micro-optimisations on cold paths: settings, layout maths, migrations.
    // What runs per telemetry frame is governed by the render budgets, which
    // measure instead of guessing.
    'react-doctor/js-combine-iterations': 'off',
    'react-doctor/js-length-check-first': 'off',
    'react-doctor/js-index-maps': 'off',
    'react-doctor/js-set-map-lookups': 'off',
    'react-doctor/async-await-in-loop': 'off',

    // Structural preferences this project decides for itself: widget rows are
    // deliberately one component per row shape (`docs/rendering.md`), settings
    // panels share `Card` and its row helpers by design, and a control-flow
    // count does not distinguish a branchy render from a badly split one.
    'react-doctor/no-high-complexity-react-function': 'off',
    'react-doctor/duplicate-jsx-subtree': 'off',
    'react-doctor/only-export-components': 'off',

    // Left on deliberately, though each one currently fires once on code that
    // explains itself in a comment beside it: `no-mirror-prop-effect`
    // (a committed-on-blur number field), `no-self-updating-effect` (the
    // layout editor's preview store, created once), `no-array-index-as-key`
    // (chat fragments, which never reorder). They are correct rules about
    // behaviour, not style, and a second occurrence is worth a fresh look.
  },
};
