# Layout and configuration

## Native editor

Appearance controls whether the speaker picker is shown. Default recipients selects all allowed available devices or a custom list. Save the card and leave dashboard edit mode before judging its final size: edit handles and the preview can have different widths.

Speaker selection uses HA’s native selectable rows. The speaker name is on the main line, with integration and availability beneath it. Identical names remain separate routes (for example, DLNA and Music Assistant). Unavailable routes are disabled in the send picker but can remain saved defaults. Selecting more than one route to the same physical device can deliver the announcement more than once. Narrow cards use a viewport-bounded popover wide enough for the second line; long names retain their full text in the native tooltip.

**Show diagnostics** is optional and defaults to off. Enable it under **Troubleshooting** in the native editor, or set `show_diagnostics: true` in YAML, when investigating capture or playback issues. It exposes the measured timings in the status panel; recording behavior is unchanged.

A missing `default_targets` uses the integration defaults, or all allowed devices when none are configured; unavailable routes are skipped with a warning. An explicit empty array selects none. New recordings retain the current in-card selection; a configuration rebuild initializes it from the saved defaults again.

Unavailable or missing default recipients, and selected routes that become unavailable before recording, produce a warning even with diagnostics off. The available recipients still receive the announcement. The result identifies the skipped routes and stays visible until a new announcement is started; an audio fetch cannot clear it. Recovered routes are not automatically reselected: select them explicitly. **Select all** chooses the currently available routes and clears the skipped-recipient warning; clearing all recipients does the same.

After partial delivery, the microphone action starts a new recording with one tap. It does not resend the previous audio. Complete delivery shows the confirmation check and returns to ready after five seconds; a failed send shows Retry. Partial delivery retains its warning until the next recording.

## Sections sizing

Use standard `grid_options`; the default and minimum suggested size is 6 columns by 1 row. The card's own minimum height is 56px. Widths and heights vary with the section and viewport; grid dimensions do not guarantee a fixed pixel size.

```yaml
type: custom:homecall-card
grid_options:
  columns: 6
  rows: 1
```

## Layout rules

- Cards below 120px high use a horizontal layout: the action and discard share the vertical centerline. The speaker is centered alone when the timer is hidden; when visible, the speaker icon and timer form a centered group with a clear gap. With no picker, the timer and recording dot are centered vertically. The action is up to 36px across; the waveform stays between the side controls. Speaker selection opens in a viewport-bounded popover outside the card. Existing native icons, controls, theme colors, fonts, and countdown behavior are reused.
- Taller cards keep the existing layout. Their action diameter stays within 52–240px and scales with available width and height.
- With a picker, the action clears the selector's upper corner using its actual height: 32px for the text selector and 44px for the compact header.
- With no picker and no caption, the action stays vertically centered.
- A caption appears only when the center footer slot has enough room. With no picker and a visible caption, the action may move upward to use available space.
- Captions share Home Assistant's standard caption font size in every state and wrap to at most two lines in the existing footer slot. Long actions use concise captions while their full descriptions remain available to assistive technology and in the button tooltip. Compact cards use the spinner and recording indicators when there is no caption slot.
- Full-size caption cards use an 8px bottom footer inset while retaining their top and side padding and native 44px footer touch areas. The halo leaves at least 12px above a two-line caption.
- Compact icon-only cards keep footer controls inset by 8px plus the card border. Their timer omits the additional end inset used on larger cards.
- The full decorative halo reserves at least 8px clearance from delete and timer rectangles, even while those controls are hidden. This keeps size and position stable during recording.
- A 120px-high two-row card reserves the same footer clearance below and above 200px wide. Its circle grows with the available width instead of shrinking when dashboard edit mode changes the card width slightly. Padding and footer alignment stay unchanged.
- Small cards can show only a modest size increase when hiding the picker. Footer clearance remains a constraint.

## Recording states

| State     | Visible action                                            | Behavior                                                      |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| Ready     | Blue microphone, **Start microphone** where space permits | Starts microphone preparation                                 |
| Starting  | Immediate spinner; no recording ring, dot, or timer       | Acquires the microphone and waits for the first input samples |
| Recording | Red microphone, ring, waveform, dot, and timer            | Captures up to 60 seconds; tap to send                        |
| Stopping  | Busy action                                               | Flushes final samples before releasing the microphone         |
| Recorded  | Blue send icon                                            | At the limit, waits for explicit send                         |
| Sending   | Busy action                                               | Uploads audio and awaits acceptance                           |
| Sent      | Check on full acceptance; microphone on partial delivery  | Full acceptance resets after 5 seconds; partial keeps details |
| Error     | Retry                                                     | Detailed status explains the failure                          |

Discard invalidates the current session, stops tracks, disconnects the audio processor, clears buffers, and preserves recipient controls. The card can reuse a suspended audio context after capture, but closes an in-progress startup context on cancellation. No microphone track stays open between recordings. Late microphone and HTTP callbacks cannot update a discarded recording.

Recipients are frozen during capture and until sending. The countdown uses captured samples. There is no fixed startup wait, stop delay, chime or silence added to normal recordings. First-sample and flush timeouts are failure deadlines, not minimum waits.

Readiness visuals use the card's phase as their single source of truth. Finishing and sending remove recording markers immediately. Control positions reserve the same space across phases, including when the timer is hidden during preparation.

Successful sends use the existing check action. Partial delivery retains a warning with details and a microphone action for a new recording; an audio-fetch receipt cannot erase that warning. Warnings and errors do not disappear on a timer. Starting a new recording clears the previous delivery result; a pending skipped-recipient warning remains relevant until the selection changes. The details popover closes when clicking outside it or pressing Escape. Normal loading, recording, finishing, sending, and successful delivery do not add a duplicate status icon.
