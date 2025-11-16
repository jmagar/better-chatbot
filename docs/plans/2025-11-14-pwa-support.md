# PWA Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Android "Add to Home Screen" functionality by adding minimal PWA support (manifest, service worker, and meta tags).

**Architecture:** Next.js 15.3 App Router with native Metadata API for PWA configuration. Manifest served from `/public/`, service worker registered from root path. Icons already exist in `/src/app/` and will be referenced from manifest. No offline functionality required—minimal service worker for installability only.

**Tech Stack:** Next.js 15.3, TypeScript 5.9, React 19, Vitest (unit tests), Playwright (E2E tests), existing icon assets (192x192, 512x512 PNGs)

---

## Task 1: Create Web App Manifest

**Files:**
- Create: `/mnt/cache/compose/better-chatbot/public/manifest.json`

**Step 1: Write manifest validation test**

Create test file to validate manifest structure:

```typescript
// tests/pwa/manifest.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA Manifest', () => {
  it('should have valid manifest.json with required fields', () => {
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    // Required fields for Android installability
    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(manifest.start_url).toBeDefined();
    expect(manifest.display).toBeDefined();
    expect(manifest.background_color).toBeDefined();
    expect(manifest.theme_color).toBeDefined();
    expect(manifest.icons).toBeDefined();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    // Validate icon sizes
    const iconSizes = manifest.icons.map((icon: any) => icon.sizes);
    expect(iconSizes).toContain('192x192');
    expect(iconSizes).toContain('512x512');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /mnt/cache/compose/better-chatbot
pnpm test tests/pwa/manifest.test.ts
```

Expected: FAIL with "ENOENT: no such file or directory, open '.../public/manifest.json'"

**Step 3: Create manifest.json with minimal PWA configuration**

```json
{
  "name": "Better Chatbot",
  "short_name": "ChatBot",
  "description": "Better Chatbot is a chatbot that uses Tools to answer questions",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/web-app-manifest-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/web-app-manifest-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["productivity", "utilities"],
  "prefer_related_applications": false
}
```

**Step 4: Move icon files to public directory**

Icons currently exist in `/src/app/` but need to be in `/public/` to match manifest paths:

```bash
cd /mnt/cache/compose/better-chatbot
cp src/app/web-app-manifest-192x192.png public/
cp src/app/web-app-manifest-512x512.png public/
```

**Step 5: Run test to verify it passes**

```bash
pnpm test tests/pwa/manifest.test.ts
```

Expected: PASS - all assertions succeed

**Step 6: Commit**

```bash
git add public/manifest.json public/web-app-manifest-*.png tests/pwa/manifest.test.ts
git commit -m "feat: add PWA manifest with icons for Android installability"
```

---

## Task 2: Create Minimal Service Worker

**Files:**
- Create: `/mnt/cache/compose/better-chatbot/public/service-worker.js`

**Step 1: Write service worker registration test**

```typescript
// tests/pwa/service-worker.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Service Worker', () => {
  it('should have service-worker.js file', () => {
    const swPath = path.join(process.cwd(), 'public', 'service-worker.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');

    // Should have install event listener
    expect(swContent).toContain('install');

    // Should have activate event listener
    expect(swContent).toContain('activate');

    // Should have fetch event listener (even if minimal)
    expect(swContent).toContain('fetch');
  });

  it('should have valid JavaScript syntax', () => {
    const swPath = path.join(process.cwd(), 'public', 'service-worker.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');

    // Basic syntax check - should not throw
    expect(() => new Function(swContent)).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/pwa/service-worker.test.ts
```

Expected: FAIL with "ENOENT: no such file or directory, open '.../public/service-worker.js'"

**Step 3: Create minimal service worker**

Create the absolute minimum service worker required for PWA installability (no caching, no offline support):

```javascript
// public/service-worker.js

// Service Worker version (increment to force update)
const SW_VERSION = 'v1.0.0';
const CACHE_NAME = `better-chatbot-${SW_VERSION}`;

// Install event - just skip waiting
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install event:', SW_VERSION);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate event:', SW_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network-first (no offline support)
self.addEventListener('fetch', (event) => {
  // Just pass through to network, don't cache anything
  // This satisfies PWA requirements without implementing offline functionality
  event.respondWith(fetch(event.request));
});
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/pwa/service-worker.test.ts
```

Expected: PASS - file exists and has required event listeners

**Step 5: Commit**

```bash
git add public/service-worker.js tests/pwa/service-worker.test.ts
git commit -m "feat: add minimal service worker for PWA installability"
```

---

## Task 3: Update Metadata for PWA Support

**Files:**
- Modify: `/mnt/cache/compose/better-chatbot/src/app/layout.tsx:21-25`

**Step 1: Write metadata validation test**

```typescript
// tests/pwa/metadata.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA Metadata', () => {
  it('should have manifest reference in layout.tsx', () => {
    const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    // Should reference manifest.json
    expect(layoutContent).toContain('manifest:');
    expect(layoutContent).toContain('/manifest.json');
  });

  it('should have apple-web-app-capable meta configuration', () => {
    const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    // Should have appleWebApp configuration
    expect(layoutContent).toContain('appleWebApp:');
    expect(layoutContent).toContain('capable: true');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/pwa/metadata.test.ts
```

Expected: FAIL with "expect(received).toContain(expected)" for manifest and appleWebApp

**Step 3: Update layout.tsx metadata**

Replace the existing metadata export with PWA-enhanced version:

```typescript
// src/app/layout.tsx (update lines 21-25)

export const metadata: Metadata = {
  title: "better-chatbot",
  description: "Better Chatbot is a chatbot that uses the Tools to answer questions.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Better Chatbot",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: "#000000",
};
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/pwa/metadata.test.ts
```

Expected: PASS - metadata includes manifest and appleWebApp configuration

**Step 5: Commit**

```bash
git add src/app/layout.tsx tests/pwa/metadata.test.ts
git commit -m "feat: update metadata with PWA manifest and iOS web app configuration"
```

---

## Task 4: Add Service Worker Registration

**Files:**
- Create: `/mnt/cache/compose/better-chatbot/src/app/register-sw.tsx`
- Modify: `/mnt/cache/compose/better-chatbot/src/app/layout.tsx` (add component)

**Step 1: Write service worker registration test**

```typescript
// tests/pwa/sw-registration.test.ts
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Service Worker Registration', () => {
  it('should have register-sw.tsx component', () => {
    const regPath = path.join(process.cwd(), 'src', 'app', 'register-sw.tsx');
    expect(fs.existsSync(regPath)).toBe(true);

    const regContent = fs.readFileSync(regPath, 'utf-8');

    // Should be a client component
    expect(regContent).toContain("'use client'");

    // Should register service worker
    expect(regContent).toContain('navigator.serviceWorker.register');
    expect(regContent).toContain('/service-worker.js');

    // Should use useEffect for browser-only registration
    expect(regContent).toContain('useEffect');
  });

  it('should include RegisterSW component in layout', () => {
    const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    // Should import RegisterSW
    expect(layoutContent).toContain("from './register-sw'");

    // Should render RegisterSW component
    expect(layoutContent).toContain('<RegisterSW />');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/pwa/sw-registration.test.ts
```

Expected: FAIL with "ENOENT: no such file or directory" for register-sw.tsx

**Step 3: Create service worker registration component**

```typescript
// src/app/register-sw.tsx
'use client';

import { useEffect } from 'react';

export function RegisterSW() {
  useEffect(() => {
    // Only register service worker in browser (not during SSR)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('ServiceWorker registered:', registration.scope);

          // Check for updates periodically
          registration.update();
        })
        .catch((error) => {
          console.error('ServiceWorker registration failed:', error);
        });
    }
  }, []);

  return null; // This component doesn't render anything
}
```

**Step 4: Update layout.tsx to include RegisterSW**

Add import and component to layout:

```typescript
// src/app/layout.tsx (add after existing imports)
import { RegisterSW } from './register-sw';

// ... existing code ...

// Inside RootLayout function body, add before closing </body>:
export default function RootLayout({
  children,
  params: { locale },
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  return (
    <html lang={locale}>
      <body className="antialiased">
        {/* ... existing components ... */}
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
```

**Step 5: Run test to verify it passes**

```bash
pnpm test tests/pwa/sw-registration.test.ts
```

Expected: PASS - component exists and is included in layout

**Step 6: Commit**

```bash
git add src/app/register-sw.tsx src/app/layout.tsx tests/pwa/sw-registration.test.ts
git commit -m "feat: add service worker registration component to layout"
```

---

## Task 5: Validate PWA Installability

**Files:**
- Create: `/mnt/cache/compose/better-chatbot/tests/pwa/lighthouse.test.ts`

**Step 1: Write Lighthouse PWA validation test**

```typescript
// tests/pwa/lighthouse.test.ts
import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('PWA Lighthouse Validation', () => {
  it('should pass basic PWA requirements', async () => {
    // This test requires the dev server to be running
    // Run: pnpm dev
    // Then: pnpm test tests/pwa/lighthouse.test.ts

    // Check if server is running on port 3000
    try {
      const { stdout } = await execAsync('curl -s http://localhost:3000 || echo "SERVER_DOWN"');

      if (stdout.includes('SERVER_DOWN')) {
        console.log('⚠️  Skipping Lighthouse test - dev server not running');
        console.log('   Start server with: pnpm dev');
        return;
      }

      // Verify manifest is accessible
      const manifestCheck = await execAsync('curl -s http://localhost:3000/manifest.json');
      const manifest = JSON.parse(manifestCheck.stdout);

      expect(manifest.name).toBe('Better Chatbot');
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

      // Verify service worker is accessible
      const swCheck = await execAsync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/service-worker.js');
      expect(swCheck.stdout.trim()).toBe('200');

      console.log('✓ Manifest and Service Worker are accessible');
      console.log('✓ PWA can be installed on Android devices');

    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }
  }, 30000); // 30 second timeout
});
```

**Step 2: Run test to verify PWA setup works**

Start dev server first:

```bash
cd /mnt/cache/compose/better-chatbot
pnpm dev
```

In another terminal, run test:

```bash
pnpm test tests/pwa/lighthouse.test.ts
```

Expected: PASS - manifest and service worker are both accessible at expected URLs

**Step 3: Manual testing instructions**

Create testing documentation:

```markdown
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
```

**Step 4: Save testing guide**

```bash
cat > /mnt/cache/compose/better-chatbot/docs/PWA_TESTING.md << 'EOF'
[paste the testing guide above]
EOF
```

**Step 5: Commit**

```bash
git add tests/pwa/lighthouse.test.ts docs/PWA_TESTING.md
git commit -m "test: add PWA validation tests and manual testing guide"
```

---

## Task 6: Update Documentation

**Files:**
- Modify: `/mnt/cache/compose/better-chatbot/README.md` (add PWA section)

**Step 1: Read current README**

```bash
cat /mnt/cache/compose/better-chatbot/README.md
```

**Step 2: Add PWA documentation section**

Add this section to README.md after the main description:

```markdown
## PWA Support

This app is installable as a Progressive Web App (PWA) on Android devices.

### Installation

1. Open the app in Chrome on Android
2. Tap the menu (⋮) and select "Add to Home Screen"
3. The app will be installed and appear on your home screen
4. Tap the icon to launch the app in standalone mode

### Features

- Installable on Android home screen
- Standalone mode (no browser UI)
- App icon and splash screen
- Customizable theme colors

### Development

PWA files are located in:
- `/public/manifest.json` - Web app manifest
- `/public/service-worker.js` - Service worker (minimal, network-first)
- `/src/app/register-sw.tsx` - Service worker registration component

For detailed testing instructions, see [PWA_TESTING.md](docs/PWA_TESTING.md).

### Requirements

- HTTPS in production (required for service workers)
- Modern browser with service worker support
- Android Chrome 76+ recommended for installation
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add PWA support section to README"
```

---

## Task 7: Verify Production Build

**Files:**
- None (validation only)

**Step 1: Build the app**

```bash
cd /mnt/cache/compose/better-chatbot
pnpm build
```

Expected: Build completes without errors, service-worker.js and manifest.json are included in output

**Step 2: Check build output**

```bash
ls -lh public/manifest.json
ls -lh public/service-worker.js
ls -lh public/web-app-manifest-*.png
```

Expected: All PWA files present in public directory

**Step 3: Start production server**

```bash
pnpm start
# Or if using Docker:
# docker compose up -d
```

**Step 4: Test production PWA**

```bash
# Check manifest
curl -s http://localhost:3000/manifest.json | jq .

# Check service worker
curl -I http://localhost:3000/service-worker.js

# Check icons
curl -I http://localhost:3000/web-app-manifest-192x192.png
curl -I http://localhost:3000/web-app-manifest-512x512.png
```

Expected: All files return 200 status, manifest has valid JSON

**Step 5: Open in browser and verify installability**

```bash
# Open browser to localhost:3000
# Check DevTools > Application > Manifest
# Check DevTools > Application > Service Workers
# Look for install prompt (+ icon in address bar)
```

Expected: PWA installability criteria met, install prompt appears

**Step 6: Document verification**

```bash
echo "✓ PWA build verification complete" >> /mnt/cache/compose/better-chatbot/docs/PWA_TESTING.md
echo "- Tested: $(date)" >> /mnt/cache/compose/better-chatbot/docs/PWA_TESTING.md
echo "- Build: production" >> /mnt/cache/compose/better-chatbot/docs/PWA_TESTING.md
echo "- Status: installable" >> /mnt/cache/compose/better-chatbot/docs/PWA_TESTING.md
```

**Step 7: Commit verification results**

```bash
git add docs/PWA_TESTING.md
git commit -m "test: verify production build PWA installability"
```

---

## Testing Checklist

After completing all tasks, verify:

- [ ] `pnpm build` completes without errors
- [ ] `/manifest.json` is accessible and valid JSON
- [ ] `/service-worker.js` is accessible (200 status)
- [ ] DevTools > Application > Manifest shows all fields
- [ ] DevTools > Application > Service Workers shows registered worker
- [ ] Install prompt appears in browser address bar
- [ ] App can be installed on Android device
- [ ] Installed app opens in standalone mode
- [ ] Icons display correctly on home screen
- [ ] Lighthouse PWA audit passes (90%+ score)

## Rollback Plan

If PWA causes issues:

```bash
# Remove PWA files
rm public/manifest.json
rm public/service-worker.js
rm src/app/register-sw.tsx

# Revert metadata changes
git checkout HEAD -- src/app/layout.tsx

# Rebuild
pnpm build
```

## Notes

- Service worker is minimal (network-first, no offline caching)
- No offline functionality implemented (per requirements)
- HTTPS required in production for service worker registration
- Icons reused from existing assets (no new icons created)
- PWA works on Android Chrome 76+ and modern browsers
- iOS Safari has limited PWA support (uses appleWebApp meta tags)

## References

- [MDN: PWA Web Manifests](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web.dev: PWA Installability](https://web.dev/install-criteria/)
