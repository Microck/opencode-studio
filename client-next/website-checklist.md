# Website Launch Checklist

## SEO & Metadata
- [x] metadataBase set (`https://opencode.micr.dev`)
- [x] title with template (`%s | OpenCode Studio`)
- [x] description
- [x] keywords array
- [x] authors/creator
- [x] robots config (index, follow, googleBot)
- [x] structured data (JSON-LD WebApplication schema)
- [ ] canonical URLs per page (optional - Next.js handles this automatically)

## Social Sharing
- [x] OpenGraph tags (type, locale, url, title, description, siteName)
- [x] OpenGraph image (using logo - should create dedicated 1200x630 OG image)
- [x] Twitter card (summary_large_image)
- [x] Twitter creator handle
- [x] Dedicated OG image (`/og.jpg` 1200x630)

## Icons & PWA
- [x] favicon configured (ico, 16x16, 32x32)
- [x] apple-touch-icon
- [x] manifest.json (site.webmanifest with name, icons, theme)
- [x] maskable icons (192x192, 512x512)
- [x] theme-color meta tag (#111111)

## Performance
- [x] Font optimization (next/font)
- [x] Image optimization (next/image for all images)
- [ ] Core Web Vitals audit - manual test
- [ ] Lighthouse score > 90 - manual test

## Accessibility
- [x] lang="en" on html
- [x] Skip to main content link
- [x] Focus visible styles (:focus-visible outline)
- [ ] Color contrast audit - manual test
- [ ] Screen reader testing - manual test

## Error Handling
- [x] error.tsx (global error boundary)
- [x] not-found.tsx (404 page)
- [x] loading.tsx (loading states)

## Analytics & Monitoring
- [ ] Analytics (Plausible/Umami/Vercel) - optional
- [ ] Error tracking (Sentry) - optional
- [ ] Uptime monitoring - optional

## Security
- [x] X-Frame-Options (SAMEORIGIN)
- [x] X-Content-Type-Options (nosniff)
- [x] Referrer-Policy (strict-origin-when-cross-origin)
- [x] Permissions-Policy (camera, mic, geo disabled)
- [ ] CSP headers - N/A (requires localhost:1920 + inline styles)

## Legal
- [ ] Privacy policy (if collecting data) - N/A for local app
- [ ] Cookie consent (if using cookies) - N/A for local app

## Deployment
- [ ] Environment variables configured
- [x] Build passes (`npm run build`)
- [ ] Preview deployment tested
- [ ] Production domain configured
- [ ] SSL certificate active
