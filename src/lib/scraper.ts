import { chromium } from 'playwright';
import { LinkAuditResult, ButtonAuditResult, ConsoleMessageResult } from './types';

export interface ScraperResult {
  links: LinkAuditResult[];
  buttons: ButtonAuditResult[];
  consoleErrors: ConsoleMessageResult[];
  pageText: string;
  screenshots: {
    desktop?: string;
    mobile?: string;
  };
}

export async function runScraper(targetUrl: string): Promise<ScraperResult> {
  const oldPreload = process.env.LD_PRELOAD;
  const oldLibraryPath = process.env.LD_LIBRARY_PATH;
  if (oldPreload) delete process.env.LD_PRELOAD;
  if (oldLibraryPath) delete process.env.LD_LIBRARY_PATH;

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      env: {
        ...process.env,
        LD_PRELOAD: '',
        LD_LIBRARY_PATH: '',
      }
    });
  } finally {
    if (oldPreload) process.env.LD_PRELOAD = oldPreload;
    if (oldLibraryPath) process.env.LD_LIBRARY_PATH = oldLibraryPath;
  }

  const links: LinkAuditResult[] = [];
  const buttons: ButtonAuditResult[] = [];
  const consoleErrors: ConsoleMessageResult[] = [];
  let pageText = '';
  let desktopScreenshot = '';
  let mobileScreenshot = '';

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    // Listen to console errors
    page.on('pageerror', (err) => {
      consoleErrors.push({
        type: 'uncaught-error',
        text: err.message,
        location: err.stack
      });
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          type: 'console-error',
          text: msg.text(),
          location: msg.location()?.url
        });
      }
    });

    // Navigate to page
    await page.goto(targetUrl, { waitUntil: 'load', timeout: 30000 });
    // Wait an extra 2 seconds for dynamic rendering
    await page.waitForTimeout(2000);

    // Extract Page Text
    pageText = await page.evaluate(() => document.body.innerText || '');

    // 1. Audit Links
    const rawLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors.map((a, idx) => ({
        href: a.getAttribute('href') || '',
        text: (a.innerText || a.getAttribute('title') || `Enlace #${idx}`).trim(),
        outerHTML: a.outerHTML
      }));
    });

    const targetUrlObj = new URL(targetUrl);

    // Run parallel fetch checks for valid http(s) links
    const linkPromises = rawLinks.map(async (raw) => {
      const { href, text } = raw;
      if (!href) {
        return { url: '', text: 'Enlace vacío', status: 'N/A', ok: false, type: 'internal' as const };
      }

      // Handle relative paths
      let resolvedUrl = href;
      try {
        resolvedUrl = new URL(href, targetUrl).toString();
      } catch (e) {
        // Not a parseable URL (e.g. mailto:, tel:, #)
        if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
          return { url: href, text, status: 'Protocolo', ok: true, type: 'internal' as const };
        }
        return { url: href, text, status: 'Invalido', ok: false, type: 'internal' as const };
      }

      const isExternal = new URL(resolvedUrl).hostname !== targetUrlObj.hostname;
      const linkType = isExternal ? ('external' as const) : ('internal' as const);

      if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
        return { url: resolvedUrl, text, status: 'Protocolo', ok: true, type: linkType };
      }

      try {
        const response = await fetch(resolvedUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(5000)
        });
        return {
          url: resolvedUrl,
          text,
          status: response.status,
          ok: response.ok || (response.status >= 200 && response.status < 400),
          type: linkType
        };
      } catch (e: any) {
        return {
          url: resolvedUrl,
          text,
          status: e?.message || 'Error de red',
          ok: false,
          type: linkType
        };
      }
    });

    const auditedLinks = await Promise.all(linkPromises);
    links.push(...auditedLinks.filter(l => l.url !== ''));

    // 2. Audit Buttons & CTAs
    const buttonElements = page.locator('button, [role="button"], a.btn, a.button, input[type="button"], input[type="submit"]');
    const buttonCount = await buttonElements.count();

    for (let i = 0; i < buttonCount; i++) {
      const btn = buttonElements.nth(i);
      try {
        const boundingBox = await btn.boundingBox();
        const text = (await btn.innerText() || await btn.getAttribute('value') || await btn.getAttribute('title') || 'Botón sin texto').trim();
        const tag = (await btn.evaluate(node => node.tagName)) as any;

        const issues: string[] = [];
        let hasHover = false;
        let isClickableAreaOk = true;

        if (!boundingBox) {
          issues.push('Botón no visible o sin área de visualización.');
          isClickableAreaOk = false;
        } else {
          // Mobile accessibility recommends at least 44x44px target sizes
          if (boundingBox.width < 44 || boundingBox.height < 44) {
            issues.push(`Área táctil muy pequeña (${Math.round(boundingBox.width)}x${Math.round(boundingBox.height)}px). El estándar es mínimo 44x44px.`);
            isClickableAreaOk = false;
          }
        }

        // Test Hover transition
        if (boundingBox && boundingBox.width > 0 && boundingBox.height > 0) {
          try {
            await btn.hover({ timeout: 1000 });
            hasHover = true;
          } catch (e) {
            issues.push('No se pudo simular hover (puede estar obstruido por otro elemento).');
            hasHover = false;
          }
        }

        buttons.push({
          selector: `btn-${i}`,
          text,
          tag: ['BUTTON', 'A', 'DIV', 'SPAN', 'INPUT'].includes(tag) ? tag : 'BUTTON',
          hasHover,
          isClickableAreaOk,
          issues
        });
      } catch (e) {
        console.error('Error auditing individual button:', e);
      }
    }

    // Take Desktop Screenshot
    const desktopBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
    desktopScreenshot = desktopBuffer.toString('base64');

    // Change viewport to Mobile and take mobile screenshot
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    const mobileBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
    mobileScreenshot = mobileBuffer.toString('base64');

  } catch (error) {
    console.error('Scraper error:', error);
  } finally {
    await browser.close();
  }

  return {
    links,
    buttons,
    consoleErrors,
    pageText,
    screenshots: {
      desktop: desktopScreenshot ? `data:image/jpeg;base64,${desktopScreenshot}` : undefined,
      mobile: mobileScreenshot ? `data:image/jpeg;base64,${mobileScreenshot}` : undefined
    }
  };
}
