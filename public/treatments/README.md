# Treatment & page imagery

Drop the real image files from the WordPress media library here, keeping their
original filenames (see ../../import/slug-image-map.json for which file maps to
which page).

Then list the filenames you've added in `manifest.json`, e.g.:

    ["Botox.png", "Microneedling.png", "Carbon-Laser-Peel.png"]

Only files listed in manifest.json are used on the site; anything not listed
falls back to the generative-art placeholder. This keeps every build green even
before all images are uploaded.

A ready-to-run download helper is in scripts/fetch-media.mjs — run it on a
machine that can reach kclinics.co.uk to pull every file listed in
../../import/image-manifest.txt, then copy them here and update manifest.json.
