# PWA Installation Testing Guide

## Prerequisites
- Android device or Chrome DevTools device emulation
- App running on HTTPS (production) or localhost (development)

## Testing on Android Device

1. **Start the app:**
   ```bash
   pnpm dev
   # Or in production: pnpm build && pnpm start
   ```

2. **Access from Android device:**
   - Open Chrome browser on Android
   - Navigate to: `http://localhost:3000` (if on same network)
   - Or use tunnel service: `npx localtunnel --port 3000`

3. **Check PWA installability:**
   - Tap Chrome menu (⋮)
   - Look for "Add to Home Screen" or "Install app" option
   - If present, PWA is installable ✓

4. **Install the app:**
   - Tap "Add to Home Screen"
   - Confirm installation
   - Check home screen for app icon

5. **Verify installed app:**
   - Tap icon to launch
   - Should open in standalone mode (no browser UI)
   - Check status bar color matches theme_color

## Testing in Chrome DevTools

1. **Open DevTools:**
   - Press F12 or Ctrl+Shift+I
   - Go to "Application" tab

2. **Check Manifest:**
   - Select "Manifest" in left sidebar
   - Verify all fields are populated
   - Check icon previews

3. **Check Service Worker:**
   - Select "Service Workers" in left sidebar
   - Should show: `/service-worker.js` registered
   - Status should be "activated and is running"

4. **Run Lighthouse PWA Audit:**
   - Go to "Lighthouse" tab
   - Select "Progressive Web App" category
   - Click "Analyze page load"
   - Should score 100% for installability

5. **Test installation:**
   - Look for install icon in address bar (⊕)
   - Click to trigger install prompt
   - Install and verify it opens standalone

## Common Issues

**"Add to Home Screen" not showing:**
- Ensure app is running on HTTPS (or localhost)
- Check manifest.json is accessible at /manifest.json
- Verify service worker is registered
- Check browser console for errors

**Service worker not registering:**
- Check /service-worker.js is accessible (200 status)
- Ensure HTTPS (required in production)
- Clear browser cache and reload

**Icons not showing:**
- Verify icon files exist in /public/
- Check paths in manifest.json match actual files
- Ensure icon sizes are correct (192x192, 512x512)

## Success Criteria

✓ Manifest is valid and accessible
✓ Service worker registers successfully
✓ "Add to Home Screen" option appears
✓ App installs on home screen
✓ App opens in standalone mode
✓ Lighthouse PWA score is 100%

## Production Build Verification

### Build Verification - 02:41:18 | 11/16/2025

**Build Status:** SUCCESS
- Build completed successfully in 42 seconds
- No compilation errors
- All routes generated successfully (31 static pages)

**PWA Files Verification:**

1. **Manifest File:**
   - Location: `/public/manifest.json`
   - Size: 941 bytes
   - Status: Present and valid
   - Last modified: 11/15/2025 06:34

2. **Service Worker:**
   - Location: `/public/service-worker.js`
   - Size: 1.1 KB
   - Status: Present and valid
   - Last modified: 11/15/2025 17:58

3. **App Icons:**
   - Icon 192x192: `/public/web-app-manifest-192x192.png` (5.7 KB)
   - Icon 512x512: `/public/web-app-manifest-512x512.png` (23 KB)
   - Status: Both icons present and valid
   - Last modified: 11/15/2025 00:25

**Next.js Build Output:**
- Static assets generated in `.next/static/`
- Middleware bundle: 35.2 kB
- First Load JS shared by all: 115 kB
- Total routes: 58 (31 static, 27 dynamic)

**Verification Result:** PASS
- All PWA files are present in the public directory
- Production build completes without errors
- Files are ready for deployment and testing
