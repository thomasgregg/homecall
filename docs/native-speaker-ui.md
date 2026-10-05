# Native speaker UI component review

The component inventory was reviewed before implementing the shared Alexa/DLNA settings layout. Sources are the official [HA frontend component directory](https://github.com/home-assistant/frontend/tree/dev/src/components) and [design gallery](https://github.com/home-assistant/frontend/tree/dev/gallery). The review covers controls applicable to speaker selection, expandable settings, discovery, test progress, confirmation, errors, and saving; it does not introduce a second component library.

| Need | Reused HA element | Decision |
| --- | --- | --- |
| Page and navigation | `hass-subpage` | Existing router-loaded native header and navigation. |
| Surface | `ha-card` | Default card surface, borders, radius, and theme. |
| Speaker rows | `ha-list-base`, `ha-list-item-base` | Native row layout, headline, supporting text, leading and trailing slots. |
| Selection | `ha-checkbox` | Native checked, disabled, indeterminate states and accessibility. |
| Per-speaker settings and discovery | `ha-expansion-panel` | Native chevron, keyboard activation, expanded-state events, and region semantics. |
| Test, confirmation, removal, save | `ha-button` | Native accent/brand primary and plain secondary variants. |
| Progress, confirmation, errors | `ha-alert` | Native info/error styling and feedback icons. |
| Existing connection form and lazy loading | `ha-form` | Existing HA selectors; schema loading imports expansion and checkbox modules. |

Alternative HA list/select controls (`ha-check-list-item`, `ha-list-selectable`, `ha-md-list-item`, selector dropdowns) were considered. Basic slotted rows and checkboxes fit selection plus independent per-speaker settings without an extra picker or custom row component. The native expansion panel already implements accessible collapse/expand behavior, so no custom chevron or animation is needed. A text-bearing native info alert communicates test progress without a bespoke spinner.

APIs checked against official sources:

- [Row slots and default sizing](https://github.com/home-assistant/frontend/blob/dev/src/components/item/ha-row-item.ts)
- [List container](https://github.com/home-assistant/frontend/blob/dev/src/components/list/ha-list-base.ts)
- [Checkbox](https://github.com/home-assistant/frontend/blob/dev/src/components/ha-checkbox.ts)
- [Expansion panel slots and events](https://github.com/home-assistant/frontend/blob/dev/src/components/ha-expansion-panel.ts)
- [Button appearances and variants](https://github.com/home-assistant/frontend/blob/dev/src/components/ha-button.ts)
- [Alert types](https://github.com/home-assistant/frontend/blob/dev/src/components/ha-alert.ts)
- [Form schema module loading](https://github.com/home-assistant/frontend/blob/dev/src/components/ha-form/ha-form.ts)

CSS belongs to layout and spacing, not native-control internals. Supporting text uses HA theme variables; no literal colors, theme branches, custom shadows, borders, radii, icon sizes, or component-part overrides are introduced. No new custom UI element is registered. The existing `homecall-settings` panel continues to compose native controls.

Browser tests use native-control stand-ins for behavior and inherited theme variables. They cannot certify pixel-perfect native HA rendering or audible playback on a physical speaker; these require an installed-HA check before release.

Current appearance: navigation icons and expansion chevrons use `--secondary-text-color`. Speaker labels and the discovery label use the native header slot with `--ha-font-weight-normal`. The selection heading is a native list headline. Save uses accent/brand; secondary actions, including Remove and Refresh, use plain/brand. Checkbox sizing and internals remain native.

Refresh sits above the speaker list in the expanded discovery content, outside the clickable summary, with 16px top and side insets. It is hidden when discovery is collapsed and preserves the panel state when used. Chevron layout is retained per the user's request.
