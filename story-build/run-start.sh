#!/bin/bash
# Serve the production build in demo mode (no DB, no Stripe) for booking capture.
cd /home/user/K-Clinics
unset DATABASE_URL POSTGRES_URL POSTGRES_PRISMA_URL PRISMA_DATABASE_URL NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
export NODE_ENV=production PORT=3000
exec ./node_modules/.bin/next start
