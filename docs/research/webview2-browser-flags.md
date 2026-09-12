# WebView2 browser flags for the overlay window

Research task: which Chromium command-line switches WebView2 actually honours via
`AdditionalBrowserArguments` / `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, and which of
those matter for a transparent, always-on-top, frequently-occluded overlay window
built with Tauri 2 on Windows.

## What to actually do

- **Don't reach for `--disable-renderer-backgrounding`,
  `--disable-background-timer-throttling`, or `--disable-backgrounding-occluded-windows`.**
  There is no Microsoft documentation stating WebView2 honours them, and the
  mechanism they target (Chromium backgrounding an _occluded or unfocused_ renderer)
  is not what WebView2's own throttling is keyed on in the first place — WebView2
  throttles based on the app-controlled `IsVisible` property, not window occlusion
  or focus. Setting flags Microsoft doesn't document is a shot in the dark on a
  build (WebView2 Runtime) Microsoft revs independently of this app; treat them as
  a dead end.
- **The actual lever is `ICoreWebView2Controller::put_IsVisible`.** WebView2 only
  drops into its low-activity/throttled substate when the app sets `IsVisible =
false` — Microsoft's own guidance is to flip it in response to `WM_SIZE`
  (`SIZE_MINIMIZED` / `SIZE_RESTORED`). The overlay window in this app is
  always-on-top and frequently occluded by the sim but is not minimized, so it is
  already outside the case Microsoft optimizes for either way — occlusion alone
  does not throttle a WebView2 host. If overlay CPU/memory while the sim covers it
  is ever a real problem, the fix is to drive `IsVisible` (or
  `MemoryUsageTargetLevel = Low`, see below) from the app's own occlusion signal
  (`WM_WINDOWPOSCHANGED` + `IsWindowVisible`/`DwmGetWindowAttribute` hit-testing, or
  simply the "hide overlay when game closed" logic already in `platform/sync/`)
  reached through `PlatformWebview`, not a launch switch.
- **`--disable-features=…` is the one category that reliably reaches WebView2.**
  Tauri/wry already sends one on every window
  (`--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`), so
  `additionalBrowserArgs` is proven to survive the trip to the browser process for at
  least `--disable-features`/`--enable-features`. GPU/ANGLE switches
  (`--use-angle`, `--disable-gpu-vsync`, `--disable-frame-rate-limit`,
  `--disable-gpu-compositing`) are not called out as unsupported by Microsoft either,
  but nothing in the primary sources confirms they're honoured — this is genuinely
  undocumented territory; verify empirically (a screenshot + `chrome://gpu` inside
  the overlay webview) before relying on any of them, and keep the default GPU path
  (`--disable-gpu-compositing` would fight the transparent/alpha surface the overlay
  needs) unless a specific problem shows up.
- **Set browser args once, before any WebView2 environment exists**, and know they
  are process-wide, not per-window (see §4). In Tauri 2 the supported, current-API
  way is the `additionalBrowserArgs` field on `WindowConfig` /
  `WebviewWindowBuilder` (§5) — not an env var hack, and not `tauri.conf.json`
  alone if more than one window/webview is created, because a second webview
  reusing the same user-data-folder cannot change what the first one already set.

## Evidence

### 1. Which switches WebView2 honours vs. silently drops

Microsoft's own reference for `AdditionalBrowserArguments` is explicit but narrow:

> "If you specify a switch that is important to WebView functionality, it is
> ignored, for example, `--user-data-dir`. Specific features are disabled
> internally and blocked from being enabled. […] The features specified by
> `--enable-features` and `--disable-features` will be merged with simple logic:
> the features are the union of the specified features and built-in features. If
> a feature is disabled, it is removed from the enabled features list. […] If a
> switch fails to parse, the switch is ignored."
> — [`CoreWebView2EnvironmentOptions.AdditionalBrowserArguments`, Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/winrt/microsoft_web_webview2_core/corewebview2environmentoptions)

This is the entirety of Microsoft's documented allow/deny list: switches "important
to WebView functionality" (their one named example is `--user-data-dir`) are
dropped; everything else is passed to the Chromium browser process as-is, with
`--enable-features`/`--disable-features` merged rather than overwritten. Microsoft
does **not** publish a complete enumerated list of which of the hundreds of
Chromium switches are silently eaten beyond that — there is no page equivalent to
a "supported switches" table. Absent such a list, the only reliable way to know
whether a given switch changed anything is to check its effect at runtime (e.g.
`chrome://gpu`, `chrome://version` inside the webview, or observed behavior).

### 2. Throttling switches

No Microsoft document mentions `--disable-renderer-backgrounding`,
`--disable-background-timer-throttling`, or `--disable-backgrounding-occluded-windows`
in connection with WebView2 at all — they do not appear on the
`AdditionalBrowserArguments` reference page, the WebView2 changelog, or the
performance-best-practices doc searched for this task. That silence is itself the
finding: Microsoft's documented throttling control is a different, first-party
mechanism, not a Chromium command-line switch:

> "If `IsVisible` is set to `false`, the WebView is transparent and is not
> rendered. […] For performance reasons, developers should set the `IsVisible`
> property of the WebView to `false` when the app window is minimized and back to
> `true` when the app window is restored. […] There are CPU and memory benefits
> when the page is hidden. For instance Chromium has code that throttles
> activities on the page like animations and some tasks are run less frequently.
> Similarly, WebView2 will purge some caches to reduce memory usage."
> — [`CoreWebView2Controller.IsVisible`, Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2controller.isvisible)

So: WebView2's documented throttling substate is driven by the app flipping
`IsVisible`, tied by Microsoft's own example to `WM_SIZE` minimize/restore — not to
occlusion or focus loss. An always-on-top overlay that is fully covered by the sim
but not minimized is not a case Microsoft says triggers throttling at all, with or
without switches. There is a second, complementary first-party lever for the
"stays visible but idle" case — `CoreWebView2.MemoryUsageTargetLevel`:

> "[Setting] `MemoryUsageTargetLevel = CoreWebView2MemoryUsageTargetLevel.Low` […]
> is useful for inactive apps that still want to run scripts and/or keep network
> connections alive […] Setting the level to `Low` could potentially cause memory
> for some WebView browser processes to be swapped out to disk […] apps can set the
> memory usage target level to `Low` when the app becomes inactive, and set back to
> `Normal` when the app becomes active."
> — [`CoreWebView2.MemoryUsageTargetLevel`, Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.memoryusagetargetlevel), spec at [WebView2Feedback/specs/MemoryUsageTargetLevel.md](https://github.com/MicrosoftEdge/WebView2Feedback/blob/main/specs/MemoryUsageTargetLevel.md)

Both `IsVisible` and `MemoryUsageTargetLevel` are runtime `ICoreWebView2Controller`
/ `ICoreWebView2` API calls, not launch arguments — they are set per-controller,
after creation, and can be flipped repeatedly as the app's own occlusion/focus
signal changes. That is the documented, supported answer to "how do I stop the
overlay from working as hard when it's covered," in contrast to the three
Chromium switches, which have no documented WebView2 effect at all (Chromium's own
source describes what they'd do in a bare Chromium/content embedder — see below —
but that description is silent on whether WebView2 routes them anywhere, and
Microsoft's docs never claim it does).

For completeness, Chromium's own source describes what these switches do to a
generic `content`-embedding browser (this is what they'd mean _if_ honoured, not
evidence that WebView2 honours them):

| switch                                     | Chromium's own description                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--disable-renderer-backgrounding`         | "Prevent renderer process backgrounding when set."                                                                                                                                                                                                                                                                                                                                                                                                             |
| `--disable-background-timer-throttling`    | "Disable task throttling of timer tasks from background pages."                                                                                                                                                                                                                                                                                                                                                                                                |
| `--disable-backgrounding-occluded-windows` | Chromium ships a _feature_ (not a plain switch) governing this — `BackgroundingOccludedWindows` — toggled via `--disable-features=BackgroundingOccludedWindows` / `--enable-features=…`, not a dedicated `--disable-backgrounding-occluded-windows` flag in current Chromium; treat the plain-switch spelling as unverified for the current WebView2 Runtime build and confirm against a live `chrome://version`/`chrome://flags` dump before depending on it. |

— [`content/public/common/content_switches.cc`, chromium/chromium on GitHub](https://github.com/chromium/chromium/blob/d925e7f357d93b95631c22c47e2cc93b093dacc5/content/public/common/content_switches.cc)

### 3. GPU / ANGLE / vsync switches

The `AdditionalBrowserArguments` reference (§1) does not name any GPU/ANGLE/vsync
switch as blocked, and unlike the throttling switches there is no first-party
WebView2 API standing in for them — so `--use-angle`, `--disable-gpu-vsync`,
`--disable-frame-rate-limit`, and `--disable-gpu-compositing` are plausible
candidates for "passed through as-is" under Microsoft's own rule ("if a switch is
specified multiple times, only the last instance is used… a merge […] is not
attempted, except for disabled/enabled features" — i.e. non-feature switches are
just forwarded unless WebView2 considers them "important to WebView
functionality"). No primary source confirms or denies any of these four
specifically; this is genuinely undocumented territory and the only sources found
searching Microsoft Learn, the WebView2Feedback repo, and the wry/Tauri source were
silent on them.

What is documented, and matters more directly for this app: WebView2 supports
transparent (alpha) rendering as a first-party feature (`put_DefaultBackgroundColor`
alpha = 0 on the controller), which is a compositor-level capability that is
already known to interact with the GPU path — Microsoft's own transparency
sample notes it requires the app to disable the swap-chain's own opaque
compositing assumptions on the host side. Nothing in Microsoft's docs says
`--disable-gpu-compositing` is needed or safe for a transparent WebView2 window,
and disabling GPU compositing generically risks falling back to a software path
that may not preserve alpha correctly. Given the overlay already renders correctly
transparent without any of these switches, treat them as an optimization to test
empirically (with a screenshot before/after and an eye on GPU process CPU in Task
Manager) rather than something to set blind.

### 4. Timing: environment-creation-time, process/profile-wide

`AdditionalBrowserArguments` lives on `CoreWebView2EnvironmentOptions`, consumed by
`CreateCoreWebView2EnvironmentWithOptions` / `CoreWebView2Environment.CreateAsync`
— i.e. it is read once, when the environment (and thus the shared browser process
for that user-data-folder) is created, and has no effect if changed afterward for
webviews sharing that same environment/profile. Tauri's own issue tracker records
exactly this failure mode when a second window tries to set different
`additional_browser_args` against the same profile:

> "\[bug\] failed to create webview: WebView2 error: WindowsError(Error { code:
> HRESULT(0x8007139F), message: 'The group or resource is not in the correct state
> to perform the requested operation.' … } )" when `additional_browser_args`
> differs between windows sharing a data directory.
> — [tauri-apps/tauri#11144, "document that changing additional_browser_args require changing data_directory if multiple webviews will be opened"](https://github.com/tauri-apps/tauri/issues/11144)

In practice for this app: `additionalBrowserArgs` must be decided before the first
webview (of either window, `main` or `overlay`) is created, and applied
consistently — either the same value on every window that shares the default
user-data-folder, or a distinct `dataDirectory` per window if they need to differ.
There is no supported way to change it later for a running environment; the only
lever available after creation is the runtime `IsVisible` /
`MemoryUsageTargetLevel` API from §2, which is exactly why that pair — not launch
switches — is the right tool for anything that needs to react to the overlay being
occluded mid-session.

### 5. How to set it from Tauri 2, concretely

Tauri 2 exposes this as a first-class, documented config field — `additionalBrowserArgs`
on the window config, Windows-only, with a doc comment that itself warns about the
wry default:

> **Type:** `Option<String>` · **Doc:** "Defines additional browser arguments on
> Windows. By default wry passes
> `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection` so if you use
> this method, you also need to disable these components by yourself if you want."
> · **JSON key:** `additionalBrowserArgs`
> — [`WindowConfig` in `tauri_utils::config`, docs.rs](https://docs.rs/tauri-utils/latest/tauri_utils/config/struct.WindowConfig.html)

That "by default wry passes …" line is the confirmation that wry (Tauri's runtime)
already calls `SetAdditionalBrowserArguments` unconditionally with
`--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`
(`wry/src/webview/webview2/mod.rs`, per the wry source referenced from the same
docs and Tauri's `feat(core): expose additional_browser_args to window config`
commit — [tauri-apps/tauri@3dc38b1](https://github.com/tauri-apps/tauri/commit/3dc38b150ea8c59c8ba67fd586f921016928f47c)) — the concrete proof that the
`AdditionalBrowserArguments` path from Tauri does reach `CoreWebView2EnvironmentOptions`
end-to-end, and that setting your own value **replaces** wry's string rather than
appending, so any custom value must repeat the three `disable-features` unless you
deliberately want them back.

Two supported ways to set it, both hitting the same underlying field:

- **`tauri.conf.json`**, per window — simplest, static, fine when the overlay
  window's args are known ahead of time and don't need to differ from `main`'s
  (recalling §4: differing values across windows on the same profile can error):

  ```json
  {
    "app": {
      "windows": [
        {
          "label": "overlay",
          "additionalBrowserArgs": "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"
        }
      ]
    }
  }
  ```

- **Builder API**, in Rust, before the window/webview is created — needed if the
  value has to be computed at runtime:

  ```rust
  use tauri::WebviewWindowBuilder;

  let overlay = WebviewWindowBuilder::new(app, "overlay", tauri::WebviewUrl::App("overlay.html".into()))
      .additional_browser_args("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection")
      .transparent(true)
      .always_on_top(true)
      .build()?;
  ```

  (Method name/signature per the same `WindowConfig`/`WebviewWindowBuilder` surface
  documented at [docs.rs/tauri-utils](https://docs.rs/tauri-utils/latest/tauri_utils/config/struct.WindowConfig.html); confirm the exact builder method name against the
  `tauri` crate version pinned in this repo's `Cargo.lock`, since Tauri notes the
  webview2-com surface can move between minor releases.)

The `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` **environment variable** is a separate,
lower-level mechanism WebView2 itself reads (documented as an override on
`CoreWebView2EnvironmentOptions`, see [`ICoreWebView2EnvironmentOptions`, Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2environmentoptions)) —
setting it in `main()` before `tauri::Builder::default().run(...)` would work in
principle (it's read at environment-creation time, same constraint as §4), but
there is a documented gotcha specific to it:

> "\[Problem/Bug\]: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` wins over an explicit
> `AdditionalBrowserArguments` property" — i.e. the env var, if set, overrides
> whatever the app passes through `CoreWebView2EnvironmentOptions`, not the other
> way around.
> — [MicrosoftEdge/WebView2Feedback#5571](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5571)

For an app already using Tauri's own `additionalBrowserArgs`, prefer that over the
env var — it's the explicit, in-repo, version-controlled value, and stacking the
env var on top only risks the override behavior above winning unexpectedly (e.g.
from a stray environment variable left by another install).

For the runtime `IsVisible` / `MemoryUsageTargetLevel` calls from §2 (which are
**not** launch arguments and so are irrelevant to `additionalBrowserArgs`/timing),
the concrete, current-API way in Tauri 2 is `WebviewWindow::with_webview`, which
hands back a `PlatformWebview` wrapping the native controller on Windows:

```rust
#[cfg(target_os = "windows")]
{
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller;

    overlay_window.with_webview(move |webview| {
        let controller: ICoreWebView2Controller = webview.controller();
        unsafe { controller.SetIsVisible(false) }.expect("SetIsVisible");
    })?;
}
```

(`with_webview` and the `PlatformWebview` type are documented at
[`Webview` in `tauri::webview`, docs.rs](https://docs.rs/tauri/latest/tauri/webview/struct.Webview.html); the Windows arm resolves to the `webview2-com` crate's COM
bindings, per Tauri's `feat(core): expose with_webview API to access the platform
webview` commit — [tauri-apps/tauri@c82b476](https://github.com/tauri-apps/tauri/commit/c82b4761e1660592472dc55308ad69d9efc5855b).)

### 6. Does Tauri/wry already set any of these, or offer its own throttling knob?

Yes to the first half, no to the second. wry unconditionally calls
`SetAdditionalBrowserArguments("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection")`
on every WebView2 environment it creates (confirmed by the `WindowConfig` doc
comment quoted in §5, which exists specifically to warn callers that setting their
own `additionalBrowserArgs` replaces — not appends to — that default). That is the
only default browser argument Tauri/wry sets; nothing in the sources checked
(the `tauri-utils` config docs, the `tauri` `with_webview`/`WebviewWindowBuilder`
docs, and the wry source referenced from the Tauri commit history) shows Tauri
setting any renderer-backgrounding, GPU, or vsync switch by default, and there is
no Tauri-level config knob (in `tauri.conf.json` or the builder API) for
background-webview throttling — that gap is exactly why §2's answer is "call the
WebView2 `IsVisible`/`MemoryUsageTargetLevel` API yourself through
`with_webview`," not "set a Tauri setting."
