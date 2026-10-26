# Graphic direction: the current through the page

## Idea

Voltix is remembered by one quiet gesture: a circuit trace follows the visitor through the page, then lights one small node at each service section. The hero establishes the blueprint; subsequent sections receive the same current. The signature stays behind the information rather than competing with it.

## Visual system

- Reuse the existing `--electric` token and the existing dark base (`--bg`, currently `#090D16`); add no new accent color.
- Keep the blueprint grid, arc and pointer light below text contrast. Text and controls remain untouched.
- Use one hairline conductor at the logical inline-start edge on desktop. On narrow screens, remove the page-length trace rather than crowd the content.
- Add small SCADA corner marks and a restrained hover edge to existing cards. Existing content remains the visual hierarchy.
- Draw section separators only as a faint continuation of the trace. Keep grain at or below 0.02 opacity.

## Motion and accessibility

- The only continuous movement is the trace progress and the desktop pointer light. Both are disabled by `prefers-reduced-motion`; the remaining decoration is static.
- Hover effects require a fine pointer. On small screens and constrained devices, use the static/light presentation.
- Decorative layers are pointer-transparent, have no layout footprint and are gated by `html[data-fx="on"]`. Removing that attribute disables the signature immediately.
- Focus visibility remains at least as prominent as the existing focus ring. No text, labels, controls or reading order are changed.

## Implementation boundaries

- The isolated `GraphicSignature` island is the only new client JavaScript. It observes document size and section positions, schedules at most one animation frame per scroll update, and tracks pointer position only on fine-pointer devices.
- All visual effects use `vx-fx-` selectors. The overlay is below site controls and below all modal/dialog layers.
- Effects target the existing hero and section/card surfaces; they do not add wrappers or alter component state.

## Layer sequence

1. Tokens, opt-in attribute, and z-index map.
2. Hero blueprint and pointer light.
3. Page conductor and section nodes.
4. Card edges and section dividers.
5. Craft details: focus-safe selection, restrained grain, and reduced-motion behavior.

The acceptance baseline is the captured set in `baseline/`. Since each layer is paint-only, all measured element rectangles must remain within 1 CSS pixel of that baseline.
