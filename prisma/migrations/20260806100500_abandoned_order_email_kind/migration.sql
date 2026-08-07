-- BLD-1204: add ABANDONED_ORDER to the EmailKind enum for the new
-- abandoned-shop-order recovery automation (lib/automations.ts). Additive --
-- adding an enum value is not a destructive change.
ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'ABANDONED_ORDER';
