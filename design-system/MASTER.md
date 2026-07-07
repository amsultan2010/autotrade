# Autotrade Design System — Obsidian Terminal

**Direction**: Skeuomorphic maximalism — obsidian surfaces, gold accents, instrument-panel density, living FX.

## Tokens
- Background: `#06060a`
- Surface: `#0c0c12` / `#12121a`
- Gold accent: `#d4af37`
- Positive P&L: `#00c896`
- Negative: `#ff3b52`

## Material classes
- `.material-panel` — raised console panel with gradient border
- `.material-inset` — recessed readout
- `.material-button` — physical press button
- `.btn-gold` — primary gold CTA with depth
- `.hud-corners` — corner bracket accents

## Atmospheric FX
- `AmbientFx` — constellation particles + scanlines + grain + vignette
- `ConstellationBg` — canvas particle network + data rain

## Typography
- Display: Syne
- UI: Inter
- Data: IBM Plex Mono

## Motion
- framer-motion for page reveals, card hover, hero stagger
- Respects `prefers-reduced-motion`
