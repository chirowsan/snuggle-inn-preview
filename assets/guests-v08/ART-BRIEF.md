# Additive painted hotel pack, v0.8

All deliverables are isolated here. No original character, hotel, rush-wing, main manifest, or game code was changed.

## Ready to integrate

- `guest-manifest.json`: additive renderer metadata. Merge `actors` and `actions` into the original manifest in memory. IDs are `cat`, `family`, and stationary `chef`; original rabbit remains `guest`.
- `cat-walk.webp` and `bear-family-walk.webp`: four poses each in a 2×2, 768×768 sheet. Individual 384×384 frames are also supplied. Each has idle and portrait artwork.
- `chef-work.webp`: two stirring poses in a 768×384 sheet. Chef has a separate idle and portrait. Chef is stationary, not a walking character.
- `room-luxury.webp` and `room-family.webp`: 256×416 transparent arched room glimpses. Family room visibly includes a separate small bed and toys.
- `service-wing.webp`: complete opaque 1200×700 floor with restaurant, grooming salon, and massage bays. It has no stairs. Existing stairs belong over the right side.
- Historical review-only contact sheets now live at `docs/qa/guest-preview-v08.jpg` and `docs/qa/additions-preview-v08.jpg` in the source/evidence recovery package. They are not runtime assets.

## Renderer contract

All character frame canvases are 384×384 with foot anchors [256, 356], matching the original game. Walking uses sequence [0,1,2,3] at 8 fps; chef work uses its two `work_frames` at 3 fps. `portraits` is keyed by actor ID. `rooms`, `serviceWing`, and `paths` explicitly identify the additive architectural images and portraits. Every reference was verified on disk before metadata was published.

The normalized character artwork is about 263px tall, matching the original rabbit; an 80px rendered frame gives approximately 55px visible body height. The family includes both adult and cub in every pose and portrait. Cat and bear cycles have four distinct limb configurations, including passing and lifted-knee phases, not copies moved up and down.

Suggested room overlay size is 124×216 game-space pixels. Fit its teal inner jamb to the existing teal door leaf while leaving the original sandstone arch and surrounding hallway visible. Fine placement belongs to integrated screenshot QA because the existing corridor rendering stretches/crops the source.

Service visual bay centers are approximately x182, x490, and x800, with thresholds at y330. The requested interaction points [240,250], [530,250], and [820,250] lie within the corresponding bays. The rightmost area [950,0,250,700] is reserved for the staircase overlay.

## Source and QA

Created with OpenAI's built-in image generation/editing tool using the actual original `guest-idle.webp`, `guest-portrait.webp`, `rabbit-walk.webp`, and `rush-wing.webp` pixels as references. The full original background was inspected to match lighting and perspective. Generated source images are preserved outside the published pack. Processing was limited to standard cell cropping, resizing, transparent canvas packing, and WebP encoding. Source alpha was preserved; alpha thresholds were used only to measure bounding boxes.

QA checked transparent edges against a light background, all four walking silhouettes, two-animal readability at approximately 55px, both beds in the family room, all three distinct service rooms, absence of stairs/characters/text in the background, and file existence. The cycles are compact hand-painted sprite cycles, not skeletal rigs.

Runtime WebP total: 940,306 bytes. Guest-only runtime assets: 552,456 bytes. Review JPEGs and metadata are additional and do not need to be preloaded.
