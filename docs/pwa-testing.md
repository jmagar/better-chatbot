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
