import { NextResponse } from 'next/server'

// =====================================================
// THIRD PARTY DETECTION
// =====================================================

const THIRD_PARTY_PATTERNS = [
  { name: 'Google Analytics',    category: 'Analytics',    regex: /google-analytics\.com|ga\.js|gtag/ },
  { name: 'Google Tag Manager',  category: 'Tag Manager',  regex: /googletagmanager\.com/ },
  { name: 'Facebook/Meta Pixel', category: 'Advertising',  regex: /facebook\.net|connect\.facebook\.net/ },
  { name: 'Hotjar',              category: 'Heatmaps',     regex: /hotjar\.com/ },
  { name: 'Intercom',            category: 'Support',      regex: /intercom\.io|intercomcdn\.com/ },
  { name: 'Stripe',              category: 'Payments',     regex: /js\.stripe\.com/ },
  { name: 'Vercel Analytics',    category: 'Analytics',    regex: /_vercel\/insights/ },
  { name: 'Cloudflare Insights', category: 'Analytics',    regex: /cloudflareinsights\.com/ },
  { name: 'HubSpot',             category: 'CRM',          regex: /hs-scripts\.com|hubspot\.com/ },
  { name: 'Tawk.to',             category: 'Support',      regex: /tawk\.to/ },
  { name: 'DoubleClick',         category: 'Advertising',  regex: /doubleclick\.net/ },
  { name: 'TikTok Pixel',        category: 'Advertising',  regex: /analytics\.tiktok\.com/ },
  { name: 'LinkedIn Insight',    category: 'Advertising',  regex: /snap\.licdn\.com/ },
  { name: 'Twitter/X Pixel',     category: 'Advertising',  regex: /static\.ads-twitter\.com/ },
  { name: 'Mixpanel',            category: 'Analytics',    regex: /mixpanel\.com/ },
  { name: 'Segment',             category: 'Analytics',    regex: /cdn\.segment\.com/ },
  { name: 'Zendesk',             category: 'Support',      regex: /zdassets\.com|zendesk\.com/ },
  { name: 'Drift',               category: 'Support',      regex: /js\.driftt\.com/ },
  { name: 'Typeform',            category: 'Forms',        regex: /typeform\.com/ },
  { name: 'Recaptcha',           category: 'Security',     regex: /google\.com\/recaptcha/ },
]

// =====================================================
// HELPER: classify resource
// =====================================================

function classifyResource(
  url,
  type,
  size,
  duration,
  contentType,
  isThirdParty,
  headers
) {
  const issues = []
  const optimizations = []
  let priority = 'low'
  let blocked = false

  // Size thresholds by type
  const sizeThresholds = {
    script:   200_000,   // 200 KB
    style:     50_000,   //  50 KB
    image:    500_000,   // 500 KB
    font:      80_000,   //  80 KB
    document: 100_000,   // 100 KB
  }

  const thresh = sizeThresholds[type] ?? 300_000

  if (size > thresh * 2) {
    issues.push(`Oversized: ${(size / 1024).toFixed(0)} KB (threshold ${thresh / 1024} KB)`)
    priority = 'high'
  } else if (size > thresh) {
    issues.push(`Large resource: ${(size / 1024).toFixed(0)} KB`)
    priority = 'medium'
  }

  // Compression check
  const encoding = headers['content-encoding'] || ''
  const isCompressed = /gzip|br|zstd|deflate/.test(encoding)
  if (!isCompressed && size > 10_000 && ['script', 'style', 'document'].includes(type)) {
    issues.push('Not compressed (missing gzip/brotli)')
    optimizations.push('Enable Brotli or gzip compression on the server')
  }

  // Cache check
  const cacheControl = headers['cache-control'] || ''
  const hasCache = /max-age|s-maxage|immutable/.test(cacheControl)
  if (!hasCache && !isThirdParty) {
    issues.push('No cache-control header')
    optimizations.push('Set Cache-Control: max-age=31536000, immutable for static assets')
  }

  // Slow response
  if (duration > 2000) {
    issues.push(`Slow response: ${duration.toFixed(0)}ms`)
    optimizations.push('Consider CDN offloading or server-side caching')
    priority = 'high'
  } else if (duration > 500) {
    issues.push(`Moderate latency: ${duration.toFixed(0)}ms`)
    optimizations.push('Prefetch or preload this resource')
  }

  // Type-specific
  if (type === 'image') {
    const src = url.toLowerCase()
    if (!src.includes('.webp') && !src.includes('.avif') && !src.includes('svg')) {
      optimizations.push('Convert to WebP or AVIF (up to 70% smaller)')
    }
    if (size > 200_000) {
      optimizations.push('Compress image further with tools like Squoosh or ImageOptim')
      optimizations.push('Lazy-load below-the-fold images using loading="lazy"')
    }
  }

  if (type === 'script') {
    blocked = !url.includes('async') && !url.includes('defer')
    if (size > 100_000) {
      optimizations.push('Code-split this bundle (e.g., dynamic import())')
      optimizations.push('Tree-shake unused exports to reduce bundle size')
    }
    if (isThirdParty) {
      optimizations.push('Load third-party scripts with async/defer attributes')
      optimizations.push('Use a facade pattern to defer load until user interaction')
    }
  }

  if (type === 'font') {
    if (!url.includes('display=swap') && !url.includes('font-display')) {
      optimizations.push('Add font-display: swap to prevent invisible text during load')
    }
    optimizations.push('Self-host fonts to eliminate third-party DNS lookup latency')
    if (size > 50_000) {
      optimizations.push('Subset font to only include characters used on the page')
    }
  }

  if (type === 'style') {
    if (size > 30_000) {
      optimizations.push('Remove unused CSS with PurgeCSS or UnCSS')
      optimizations.push('Inline critical CSS and defer non-critical stylesheets')
    }
  }

  return { issues, optimizations, priority, blocked }
}

// =====================================================
// MAIN HANDLER
// =====================================================

export async function GET(req) {
  const urlParam      = req.nextUrl.searchParams.get('url')
  const deviceType    = req.nextUrl.searchParams.get('device') || 'desktop'
  const targetKeyword = req.nextUrl.searchParams.get('keyword')?.toLowerCase() || null

  if (!urlParam) {
    return NextResponse.json({ error: 'Valid URL required' }, { status: 400 })
  }

  const targetUrl = urlParam.startsWith('http') ? urlParam : `https://${urlParam}`
  const isHttps   = targetUrl.startsWith('https')
  const parsedUrl = new URL(targetUrl)

  let browser = null;

  try {
    if (process.env.NODE_ENV === 'development') {
      const { chromium } = await import('playwright-core')
      browser = await chromium.launch({ headless: true })
    } else {
      const { chromium: playwright } = await import('playwright-core')
      const chromium = (await import('@sparticuz/chromium-min')).default
      browser = await playwright.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(
          // Update this URL to match your package.json version exactly
          'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.tar'
        ),
        headless: true,
      })
    }
// ... existing code ...
    const { devices } = await import('playwright-core')

    const deviceConfig =
      deviceType === 'mobile'
        ? devices['iPhone 13']
        : { viewport: { width: 1440, height: 900 } }

    const origin = parsedUrl.origin

    // =====================================================
    // ROBOTS + SITEMAP CHECK
    // =====================================================

    const botContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    })
    const botPage = await botContext.newPage()

    const checkSeoFile = async (path, validators) => {
      try {
        const response = await botPage.goto(`${origin}/${path}`, { timeout: 8000, waitUntil: 'commit' })
        if (!response) return 404
        const status = response.status()
        const text   = (await response.text()).toLowerCase()
        if (status === 200 && validators.some(v => text.includes(v))) return 200
        return 404
      } catch { return 404 }

    }

    const [robotsRes, sitemapRes] = await Promise.all([
      checkSeoFile('robots.txt',  ['user-agent:', 'disallow:', 'allow:']),
      checkSeoFile('sitemap.xml', ['<?xml', '<urlset', '<sitemapindex']),
    ])

    await botContext.close()

    // =====================================================
    // SSR CHECK (JS disabled)
    // =====================================================

    const ssrContext = await browser.newContext({ ...deviceConfig, javaScriptEnabled: false })
    const ssrPage    = await ssrContext.newPage()
    try {
      await ssrPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
    } catch { /* timeout ok */ }
    const ssrContent = await ssrPage.content()
    const ssrLength  = ssrContent.length
    await ssrContext.close()

    // =====================================================
    // FULL CLIENT AUDIT (JS enabled)
    // =====================================================

    const clientContext = await browser.newContext({ ...deviceConfig, javaScriptEnabled: true })
    const clientPage    = await clientContext.newPage()

    // ---- Resource tracking ----
    const resourceDetails = []
    const resourceSummary = {
      image: 0, script: 0, style: 0, font: 0, document: 0,
      fetch: 0, xhr: 0, other: 0, total: 0, requestCount: 0,
    }
    const thirdParties = {}
    let ttfb = 0

    clientPage.on('request', () => { resourceSummary.requestCount++ })

    clientPage.on('requestfinished', async (request) => {
      try {
        const response = await request.response()
        if (!response) return

        const reqUrl     = request.url()
        const timing     = request.timing()
        const duration   = timing.responseEnd - timing.requestStart
        const size       = Number(response.headers()['content-length']) || 0
        const transferSz = size
        const type       = request.resourceType()
        const status     = response.status()
        const headers    = response.headers()
        const contentType= headers['content-type'] || ''
        const encoding   = headers['content-encoding'] || ''
        const isCompressed = /gzip|br|zstd/.test(encoding)
        const cacheCtrl  = headers['cache-control'] || ''
        const isCached   = /max-age|immutable/.test(cacheCtrl) || status === 304

        // TTFB from main document
        if (type === 'document' && ttfb === 0 && timing.responseStart > 0) {
          ttfb = timing.responseStart - timing.requestStart
        }

        // Aggregate summary
        const bucket = resourceSummary[type] !== undefined ? type : 'other'
        resourceSummary[bucket] += size
        resourceSummary.total   += size

        // Third party detection
        let tpName
        let tpCategory
        let isThirdParty = false

        for (const p of THIRD_PARTY_PATTERNS) {
          if (p.regex.test(reqUrl)) {
            isThirdParty  = true
            tpName        = p.name
            tpCategory    = p.category
            if (!thirdParties[p.name]) {
              thirdParties[p.name] = { count: 0, duration: 0, size: 0, transferSize: 0, category: p.category }
            }
            thirdParties[p.name].count++
            thirdParties[p.name].duration     += duration
            thirdParties[p.name].size         += size
            thirdParties[p.name].transferSize += transferSz
            break
          }
        }

        // Classify resource for issues
        const { issues, optimizations, priority, blocked } = classifyResource(
          reqUrl, type, size, duration, contentType, isThirdParty, headers
        )

        resourceDetails.push({
          url:               reqUrl,
          type,
          size,
          transferSize:      transferSz,
          duration,
          status,
          initiator:         request.method(),
          cached:            isCached,
          compressed:        isCompressed,
          thirdParty:        isThirdParty,
          thirdPartyName:    tpName,
          thirdPartyCategory:tpCategory,
          contentType,
          priority,
          blocked,
          issues,
          optimizations,
        })
      } catch { /* ignore individual resource errors */ }
    })

    // ---- Web Vitals injection ----
    await clientPage.addInitScript(() => {
      window.__vitals = { LCP: 0, CLS: 0, FCP: 0, FID: 0, INP: 0 }

      new PerformanceObserver(list => {
        list.getEntries().forEach((e) => {
          if (e.entryType === 'largest-contentful-paint') window.__vitals.LCP = e.startTime
        })
      }).observe({ type: 'largest-contentful-paint', buffered: true })

      new PerformanceObserver(list => {
        list.getEntries().forEach((e) => {
          if (e.entryType === 'layout-shift' && !e.hadRecentInput) window.__vitals.CLS += e.value
        })
      }).observe({ type: 'layout-shift', buffered: true })

      new PerformanceObserver(list => {
        list.getEntries().forEach((e) => {
          if (e.name === 'first-contentful-paint') window.__vitals.FCP = e.startTime
        })
      }).observe({ type: 'paint', buffered: true })

      new PerformanceObserver(list => {
        list.getEntries().forEach((e) => {
          if (e.entryType === 'event') {
            const inp = e.duration
            if (inp > window.__vitals.INP) window.__vitals.INP = inp
          }
        })
      }).observe({ type: 'event', buffered: true, durationThreshold: 40 })
    })

    // ---- Navigate ----
    const startTime   = Date.now()
    const mainResponse= await clientPage.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null)
    const loadTime    = Date.now() - startTime
    const httpStatus  = mainResponse ? mainResponse.status() : 0

    const screenshotBuffer  = await clientPage.screenshot({ type: 'jpeg', quality: 65, fullPage: true })
    const clientScreenshot  = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`

    // =====================================================
    // MOBILE SCREENSHOT (if desktop run)
    // =====================================================

    let mobileScreenshot = null
    if (deviceType === 'desktop') {
      const mCtx  = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: true })
      const mPage = await mCtx.newPage()
      await mPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null)
      const mBuf  = await mPage.screenshot({ type: 'jpeg', quality: 60, fullPage: false })
      mobileScreenshot = `data:image/jpeg;base64,${mBuf.toString('base64')}`
      await mCtx.close()
    }

    // =====================================================
    // DOM AUDIT + UX ISSUES
    // =====================================================

    const audit = await clientPage.evaluate((domain) => {
      const cleanText = (t) => t.replace(/\s+/g, ' ').trim()

      // ---- Basics ----
      const domNodes    = document.querySelectorAll('*').length
      const syncScripts = document.querySelectorAll('head script:not([async]):not([defer]):not([type="module"])').length
      const stylesheets = document.querySelectorAll('head link[rel="stylesheet"]').length

      // ---- Links ----
      const links       = Array.from(document.querySelectorAll('a[href]'))
      let internalLinks = 0, externalLinks = 0, nofollowLinks = 0
      const brokenAnchors = []

      links.forEach(a => {
        const anchor = a
        const href   = anchor.href
        const rel    = anchor.rel.toLowerCase()
        const text   = anchor.textContent?.trim() || ''

        if (rel.includes('nofollow'))      nofollowLinks++
        if (href.startsWith(domain) || href.startsWith('/')) internalLinks++
        else externalLinks++
        if (!text && !anchor.querySelector('img[alt]')) brokenAnchors.push(href)
      })

      // ---- Schema ----
      const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map(s => { try { return JSON.parse(s.innerHTML) } catch { return null } })
        .filter(Boolean)

      // ---- Content ----
      const bodyClone = document.body.cloneNode(true)
      bodyClone.querySelectorAll('script,style,noscript,svg,iframe').forEach(s => s.remove())
      const visibleText = bodyClone.innerText || ''
      const wordCount   = visibleText.split(/\s+/).filter(w => w.length > 0).length

      // ---- Headings ----
      const h1s = Array.from(document.querySelectorAll('h1')).map(h => cleanText(h.textContent || ''))
      const h2s = Array.from(document.querySelectorAll('h2')).map(h => cleanText(h.textContent || ''))
      const h3s = Array.from(document.querySelectorAll('h3')).map(h => cleanText(h.textContent || ''))

      // ---- Images ----
      const imgs          = Array.from(document.querySelectorAll('img'))
      const imgsWithoutAlt= imgs.filter(img => !img.alt?.trim()).length
      const lazyImages    = imgs.filter(img => img.getAttribute('loading') === 'lazy').length
      const oversizedImgs = imgs.filter(img => {
        const el = img
        return el.naturalWidth > el.offsetWidth * 2
      }).length

      // ---- UX Checks ----
      const uxIssues = []

      const addUX = (
        cond, id, category, severity,
        title, description, element, fix, impact
      ) => { if (cond) uxIssues.push({ id, category, severity, title, description, element, fix, impact }) }

      // Tap target size
      const smallTapTargets = Array.from(document.querySelectorAll('a,button,[role="button"]')).filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)
      }).length

      addUX(smallTapTargets > 0, 'tap-targets', 'mobile', 'warning',
        `${smallTapTargets} tap targets too small`,
        'Interactive elements smaller than 44×44px are hard to tap on mobile and cause accidental misclicks.',
        'a, button, [role="button"]',
        'Set min-width: 44px; min-height: 44px on all interactive elements. Add padding rather than increasing font size.',
        'Reduces misclick rate by up to 40% on mobile devices')

      // Missing form labels
      const unlabeledInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]),select,textarea'))
        .filter(el => {
          const id  = el.id
          const lbl = id ? document.querySelector(`label[for="${id}"]`) : null
          const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
          return !lbl && !ariaLabel
        }).length

      addUX(unlabeledInputs > 0, 'form-labels', 'accessibility', 'critical',
        `${unlabeledInputs} form inputs missing labels`,
        'Inputs without visible labels or aria-label fail WCAG 2.1 Level A. Screen readers cannot identify the field purpose.',
        'input, select, textarea',
        'Add <label for="id"> or aria-label attribute to every form control.',
        'Critical for screen reader users — WCAG 2.1 Level A failure')

      // No visible focus indicator
      const allFocusable = Array.from(document.querySelectorAll('a,button,input,select,textarea,[tabindex]'))
      const noFocusStyle = allFocusable.filter(el => {
        const st = window.getComputedStyle(el)
        return st.outlineStyle === 'none' || st.outlineWidth === '0px'
      }).length

      addUX(noFocusStyle > allFocusable.length * 0.5, 'focus-visible', 'accessibility', 'critical',
        'Focus indicators suppressed',
        'More than half of focusable elements have outline:none, making keyboard navigation impossible for sighted keyboard users.',
        'a, button, input',
        'Never globally remove :focus outline. Use :focus-visible to show focus rings for keyboard users only. Minimum 3px contrast ratio required.',
        'Blocks keyboard-only users entirely — WCAG 2.1 Level AA failure')

      // Images without dimensions
      const imgsNoDims = imgs.filter(img => !img.width && !img.height && !img.getAttribute('width') && !img.getAttribute('height')).length
      addUX(imgsNoDims > 0, 'img-dimensions', 'visual', 'warning',
        `${imgsNoDims} images missing width/height attributes`,
        'Images without explicit dimensions cause layout shifts (CLS) as the browser cannot reserve space before the image loads.',
        'img',
        'Always set width and height attributes on <img> tags matching intrinsic dimensions. Use CSS aspect-ratio for responsive scaling.',
        'Directly improves CLS score — one of Google\'s Core Web Vitals')

      // Empty buttons / links
      const emptyButtons = Array.from(document.querySelectorAll('button')).filter(b => {
        return !b.textContent?.trim() && !b.querySelector('img[alt]') && !b.getAttribute('aria-label')
      }).length
      addUX(emptyButtons > 0, 'empty-buttons', 'accessibility', 'critical',
        `${emptyButtons} buttons with no accessible name`,
        'Buttons with no text or aria-label are invisible to screen readers. Users cannot understand the button purpose.',
        'button',
        'Add descriptive text content or aria-label to every button. Icon-only buttons must have aria-label.',
        'Screen readers skip or mispronounce unlabeled buttons')

      // Low contrast text (basic luminance check)
      const lowContrastEls = Array.from(document.querySelectorAll('p,span,li,td,h1,h2,h3,h4,h5,h6')).filter(el => {
        const st  = window.getComputedStyle(el)
        const col = st.color
        const bg  = st.backgroundColor
        if (!col || !bg || bg === 'rgba(0, 0, 0, 0)') return false
        const toRgb = (c) => c.match(/\d+/g)?.slice(0,3).map(Number) || [0,0,0]
        const lum = (rgb) => {
          const [r,g,b] = rgb.map(v => { const s=v/255; return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4) })
          return 0.2126*r + 0.7152*g + 0.0722*b
        }
        const l1 = lum(toRgb(col)) + 0.05
        const l2 = lum(toRgb(bg))  + 0.05
        const ratio = l1 > l2 ? l1/l2 : l2/l1
        return ratio < 4.5
      }).length

      addUX(lowContrastEls > 5, 'contrast', 'accessibility', 'warning',
        `${lowContrastEls} elements may have low contrast`,
        'Text contrast below 4.5:1 (WCAG AA) is difficult to read for users with low vision or in bright sunlight.',
        'p, span, h*, li',
        'Use a contrast checker (e.g. WebAIM). Aim for 4.5:1 for normal text, 3:1 for large text (18px+ or bold 14px+).',
        'Affects 8% of men with colour blindness and low-vision users')

      // No main landmark
      const hasMain = !!document.querySelector('main,[role="main"]')
      addUX(!hasMain, 'main-landmark', 'accessibility', 'warning',
        'Missing <main> landmark',
        'Without a <main> element, screen reader users cannot skip directly to the page content, forcing them to navigate through headers and nav every time.',
        'body',
        'Wrap your primary content in a <main> element. Use one <main> per page.',
        'Screen reader users waste time navigating repeated elements')

      // No skip link
      const hasSkipLink = !!document.querySelector('a[href="#main"],a[href="#content"],.skip-link')
      addUX(!hasSkipLink, 'skip-link', 'accessibility', 'warning',
        'Missing skip navigation link',
        'Keyboard users must tab through all navigation links on every page without a skip link.',
        '<body> first child',
        'Add <a href="#main" class="skip-link">Skip to main content</a> as the first element in <body>. Style it to appear on focus.',
        'Significantly speeds up keyboard-only navigation')

      // Long paragraphs
      const longParas = Array.from(document.querySelectorAll('p')).filter(p => {
        return (p.textContent?.split(/\s+/).length || 0) > 100
      }).length
      addUX(longParas > 3, 'long-paragraphs', 'content', 'info',
        `${longParas} very long paragraphs detected`,
        'Paragraphs over 100 words significantly reduce readability on digital screens. Users tend to scan rather than read.',
        'p',
        'Break long paragraphs into 3-5 sentence chunks. Use subheadings, bullet points, and white space to aid scanning.',
        'Increases time-on-page and comprehension rates')

      // Mobile meta viewport
      const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || ''
      addUX(!viewport, 'no-viewport', 'mobile', 'critical',
        'Missing viewport meta tag',
        'Without viewport meta, mobile browsers render the page at desktop width and scale it down, making text tiny and interactions unusable.',
        'head',
        'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head>.',
        'Critical for mobile usability — Google uses mobile-first indexing')

      // Max text line length (readability)
      const wideContainers = Array.from(document.querySelectorAll('p,article,section')).filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > 900 && (el.textContent?.trim().length || 0) > 50
      }).length
      addUX(wideContainers > 0, 'line-length', 'content', 'info',
        `${wideContainers} content containers exceed optimal line length`,
        'Lines longer than ~80 characters (680px) are harder to read. The eye struggles to track back to the next line.',
        'p, article',
        'Set max-width: 680px (or 65ch) on content containers. This is separate from the overall page width.',
        'Improves reading speed and reduces reader fatigue')

      // Autoplaying media
      const autoplay = document.querySelectorAll('video[autoplay],audio[autoplay]').length
      addUX(autoplay > 0, 'autoplay', 'interaction', 'warning',
        `${autoplay} media elements set to autoplay`,
        'Autoplaying media startles users, wastes data on mobile, and fails WCAG 1.4.2 (Audio Control).',
        'video, audio',
        'Remove autoplay or add muted + playsinline. Give users explicit play controls. Use autoplay only for muted background video.',
        'Reduces bounce rate; required for WCAG AA compliance')

      // Horizontal scroll
      const hasHScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 10
      addUX(hasHScroll, 'horizontal-scroll', 'mobile', 'critical',
        'Page causes horizontal scrolling',
        'Content wider than the viewport causes horizontal scrolling on mobile, which is disorienting and signals a broken layout.',
        'body, overflow elements',
        'Add overflow-x: hidden to body, or find the overflowing element (common culprits: pre code blocks, tables, images without max-width: 100%).',
        'Dramatically hurts mobile experience and Google mobile usability score')

      // Too many fonts
      const fontFamilies = new Set(
        Array.from(document.querySelectorAll('*'))
          .map(el => window.getComputedStyle(el).fontFamily.split(',')[0].trim())
      )
      addUX(fontFamilies.size > 4, 'too-many-fonts', 'visual', 'info',
        `${fontFamilies.size} different font families in use`,
        'More than 3-4 font families creates visual inconsistency and adds unnecessary network requests.',
        'Various elements',
        'Limit to 2 font families (1 display, 1 body). Define a type scale in CSS custom properties.',
        'Reduces font payload and improves visual hierarchy')

      return {
        vitals: window.__vitals,
        performance: { domNodes, syncScripts, stylesheets },
        meta: {
          title:       document.title,
          description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          canonical:   document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
          viewport:    document.querySelector('meta[name="viewport"]')?.getAttribute('content') || null,
          robots:      document.querySelector('meta[name="robots"]')?.getAttribute('content') || null,
          lang:        document.documentElement.lang || null,
          charset:     document.characterSet || null,
          themeColor:  document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || null,
        },
        social: {
          ogTitle:       document.querySelector('meta[property="og:title"]')?.getAttribute('content') || null,
          ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || null,
          ogImage:       document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null,
          ogType:        document.querySelector('meta[property="og:type"]')?.getAttribute('content') || null,
          twitterCard:   document.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || null,
          twitterTitle:  document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || null,
        },
        content: {
          wordCount,
          readTimeMinutes: Math.ceil(wordCount / 200),
        },
        headings: {
          h1Count: h1s.length, h1: h1s,
          h2Count: h2s.length, h2: h2s,
          h3Count: h3s.length, h3: h3s,
        },
        images: {
          total:      imgs.length,
          missingAlt: imgsWithoutAlt,
          lazyLoaded: lazyImages,
          oversized:  oversizedImgs,
        },
        links: {
          total: links.length, internal: internalLinks,
          external: externalLinks, nofollow: nofollowLinks,
          emptyLinks: brokenAnchors.length,
        },
        schema: schemas.length > 0 ? schemas : null,
        uxIssues,
      }
    }, origin)

    await browser.close()

    // =====================================================
    // BUILD RESPONSE
    // =====================================================

    // Sort resource details: largest first
    resourceDetails.sort((a, b) => b.size - a.size)

    // Resource breakdown by type with counts
    const resourceByType = {}
    for (const r of resourceDetails) {
      if (!resourceByType[r.type]) resourceByType[r.type] = { count: 0, totalSize: 0, avgDuration: 0, items: [] }
      resourceByType[r.type].count++
      resourceByType[r.type].totalSize    += r.size
      resourceByType[r.type].avgDuration  += r.duration
      resourceByType[r.type].items.push(r)
    }
    for (const t in resourceByType) {
      resourceByType[t].avgDuration = Math.round(
        resourceByType[t].avgDuration / resourceByType[t].count
      )
    }

    // Global optimization path
    const optimizationPath = []

    const totalJS  = resourceSummary.script  || 0
    const totalCSS = resourceSummary.style   || 0
    const totalImg = resourceSummary.image   || 0
    const totalFnt = resourceSummary.font    || 0

    if (totalJS > 200_000) optimizationPath.push({
      priority: 'high', category: 'JavaScript',
      title: 'Reduce JavaScript bundle size',
      description: `Current JS payload is ${(totalJS/1024).toFixed(0)} KB. Large JS bundles delay Time to Interactive.`,
      estimatedGain: 'Up to 2–4s faster TTI',
    })
    if (totalImg > 1_000_000) optimizationPath.push({
      priority: 'high', category: 'Images',
      title: 'Optimize image payloads',
      description: `Images account for ${(totalImg/1024/1024).toFixed(1)} MB. Convert to WebP/AVIF and apply responsive sizing.`,
      estimatedGain: 'Up to 60–80% size reduction',
    })
    if (totalCSS > 50_000) optimizationPath.push({
      priority: 'medium', category: 'CSS',
      title: 'Reduce CSS payload',
      description: `${(totalCSS/1024).toFixed(0)} KB of CSS detected. Remove unused rules with PurgeCSS.`,
      estimatedGain: 'Up to 50% CSS reduction',
    })
    if (totalFnt > 100_000) optimizationPath.push({
      priority: 'medium', category: 'Fonts',
      title: 'Optimize web fonts',
      description: `${(totalFnt/1024).toFixed(0)} KB in fonts. Self-host and subset fonts to only needed characters.`,
      estimatedGain: '100–300ms faster FCP',
    })
    if (ttfb > 600) optimizationPath.push({
      priority: 'high', category: 'Server',
      title: 'Improve Time to First Byte (TTFB)',
      description: `TTFB is ${Math.round(ttfb)}ms (target: <600ms). Add server-side caching, CDN, or optimize database queries.`,
      estimatedGain: `${Math.round(ttfb - 200)}ms faster response`,
    })
    if (audit.performance.syncScripts > 0) optimizationPath.push({
      priority: 'high', category: 'Render-blocking',
      title: 'Eliminate render-blocking scripts',
      description: `${audit.performance.syncScripts} synchronous scripts block HTML parsing. Add async/defer or move to end of body.`,
      estimatedGain: 'Up to 1–2s faster FCP',
    })
    if (Object.keys(thirdParties).length > 3) optimizationPath.push({
      priority: 'medium', category: 'Third-party',
      title: 'Audit and defer third-party scripts',
      description: `${Object.keys(thirdParties).length} third-party scripts detected. Each adds DNS lookup, TCP connection, and execution overhead.`,
      estimatedGain: '200–800ms potential saving',
    })
    if (!audit.meta.canonical) optimizationPath.push({
      priority: 'medium', category: 'SEO',
      title: 'Add canonical URL',
      description: 'Without canonical, search engines may index duplicate content variations, splitting link equity.',
      estimatedGain: 'Consolidates ranking signals',
    })
    if (!audit.schema) optimizationPath.push({
      priority: 'medium', category: 'SEO',
      title: 'Add structured data (Schema.org)',
      description: 'Structured data enables rich results in Google Search (star ratings, FAQs, etc.) which improve CTR.',
      estimatedGain: 'Up to 30% higher CTR from rich snippets',
    })

    return NextResponse.json({
      success: true,
      status:  httpStatus,
      loadTime,
      deviceType,
      targetKeyword,
      clientScreenshot,
      mobileScreenshot,
      audit,
      tech: {
        isHttps,
        robotsStatus:  robotsRes,
        sitemapStatus: sitemapRes,
        resources:     resourceSummary,
        resourceByType,
        resourceDetails: resourceDetails.slice(0, 150), // top 150 resources
        ssrLength,
        ttfb,
        thirdParties: Object.entries(thirdParties).map(([name, stats]) => ({ name, ...stats })),
      },
      uxIssues:         audit.uxIssues,
      optimizationPath,
    })
  } catch (error) {
    console.error('Audit Error:', error)
    if (browser) await browser.close()
    return NextResponse.json({ error: error.message || 'Audit failed' }, { status: 500 })
  }
}