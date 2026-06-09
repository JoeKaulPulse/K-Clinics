// Curated gift-card designs — used for the live preview in the studio and, later,
// to render the card image in the recipient email. No 'server-only' so the
// client customiser can import it too. `from`/`to` are the card gradient stops;
// `ink` is the text colour; `accent` the hairline/wordmark colour.
export type GiftCardTheme = {
  id: string;
  name: string;
  from: string;
  to: string;
  ink: string;
  accent: string;
  dark?: boolean; // light text on a dark card
};

export const GIFT_CARD_THEMES: GiftCardTheme[] = [
  { id: 'champagne', name: 'Champagne', from: '#f3e8d8', to: '#d8c3a8', ink: '#2a2420', accent: '#a98a6d' },
  { id: 'noir', name: 'Noir & gold', from: '#211d1a', to: '#342d27', ink: '#f4e7d2', accent: '#cBA46a', dark: true },
  { id: 'blush', name: 'Blush', from: '#efdcd8', to: '#dcbbb4', ink: '#3a2a28', accent: '#b07d72' },
  { id: 'jade', name: 'Jade', from: '#d3e3da', to: '#a9c7b7', ink: '#22302a', accent: '#5e8a76' },
  { id: 'porcelain', name: 'Porcelain', from: '#faf6f1', to: '#ece1d4', ink: '#2a2420', accent: '#a98a6d' },
];

export const DEFAULT_THEME_ID = 'champagne';

export function giftCardTheme(id?: string | null): GiftCardTheme {
  return GIFT_CARD_THEMES.find((t) => t.id === id) || GIFT_CARD_THEMES[0];
}
