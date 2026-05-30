# Editing the brand palette from WordPress

The entire site is themed by ~13 CSS variables. Defaults live in
`lib/theme.ts` (`defaultTheme`). In the headless-WordPress setup the colours can
be edited in wp-admin and the whole site re-skins — no code change, no redeploy
(values refresh every 5 minutes via ISR).

## How it works
`app/layout.tsx` calls `getTheme()`, which fetches overrides from WordPress and
injects them as CSS custom properties on `:root`. Any colours not supplied fall
back to the defaults.

## WordPress side (one-time setup)
Expose a tiny REST endpoint returning the palette. Two easy options:

### Option A — ACF Options page (recommended, no code)
1. Install **Advanced Custom Fields** (+ ACF Pro for an Options page).
2. Create an Options page "Brand Palette".
3. Add Colour Picker fields with these names (any subset is fine):
   `ink, inkSoft, espresso, porcelain, bone, sand, stone, stoneSoft,
    gold, goldSoft, goldBright, jade, blush`
4. Install **ACF to REST API**, then point `getTheme()` at that route, OR add
   the small snippet below to expose a clean endpoint.

### Option B — snippet in the theme's functions.php
```php
add_action('rest_api_init', function () {
  register_rest_route('kclinics/v1', '/theme', [
    'methods'  => 'GET',
    'permission_callback' => '__return_true',
    'callback' => function () {
      // Pull from ACF options, or hard-code editable values here.
      $keys = ['ink','inkSoft','espresso','porcelain','bone','sand','stone',
               'stoneSoft','gold','goldSoft','goldBright','jade','blush'];
      $out = [];
      foreach ($keys as $k) {
        $v = function_exists('get_field') ? get_field($k, 'option') : null;
        if ($v) $out[$k] = $v;
      }
      return $out; // e.g. { "gold": "#C8A24B", "ink": "#1E1A17" }
    },
  ]);
});
```

## Connecting the front-end
Set in the environment (Vercel):
```
WORDPRESS_API_URL=https://cms.kclinics.co.uk/wp-json
```
That's it. Change a colour in wp-admin → the site updates within ~5 minutes
(or instantly on redeploy).

## Colour roles (what editors are changing)
| Token       | Controls                                            |
|-------------|-----------------------------------------------------|
| `ink`       | Primary text + dark sections                        |
| `porcelain` | Primary light background                            |
| `bone`      | Secondary light surface (cards, alt sections)       |
| `gold`      | Primary metallic accent — buttons, highlights, logo |
| `jade`      | Secondary accent                                    |
| `blush`     | Soft rose highlight                                 |
| `stone`     | Muted body text                                     |

The brand artwork colours captured from the supplied logo are
taupe `#91766D` and cream `#F6ECE3` — set `gold`/`stone` to taste from wp-admin.
