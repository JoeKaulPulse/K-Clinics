import { ImageResponse } from 'next/og';

// Apple touch icon (iOS "Add to Home Screen" / Safari). Generated via the file
// convention so the <link rel="apple-touch-icon"> is wired automatically — the
// previous metadata pointed at /apple-icon.png, which didn't exist (404).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

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
          color: '#dcc4a8',
          fontSize: 118,
          fontFamily: 'serif',
        }}
      >
        K
      </div>
    ),
    { ...size },
  );
}
