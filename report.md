I compared photocraft's PSD handling against ag-psd in four areas, run in parallel: file structure and pixels, descriptors/effects/adjustments, smart objects/text/document blocks, and side formats. The comparison used ag-psd's current code (2a713df) and roughly 900 sample files: ag-psd tests, the psd-tools corpus and the photocraft corpus. Neither repository was modified. Items not marked as unverified were reproduced or are unambiguous in the code, and I re-ran the most important ones myself.

### Bugs that hit real Photoshop files (highest priority)

1. **Unknown or settings-less smart filters are silently removed.** Levels, Hue/Saturation, Camera Raw, Filter Gallery, and Shadows/Highlights or Radial Blur at default settings all disappear on read, so writing changes what the smart object renders ([additionalInfo.ts:2709-2736](src/additionalInfo.ts#L2709-L2736)). Photocraft keeps such filters' data unchanged instead. I reproduced it: `sf-levels.psd` and `sf-shadows-highlights.psd` read as an empty filter list.
2. **A Curves smart filter without `presetKind` crashes, and the whole filter stack is dropped** ([additionalInfo.ts:2676](src/additionalInfo.ts#L2676)). Photoshop 2026 leaves that key out. I reproduced it with `sf-curves.psd`.
3. **A transparent composite reads as opaque** when transparency is marked by `Mtrn`/`Mt16`/`Mt32` or the alpha channel has a name ([psdReader.ts:1086-1109](src/psdReader.ts#L1086-L1109)). I reproduced it with psd-tools' 32-bit `transparentbg.psd`: alpha is 1.0 everywhere.
4. **One layer with negative bounds makes the whole file fail** with "Invalid layer size" ([psdReader.ts:473](src/psdReader.ts#L473)). I reproduced it with psd-tools' `vector-mask2.psd`. Photocraft treats such a layer as empty.
5. **PSB writing uses 4-byte lengths for keys Photoshop writes with 8 bytes:** `lnkE`, `lnk3`, `pths`, `artd`, `extn`, `extd`, `FELS` ([helpers.ts:47](src/helpers.ts#L47)). Readers that decide the length size by key misread the rest of the layer's data. Photocraft and psd-tools both use this key list.
6. **Outer glow and stroke gradients lose their interpolation method.** Photoshop stores it as `gradientsInterpolationMethod`, but effects only read `gs99` ([descriptor.ts:1558](src/descriptor.ts#L1558)). I reproduced it with `outer-glow-gradient.psd`.
7. **Gradient fill and gradient stroke scale/offset are rounded to whole percent** on write ([descriptor.ts:1831-1835](src/descriptor.ts#L1831-L1835)). The fix is `unitsPercentF`.
8. **Hue/Saturation colorize is mapped to the wrong fields.** `master.a/b/c/d` actually hold the colorize flag and its hue/saturation/lightness ([additionalInfo.ts:4507](src/additionalInfo.ts#L4507)). The bytes round-trip, but you can't read or set colorize properly.
9. **`vstk` crashes without `strokeStyleLineDashSet`**, losing the whole vector stroke ([additionalInfo.ts:1107](src/additionalInfo.ts#L1107)). Seen in psd-tools files, probably not written by Photoshop.
10. **Faux bold/italic font variants merge on write.** The font lookup matches on name only, ignoring `Synthetic` ([text.ts:371](src/text.ts#L371)).
11. **Linked smart objects (`SoLE`) are written back as `SoLd` + `PlLd`.**
12. **Pattern transparency is ignored on read**, even though `writePattern` writes it. Indexed RLE and 16-bit patterns throw, and the first failure drops every pattern after it.

### Malformed input (hardening)

- **ABR has no memory limit:** `readAbr` creates its reader without one, so a 100-byte file can allocate 1.6 GB ([abr.ts:520](src/abr.ts#L520)).
- **ABR sample size isn't checked against the buffer:** sample lengths are checked against the file's own length field, not the real buffer size, so a 304-byte file decodes a 10000×10000 brush ([abr.ts:541-566](src/abr.ts#L541-L566)).
- **Pattern channel rectangles aren't checked against the pattern rectangle**, so a tiny file can make the decoder loop for seconds or longer ([psdReader.ts:1658](src/psdReader.ts#L1658)).
- **One unknown part fails the whole file** in ABR (an `lPdc` section, an unknown brush class, an unsupported pattern mode) and in ASE (an unknown block or color model, or a non-zero minor version). Photocraft skips these with a warning.

### Data lost on round-trip

- Image resources without a handler are dropped: IPTC, print style and flags, saved paths 2000-2998, clipping path, and more.
- Extra composite channels (alpha and spot) are dropped, while their names and identifiers are still written back.
- Effect contour corner points (`Cnty`) are lost, so corner contours come back smooth.
- Bevel texture `textureDepth` and `InvT` are dropped.
- Line and polygon shape origination keys in `vogk` are dropped.
- Layer comp appearance data (`Lefx`, `blendOptions`, `vectorMask` per comp) is dropped.
- Per-layer XMP (`cust`/`layerXMP`) is dropped.
- Version 8 linked files lose `contentID`.
- SoLd `ClMg`/`Impr` are not written back.
- TySh `TxMP`/`TxPT`/`TxPR`/`VAlign` are not written back.
- Unhandled keys are dropped: `vmgm`, `abdd`, `extn`/`extd`, `CAI `/`OCIO`/`GenI`, `PxSD`, `FELS`, `shpa`, `anFX`.

### Missing features

- **Kerning mode and OpenType features from Txt2:** EngineData stores off, metrics and optical kerning all as `AutoKerning: true`; the real mode is only in Txt2.
- **Named paragraph/character style sheets aren't resolved**, so a style's alignment or font isn't inherited. Unverified: no local sample uses them.
- **Color modes and compression:** CMYK, Lab, Multichannel and Duotone can't be read at all; 72 corpus files fail. ZIP-compressed composites also fail.
- **ABR v1/v2** isn't supported, the Brushes panel folders (`phry`) are parsed and thrown away, and 16-bit samples are reduced to 8-bit.
- **Side formats ag-psd lacks:**
  - Low effort, since ag-psd already has the building blocks: GRD gradients, ASL layer styles, ACO and ACT color files, SHC contours, PAT patterns.
  - Medium effort: ATN actions.

### Unverified (no sample file to confirm)

- Photo filter version 3 colors are probably XYZ, not Lab. The code itself has a "probably wrong" TODO.
- Curves with pencil-drawn maps or version 4 are unsupported.
- Deep knockout (value 2) collapses to a boolean.
- The indexed-color transparent index (resource 1047) is ignored.
- Lr16/Lr32 data plus an 8-bit compatibility layer section could produce duplicate layers.
- `Idnt`/`indx` references are read without their class.

### Where ag-psd is equal or better

- 16/32-bit ZIP prediction matches photocraft exactly (490 channels checked).
- RLE decoding is more tolerant of truncated data.
- Animation and timeline data is fully decoded; photocraft only keeps it raw.
- Smart filter coverage is otherwise wider: puppet warp, liquify, oil paint, adaptive wide angle, perspective warp.
- Legacy `lrFX` effects, noise gradients and the full vector stroke style are better handled.
- `artd` and `liFE` are read correctly; photocraft misinterprets both.
- All of photocraft's 8-bit RGB adjustment files and 36 of its 37 effect files round-trip cleanly.

Suggested order: the smart filter loss and Curves crash (1–2), composite transparency (3), negative layer bounds (4) and the PSB key list (5). Then the three ABR hardening fixes, then the quick fixes: glow interpolation method, `unitsPercentF`, the `vstk` guard and a `vmgm` handler. Want me to start on those?







Done. All tests pass (497 passing, 15 pending). The log shows 22 unhandled image resource IDs, one unhandled additional info key (`CAI `), one unhandled `shmd` item (`extn`), and one warning that turns out to be a false alarm. `GenI` and `OCIO` are also unhandled, but their log lines are suppressed, so I included them. I dumped real examples of each from the test files to judge how feasible each one is.

**Two problems found along the way**

- **Animations can be lost (bug).** Photoshop stores animation data (`mani`/`IRFR`) in whichever plug-in resource ID (4000–4999) is free. ag-psd only reads it from ID 4000, so `layer-mask`, `cat` and `ignore-missing-stroke` have animations at 4003 that are silently dropped. The fix is easy: dispatch all 4000–4999 IDs by the key inside the data instead of by ID.
- **"Unhandled effect keys: { Scl }" is a false warning.** `Scl ` is already read as `effects.scale`; it just isn't excluded from the leftover-keys check. One-line fix.

**Image resources**

| ID | What it is | Seen | Feasibility |
|---|---|---|---|
| 1039 | ICC color profile | 117× | **Trivial.** Expose the raw bytes; no parsing needed. |
| 1083 | Print style | 152× | **High.** A plain descriptor (`printOutputOptions`, about 25 keys), same pattern as the existing 1082 handler. |
| 10000 | Print flags info | 153× | **High.** Documented 10-byte layout: version, center crop marks, bleed width and its scale. |
| 1013 / 1012 | Halftone screens (color / grayscale) | 147× / 4× | **High.** 18-byte records (frequency, angle, shape, flags). The samples decode to Photoshop's defaults (47.4 lpi, 108.4°/161.6°/90°/45°). Mostly print data. |
| 1016 / 1015 | Transfer functions (color / grayscale) | 147× / 4× | **High.** 13-value curve plus an override flag per channel, documented. |
| 1077 | Display info for alpha/spot channels | 58× | **High.** Version plus 13 bytes per channel (color, opacity, kind); sample sizes 4/17/30 match 0/1/2 channels. |
| 1046 / 1047 | Indexed color count / transparent index | 1× each | **High.** One number each. 1047 would also make that palette entry transparent, which was an unverified item in the comparison. |
| 1025 / 2000–2997 / 2999 / 3000 | Working path, saved paths, clipping path name, path origin info | 12× / 1× / 0 / 1× | **High, moderate effort.** Paths use the same record format as vector masks, and 3000 is the same descriptor as `vogk`, so existing parsers can be reused. The main work is designing the public field. |
| 1028 | IPTC metadata | 82× | **High as raw bytes.** Splitting it into records is easy if wanted. |
| 1058 | EXIF data | 154× | **Raw bytes only.** It's a TIFF/EXIF block; parsing it is out of scope. |
| 1085 | Windows printer settings (DEVMODE) | 4× | **Raw bytes only.** OS-specific printer state with nothing useful to parse. |
| 1092 | Undocumented | 35× | **Low.** A header (2, 576, 576, count) plus 12-byte records of unknown meaning. Raw bytes only. |
| 1097 | Undocumented | 3× | **Low.** Always 4 zero bytes. Raw bytes only. |
| 4001–4004: `mfri`, `mset`, `ms4w` | Undocumented plug-in data | 17×, 8×, 2× | **Low.** `mset` is a descriptor holding just `Version`; the others are small binary blobs. Raw bytes, keyed by their inner key. |

**Additional info**

| Key | What it is | Seen | Feasibility |
|---|---|---|---|
| `CAI ` | Content credentials state | 18× | **High.** Small descriptor after a version number: `{ enab, generationalGuid }`. Not the full credentials manifest. |
| `OCIO` | Document color management (log line suppressed) | 14× | **High.** Descriptor `documentColorManagementInfo { Knd , ocio_display_view { display, view } }`. |
| `GenI` | Generative AI info (log line suppressed) | 21× | **High.** `isUsingGenTech` plus `externalModelList`, which is always empty in samples (as discussed earlier). |
| `shmd` → `extn` | Generator / Export As settings | 7× | **High.** Descriptor with `exportOption` and `scaleSettings` JSON strings. Currently dropped on write. |

The "Unread section data" lines for `ignore-head2` and `ignore-krita` come from files written by other apps with extra padding. There's nothing to implement there.

The test files don't exercise everything. The earlier comparison also found other unhandled keys in the photocraft and psd-tools samples (`vmgm`, `abdd`, `PxSD`, `FELS`, `shpa`, `anFX`, `sgrp`, `ffxi`, …).

**Suggested order**

1. The animation bug and the false warning.
2. The high-value easy ones: ICC profile, the `CAI `/`OCIO`/`GenI`/`extn` descriptors, print style and print flags.
3. Display info and transfer/halftone data.
4. Paths, which need some public API design.
5. Keep the undocumented ones as raw bytes so they round-trip.

Want me to start with step 1?
