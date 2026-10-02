# Jelite Tutor

Jelite Tutor is a Nigerian exam-preparation platform for students preparing for WAEC, JAMB, NECO, IELTS, SAT and related assessments. The app combines practice questions, timed exams, study tools, school and CBT-centre discovery, community learning, newsletters, learner portals and an admin content-management dashboard.

## Features

- Email/password and Google authentication through Supabase Auth
- Branded sign-up, confirmation and password-recovery flows
- Guided welcome tour for new learners
- Practice questions, exams, subjects, schools and CBT centres
- Community discussions and moderation tools
- Study tools, announcements, blog content and testimonials
- Admin CMS for questions, exams, users, site settings, footer links and activity
- Real-time Supabase updates for editable site content
- Responsive dark mode with accessible semantic color tokens
- Subject-aware study sound box with mute, stop and preview controls
- Stripe-ready payment module foundation for WAEC and ScratchCard products

## Tech stack

- React 19, TypeScript and Vite
- TanStack Router
- Tailwind CSS and shadcn/ui
- Supabase Auth, Postgres, Realtime and Row Level Security
- Framer Motion for accessible interface motion
- Stripe integration hooks for future secure Checkout flows

## Development

From the repository root:

```bash
pnpm install
pnpm --filter @workspace/jelite-tutor dev
```

Useful checks:

```bash
pnpm --filter @workspace/jelite-tutor typecheck
pnpm --filter @workspace/jelite-tutor build
pnpm --filter @workspace/jelite-tutor serve
```

## Environment variables

The browser app expects these Vite variables:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SUPABASE_REDIRECT_URL=https://your-domain.example/auth/callback
```

Never commit service-role keys, Stripe secret keys, OAuth client secrets or other private credentials. Configure production secrets in the deployment provider.

## Supabase setup

1. Enable Email and Google providers in Supabase Auth.
2. Add the local, preview and production callback URLs used by the deployment.
3. Keep Row Level Security enabled on all application tables.
4. Make the first administrator through the project’s approved admin workflow; never expose service-role credentials in the browser.
5. Configure branded confirmation and password-reset templates with the Jelite Tutor name and logo.

## Payments

WAEC and ScratchCard payment products should be fulfilled from verified Stripe webhooks, not from the success page alone. Prices and quantities must be checked server-side before Checkout is created. The current frontend exposes the product-ready experience; connect the secure Checkout route and webhook handler before accepting live payments.

## Deployment

The Vite build outputs the production bundle to `dist/public`. The repository-level deployment configuration runs the workspace build and serves that directory. After deployment, verify authentication redirects, the welcome tour, admin settings, dark mode, practice routes and payment test mode from the deployed URL.

## Repository workflow

- Create a feature branch for changes.
- Run typecheck and build before opening a pull request.
- Do not commit `.env` files or credentials.
- Keep content edits in the admin CMS where possible so the website remains editable without code changes.

## License

All rights reserved unless otherwise stated by the project owner.

Built for African learners by Wasiu Aduragbemi Atanda.
