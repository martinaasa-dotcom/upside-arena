# Fonts for the share card

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
