import 'server-only';

// ── Payment-terminal abstraction (BLD-195) ─────────────────────────────────
// A thin, provider-agnostic interface for capturing an in-person card payment
// on a physical terminal. The session checkout (BLD-196) calls `captureOnTerminal`
// without caring which reader/brand is in the room — the Device registry tells
// us the provider + the provider's device id, and we route to the matching
// provider here. Tyl by NatWest is stubbed until its API/SDK + credentials are
// wired (it advertises itself as unavailable so the UI can fall back to a
// payment link or the card on file).

export type TerminalStatus = 'approved' | 'declined' | 'unavailable' | 'error';

export type TerminalResult = {
  ok: boolean;
  status: TerminalStatus;
  /** Provider reference for the capture (for reconciliation / receipts). */
  reference?: string;
  message?: string;
};

export type TerminalCaptureInput = {
  amountPence: number;
  /** The provider's device / POI id, from the Device registry. */
  deviceExternalId?: string | null;
  bookingId?: string;
  description?: string;
};

export interface TerminalProvider {
  readonly id: string;
  readonly label: string;
  /** True once the provider's credentials are present in the environment. */
  configured(): boolean;
  capture(input: TerminalCaptureInput): Promise<TerminalResult>;
}

// Tyl by NatWest — stub. Wiring the live integration (Cloud POS / Tap to Pay
// REST) only needs this `capture` body + the env credentials below; the rest of
// the payment flow already routes through this interface.
const tylProvider: TerminalProvider = {
  id: 'tyl',
  label: 'Tyl by NatWest',
  configured() {
    return Boolean(process.env.TYL_API_KEY && process.env.TYL_MERCHANT_ID);
  },
  async capture() {
    return {
      ok: false,
      status: 'unavailable',
      message:
        'Tyl terminal isn’t connected yet. Add TYL_API_KEY + TYL_MERCHANT_ID to enable in-person card capture; until then take payment by link or the card on file.',
    };
  },
};

const PROVIDERS: Record<string, TerminalProvider> = { tyl: tylProvider };

export function terminalProvider(id?: string | null): TerminalProvider | null {
  if (!id) return null;
  return PROVIDERS[id] ?? null;
}

export function terminalProviderIds(): { id: string; label: string }[] {
  return Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label }));
}

/** Is any card terminal usable right now (provider known + credentials set)? */
export function anyTerminalConfigured(): boolean {
  return Object.values(PROVIDERS).some((p) => p.configured());
}

/**
 * Capture an amount on a registered terminal. Resolves the provider from the
 * Device row, returning a clear `unavailable` result when the terminal isn't
 * configured yet so callers can fall back gracefully.
 */
export async function captureOnTerminal(
  device: { provider: string | null; externalId: string | null } | null,
  input: TerminalCaptureInput,
): Promise<TerminalResult> {
  const provider = terminalProvider(device?.provider);
  if (!provider) return { ok: false, status: 'unavailable', message: 'No card terminal is registered for this device.' };
  if (!provider.configured()) {
    return { ok: false, status: 'unavailable', message: `${provider.label} isn’t connected yet — take payment by link or the card on file.` };
  }
  return provider.capture({ ...input, deviceExternalId: device?.externalId ?? input.deviceExternalId ?? null });
}
