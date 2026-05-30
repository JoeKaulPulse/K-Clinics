/**
 * Official K Clinics brand marks — supplied artwork, rendered as inline SVG.
 *  • KMark            — the hook monogram ("K"). Used alone on mobile + atop the
 *                       desktop lockup.
 *  • ClinicsWordmark  — the "CLINICS" wordmark.
 *
 * Fills use `currentColor` so the logo adapts (porcelain over dark heroes, brand
 * taupe / ink on light surfaces). Brand colour is #91766D.
 */

// Shared path data for the supplied "K" monogram (swoosh).
const K_PATH =
  'M128.115 113.115C125.458 111.125 125.24 111.219 95.9687 125.833C47.875 149.844 33.4896 155.943 26.1823 155.391C18.5521 154.812 19.7552 142.432 28.9375 126.969C33.0573 120.031 41.0677 108.969 66.7552 74.7187C92.7291 40.1041 105.505 20.802 105.901 15.6093C106.047 13.5885 105.818 13.0416 104.615 12.6406C101.948 11.7447 100.547 12.5156 99.1666 15.6354C96.4479 21.7604 83.7291 39.5572 57.6562 73.7083C28.3125 112.151 21.2239 122.458 16.5521 133.526L14.0521 139.443L14.375 129.479C14.8541 114.875 17.4323 82.3177 18.9843 71.4531C22.2031 48.7812 25.4375 33.2916 30.8698 14.3697C34.2864 2.47912 34.3229 2.27079 33.1771 1.276C31.7916 0.0780791 27.1927 -0.416713 25.4218 0.442662C21.1823 2.48433 12.901 30.552 8.0781 59.2083C7.40101 63.2291 5.78122 69.401 4.40101 73.1822C-0.140655 85.6458 -0.21357 86.4322 3.05205 86.6718C4.4531 86.7812 4.46872 87.0416 4.05205 98.3697C2.6406 136.875 2.88018 186.24 4.60935 210.562C5.78643 227.266 6.74476 230.797 10.4791 232.339C13.151 233.437 15.6823 233.203 16.3281 231.802C16.5677 231.276 16.4271 228.135 16.0052 224.755C15.0833 217.286 14.4375 206.182 14.1458 192.568C13.8906 180.995 13.7968 157.656 13.9896 155.062L14.1198 153.302L15.8125 155.271C21.0364 161.333 32.7552 160.469 51.3385 152.651C60.0156 149.005 125.911 116.344 128 114.656C128.911 113.927 128.927 113.713 128.115 113.115Z';

/**
 * @param animated — when true, the monogram performs a "self-draw" calligraphy
 *   animation (a stroked outline draws on, then the fill blooms in) plus a
 *   travelling sheen. Used for the hero/loader. Respects reduced-motion via CSS.
 */
export function KMark({ className = '', animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg
      viewBox="0 0 130 234"
      width="100%"
      height="100%"
      className={`${animated ? 'k-mark--animated' : ''} ${className}`}
      role="img"
      aria-label="K Clinics"
      preserveAspectRatio="xMidYMid meet"
    >
      {animated && (
        <defs>
          <linearGradient id="k-sheen" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.25" />
          </linearGradient>
        </defs>
      )}
      {/* Filled monogram */}
      <path className="k-mark__fill" fill="currentColor" d={K_PATH} />
      {/* Self-drawing stroke (animated mode only) */}
      {animated && (
        <path
          className="k-mark__draw"
          d={K_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function ClinicsWordmark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 531 51"
      width="100%"
      height="100%"
      className={className}
      role="img"
      aria-label="K Clinics"
      preserveAspectRatio="xMidYMid meet"
      fill="currentColor"
    >
      {/* CLINICS — primary wordmark (leading swoosh is the "C" glyph) */}
      <path d="M0.875977 25.8821C0.875977 39.8949 13.026 50.8986 27.1821 50.8986H90.1532V43.113H27.1821C16.8829 43.113 9.09142 34.814 9.09142 25.8821C9.16306 24.8134 9.23471 24.0253 9.45562 23.2372L9.66459 22.2401C11.4557 14.4485 18.8831 8.80043 26.6746 8.80043C26.8179 8.80043 26.9672 8.80043 27.1105 8.80043H90.0816V0.937256H27.1105C13.1693 0.937256 0.875977 11.8693 0.875977 25.8821Z" />
      <path d="M111.468 43.1847V0.937256H103.312V50.9762H176.087V43.1847H111.468Z" />
      <path d="M189.252 50.9762H197.467V0.937256H189.252V50.9762Z" />
      <path d="M213.498 50.6181H221.713V13.0933C289.831 44.8326 300.626 50.1225 302.411 50.827L302.704 50.9763V0.937353H294.548V38.4621L213.498 0.656738V50.6181Z" />
      <path d="M318.723 50.9762H326.938V0.937256H318.723V50.9762Z" />
      <path d="M340.82 25.8821C340.82 39.8949 352.97 50.8986 367.126 50.8986H430.103V43.113H367.126C356.838 43.113 349.047 34.814 349.047 25.8821C349.113 24.8134 349.184 24.0253 349.399 23.2372L349.608 22.2401C351.399 14.4485 358.839 8.80043 366.63 8.80043C366.767 8.80043 366.911 8.80043 367.054 8.80043H430.025V0.937256H367.054C353.113 0.937256 340.82 11.8693 340.82 25.8821Z" />
      <path d="M441.118 50.8269H515.033C523.392 50.8269 530.181 44.2534 530.181 36.3186C530.181 28.3181 522.753 21.8878 515.099 21.8878H456.2C452.343 21.8878 449.274 18.8787 449.274 15.2367C449.274 11.4454 452.486 8.80043 455.848 8.80043C455.985 8.80043 456.128 8.80043 456.278 8.80043H530.181V0.937256H456.278C448.343 0.937256 441.19 7.23019 441.19 15.2367V15.5173C441.19 23.7447 448.701 29.8167 456.128 29.8167H515.171C518.89 29.8167 521.965 32.6766 521.965 36.3902C521.965 40.0382 518.89 43.0414 515.033 43.0414H441.118V50.8269Z" />
    </svg>
  );
}
