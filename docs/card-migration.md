# Moving to the bundled HomeCall Card

HomeCall 1.9.0 includes the dashboard card. Install and update only the HomeCall integration from now on. Existing `type: custom:homecall-card` configurations, speaker selections, and layout settings remain valid.

## Upgrade from the separate HACS card

1. Save a copy of your existing HomeCall dashboard card configuration and resource URL before upgrading. Keep it if you need to roll back.
2. Update HomeCall to 1.9.0 or newer and restart Home Assistant.
3. With UI-managed resources, HomeCall replaces recognized local resource URLs with `/homecall-assets/homecall-card.js?v=<content hash>`, keeping their resource IDs. It recognizes `/hacsfiles/homecall-card/homecall-card.js`, `/local/community/homecall-card/homecall-card.js`, and `/local/homecall-card.js`, including query strings. Other resources and dashboard configurations are untouched. If several recognized entries exist, they receive the same URL; the browser executes that module once.
4. Uninstall **HomeCall Card** from HACS. Keep **HomeCall** installed. This removes the obsolete card files, not your dashboard cards. Recheck **Settings → Dashboards → Resources** afterward: keep the bundled `/homecall-assets/homecall-card.js?v=…` module and remove any remaining old HomeCall Card resource. Resources requires Advanced Mode in your user profile.
5. Refresh all open dashboard tabs. In the Companion app, reset the frontend cache if an old card remains visible. Confirm **HomeCall** appears in the card picker, your existing cards load, and their configured speakers are available. Record and send a short announcement to confirm microphone capture and delivery.

If you used a different manual URL or a remote card URL, HomeCall deliberately leaves it untouched. Remove that old HomeCall resource yourself to avoid loading two card versions.

## YAML-managed resources

HomeCall does not rewrite your YAML. Replace the old HomeCall card resource in your existing resources list with exactly one module entry:

```yaml
- url: /homecall-assets/homecall-card.js
  type: module
```

Keep all other resource entries. Reload YAML resources using Home Assistant's `lovelace.reload_resources` action (or restart Home Assistant), then refresh the browser. The integration serves this file without HTTP caching; the versionless URL works across subsequent upgrades. HomeCall logs a setup reminder until it finds one correctly configured bundled module entry.

A YAML dashboard can still use UI-managed resources; automatic registration follows the **resource mode**, not an individual dashboard's mode.

## New installations

Install HomeCall and configure the integration. The card is included and registered at integration setup for UI-managed resources. Refresh the dashboard and add **HomeCall** from the card picker. YAML resource users use the entry above. The browser still requires a trusted HTTPS origin and microphone permission for recording.

## Rollback

If you return to a HomeCall release older than 1.9.0, reinstall the previous separate HomeCall Card version and restore its saved module resource URL. Remove the bundled `/homecall-assets/homecall-card.js` resource, restart Home Assistant, and refresh all dashboard tabs. Your existing dashboard card configuration continues to use `custom:homecall-card`.
