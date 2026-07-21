import { ImageResponse } from 'next/og';

// Apple touch icon (iOS "Add to Home Screen" / Safari). Generated via the file
// convention so the <link rel="apple-touch-icon"> is wired automatically — the
// previous metadata pointed at /apple-icon.png, which didn't exist (404).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// PRJ-1032.37 / brand rule: render the actual K monogram mark, never a typeset
// serif letter emulating it. This is the same path as public/icon.svg.
const K_PATH =
  'M128.115 113.115C125.458 111.125 125.24 111.219 95.9687 125.833C47.875 149.844 33.4896 155.943 26.1823 155.391C18.5521 154.812 19.7552 142.432 28.9375 126.969C33.0573 120.031 41.0677 108.969 66.7552 74.7187C92.7291 40.1041 105.505 20.802 105.901 15.6093C106.047 13.5885 105.818 13.0416 104.615 12.6406C101.948 11.7447 100.547 12.5156 99.1666 15.6354C96.4479 21.7604 83.7291 39.5572 57.6562 73.7083C28.3125 112.151 21.2239 122.458 16.5521 133.526L14.0521 139.443L14.375 129.479C14.8541 114.875 17.4323 82.3177 18.9843 71.4531C22.2031 48.7812 25.4375 33.2916 30.8698 14.3697C34.2864 2.47912 34.3229 2.27079 33.1771 1.276C31.7916 0.0780791 27.1927 -0.416713 25.4218 0.442662C21.1823 2.48433 12.901 30.552 8.0781 59.2083C7.40101 63.2291 5.78122 69.401 4.40101 73.1822C-0.140655 85.6458 -0.21357 86.4322 3.05205 86.6718C4.4531 86.7812 4.46872 87.0416 4.05205 98.3697C2.6406 136.875 2.88018 186.24 4.60935 210.562C5.78643 227.266 6.74476 230.797 10.4791 232.339C13.151 233.437 15.6823 233.203 16.3281 231.802C16.5677 231.276 16.4271 228.135 16.0052 224.755C15.0833 217.286 14.4375 206.182 14.1458 192.568C13.8906 180.995 13.7968 157.656 13.9896 155.062L14.1198 153.302L15.8125 155.271C21.0364 161.333 32.7552 160.469 51.3385 152.651C60.0156 149.005 125.911 116.344 128 114.656C128.911 113.927 128.927 113.713 128.115 113.115Z';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#2a2420',
          backgroundImage: 'radial-gradient(120% 120% at 80% 0%, rgba(169,138,109,0.45), rgba(42,36,32,0) 60%)',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 260 260" fill="none">
          <g transform="translate(65.5,13.5)"><path fill="#dcc4a8" d={K_PATH} /></g>
        </svg>
      </div>
    ),
    { ...size },
  );
}
