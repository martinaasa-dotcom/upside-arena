# Fonts

Two subsets, for two different jobs.

## GeistMono-Variable.subset.woff2

The mono face the app itself ships, for everything in the `.figure` class:
money, percents, counts, ranks and the invite code. Subset because the full
variable font carries Cyrillic, Greek and 128 box-drawing glyphs this app can
never print, and woff2 does not shrink again on the wire.

What goes in it is decided by `MONO_SUBSET_RANGES` in
`src/lib/brand/mono-subset.ts`. Rebuild with:

    pip install fonttools brotli
    npm run fonts

Do not hand-edit the ranges into a command here. The list in that module is
what the script builds from and what `tests/unit/mono-subset.test.ts` checks,
and a copy in this file is a copy that goes stale.

## The three share-card subsets

Geist and Geist Mono, subset to the characters a share card can contain.

The share image is rendered by a converter with a hard bundle limit that
counts fonts, markup and assets together. Three full weights come to about
400KB and would eat most of it on glyphs no card will ever draw; subset, the
three come to 55KB.

Regenerate after changing what the card can say:

    pip install fonttools
    pyftsubset node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf \
      --output-file=assets/fonts/Geist-Regular.subset.ttf \
      --text="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:%+-–—()/'’&!?\"“”" \
      --layout-features='*' --no-hinting --desubroutinize

and the same for `Geist-SemiBold.ttf` and `geist-mono/GeistMono-Medium.ttf`.

A character that is missing from the subset renders as nothing at all, so
anything new the card can print has to be added to that list first. The block
characters in the pasteable text are not here on purpose: the image draws its
shape as rectangles rather than typing it.
