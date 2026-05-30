# Treatment & page imagery

Drop the real image files from the WordPress media library here, keeping their
original filenames (see `../../import/slug-image-map.json`,
`../../import/package-image-map.json` and `../../import/page-image-map.json` for
which file maps to which page).

`manifest.json` is generated **automatically** at build time (a prebuild step
scans this folder) — you do NOT need to edit it. Any image you drop here is
picked up on the next build; anything missing falls back to the generative-art
placeholder, so every build stays green.

## Easiest way to populate this folder

On a machine that can reach kclinics.co.uk (this build environment cannot), from
the repo root:

    node scripts/fetch-media.mjs        # downloads all referenced images here
    git add public/treatments && git commit -m "Add real imagery" && git push

That's it — real photos appear across the site on the next deploy.
