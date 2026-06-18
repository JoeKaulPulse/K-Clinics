#!/bin/bash
cd /home/user/K-Clinics
export NODE_ENV=production
unset DATABASE_URL POSTGRES_URL POSTGRES_PRISMA_URL PRISMA_DATABASE_URL NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
echo "BUILD_START $(date +%T)"
./node_modules/.bin/next build
echo "BUILD_EXIT=$? $(date +%T)"
