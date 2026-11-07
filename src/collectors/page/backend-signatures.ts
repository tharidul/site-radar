/**
 * @file src/collectors/page/backend-signatures.ts
 * @description Fingerprinting for backend runtimes, web servers, backend frameworks, and cloud/edge platforms
 * using HTTP response headers, session cookies, CSRF tokens, and DOM generator metadata.
 */

import type { DetectedTechnology } from '../../types/inspection';

/**
 * Extracts cookie names from document.cookie safely.
 */
export function getCookieNames(doc: Document): Set<string> {
  const names = new Set<string>();
  try {
    const raw = doc.cookie || '';
    raw.split(';').forEach((part) => {
      const eq = part.indexOf('=');
      const name = (eq > -1 ? part.slice(0, eq) : part).trim();
      if (name) names.add(name);
    });
  } catch {}
  return names;
}

/**
 * Detects backend technologies from in-page signals (cookies, form tokens, meta tags).
 */
export function detectBackendFromDom(doc: Document, win?: Window): DetectedTechnology[] {
  const detected: DetectedTechnology[] = [];
  const cookies = getCookieNames(doc);
  const cookieList = Array.from(cookies);

  // 1. PHP
  if (cookies.has('PHPSESSID') || cookieList.some((c) => c.startsWith('PHPSESSID'))) {
    detected.push({
      name: 'PHP',
      category: 'Backend Language',
      confidence: 0.95,
      evidence: 'PHPSESSID session cookie',
    });
  }

  // 2. Laravel (PHP)
  if (
    cookies.has('laravel_session') ||
    cookieList.some((c) => c.startsWith('laravel_session')) ||
    (doc.querySelector('input[name="_token"]') && (win as any)?.Livewire)
  ) {
    detected.push({
      name: 'Laravel',
      category: 'PHP Framework',
      confidence: 0.98,
      evidence: 'laravel_session cookie or Livewire _token',
    });
    if (!detected.some((d) => d.name === 'PHP')) {
      detected.push({
        name: 'PHP',
        category: 'Backend Language',
        confidence: 0.95,
        evidence: 'Laravel framework dependency',
      });
    }
  }

  // 3. Django (Python)
  const hasDjangoCsrf = Boolean(doc.querySelector('input[name="csrfmiddlewaretoken"]'));
  const hasDjangoCookie = cookies.has('csrftoken') && (hasDjangoCsrf || cookies.has('sessionid'));
  if (hasDjangoCsrf || hasDjangoCookie) {
    detected.push({
      name: 'Django',
      category: 'Python Framework',
      confidence: hasDjangoCsrf ? 1.0 : 0.85,
      evidence: hasDjangoCsrf ? 'input[name="csrfmiddlewaretoken"] form token' : 'csrftoken / sessionid cookies',
    });
    detected.push({
      name: 'Python',
      category: 'Backend Language',
      confidence: 0.9,
      evidence: 'Django framework runtime',
    });
  }

  // 4. Ruby on Rails
  const hasRailsAuthToken = Boolean(
    doc.querySelector('meta[name="csrf-param"][content="authenticity_token"]') ||
    doc.querySelector('input[name="authenticity_token"]')
  );
  const hasRailsCookie = cookies.has('_rails_session') || cookies.has('_session_id');
  if (hasRailsAuthToken || hasRailsCookie) {
    detected.push({
      name: 'Ruby on Rails',
      category: 'Ruby Framework',
      confidence: hasRailsAuthToken ? 0.95 : 0.85,
      evidence: hasRailsAuthToken ? 'authenticity_token CSRF token' : '_rails_session cookie',
    });
    detected.push({
      name: 'Ruby',
      category: 'Backend Language',
      confidence: 0.9,
      evidence: 'Ruby on Rails framework runtime',
    });
  }

  // 5. ASP.NET / ASP.NET Core
  const hasAspNetToken = Boolean(
    doc.querySelector('input[name="__RequestVerificationToken"]') ||
    doc.querySelector('input[name="__VIEWSTATE"]')
  );
  const hasAspNetCookie = cookieList.some(
    (c) =>
      c === 'ASP.NET_SessionId' ||
      c.startsWith('.AspNetCore.Session') ||
      c.startsWith('.AspNetCore.Antiforgery')
  );
  if (hasAspNetToken || hasAspNetCookie) {
    const isCore = cookieList.some((c) => c.startsWith('.AspNetCore'));
    detected.push({
      name: isCore ? 'ASP.NET Core' : 'ASP.NET',
      category: '.NET Framework',
      confidence: 0.95,
      evidence: hasAspNetToken ? '__RequestVerificationToken or __VIEWSTATE' : 'ASP.NET session cookie',
    });
    detected.push({
      name: 'Microsoft .NET',
      category: 'Backend Runtime',
      confidence: 0.9,
      evidence: 'ASP.NET framework runtime',
    });
  }

  // 6. Java (Servlet / Spring / Tomcat)
  if (cookies.has('JSESSIONID') || cookieList.some((c) => c.startsWith('JSESSIONID'))) {
    detected.push({
      name: 'Java',
      category: 'Backend Runtime',
      confidence: 0.95,
      evidence: 'JSESSIONID session cookie',
    });
  }

  // 7. Node.js (Express session)
  if (cookies.has('connect.sid') || cookieList.some((c) => c.startsWith('connect.sid'))) {
    detected.push({
      name: 'Express',
      category: 'Backend Framework',
      confidence: 0.95,
      evidence: 'connect.sid session cookie',
    });
    detected.push({
      name: 'Node.js',
      category: 'JavaScript Runtime',
      confidence: 0.95,
      evidence: 'Express session cookie',
    });
  }

  // 8. Drupal (CMS & Backend)
  if (
    (win as any)?.Drupal ||
    doc.querySelector('script[src*="/core/misc/drupal.js"]') ||
    doc.querySelector('meta[name="generator"][content*="Drupal"]')
  ) {
    const gen = doc.querySelector('meta[name="generator"][content*="Drupal"]')?.getAttribute('content');
    const vMatch = gen?.match(/Drupal\s+([\d.]+)/i);
    detected.push({
      name: 'Drupal',
      category: 'CMS / PHP Backend',
      version: vMatch ? vMatch[1] : undefined,
      confidence: 1.0,
      evidence: gen ? `Meta generator: ${gen}` : 'window.Drupal global runtime',
    });
    if (!detected.some((d) => d.name === 'PHP')) {
      detected.push({
        name: 'PHP',
        category: 'Backend Language',
        confidence: 0.95,
        evidence: 'Drupal CMS runtime',
      });
    }
  }

  return detected;
}

/**
 * Detects backend technologies from HTTP response headers (Server, X-Powered-By, PaaS markers).
 */
export function detectBackendFromHeaders(headers: Record<string, string>): DetectedTechnology[] {
  const detected: DetectedTechnology[] = [];
  const getHeader = (name: string): string | undefined => {
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lower && typeof v === 'string') {
        return v.trim();
      }
    }
    return undefined;
  };

  const server = getHeader('server') || '';
  const poweredBy = getHeader('x-powered-by') || '';
  const xAspNet = getHeader('x-aspnet-version');
  const xAspNetMvc = getHeader('x-aspnetmvc-version');
  const xRuntime = getHeader('x-runtime');
  const xVercelId = getHeader('x-vercel-id');
  const xVercelCache = getHeader('x-vercel-cache');
  const xAmzCfId = getHeader('x-amz-cf-id');
  const xAmzRequestId = getHeader('x-amz-request-id');
  const flyReqId = getHeader('fly-request-id');
  const renderOrigin = getHeader('x-render-origin-server');
  const fastlyReqId = getHeader('x-fastly-request-id');
  const xVarnish = getHeader('x-varnish');
  const cfRay = getHeader('cf-ray');

  // ==========================================
  // 1. Web Servers (from Server Header)
  // ==========================================
  if (server) {
    // Nginx
    if (/nginx/i.test(server)) {
      const vMatch = server.match(/nginx\/([\d.]+)/i);
      detected.push({
        name: 'Nginx',
        category: 'Web Server',
        version: vMatch ? vMatch[1] : undefined,
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
    // Apache HTTP Server
    else if (/apache/i.test(server)) {
      const vMatch = server.match(/apache\/([\d.]+)/i);
      detected.push({
        name: 'Apache HTTP Server',
        category: 'Web Server',
        version: vMatch ? vMatch[1] : undefined,
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
    // Caddy
    else if (/caddy/i.test(server)) {
      const vMatch = server.match(/caddy\/([\d.]+)/i);
      detected.push({
        name: 'Caddy',
        category: 'Web Server',
        version: vMatch ? vMatch[1] : undefined,
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
    // LiteSpeed
    else if (/litespeed/i.test(server)) {
      detected.push({
        name: 'LiteSpeed',
        category: 'Web Server',
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
    // Kestrel (.NET Core)
    else if (/kestrel/i.test(server)) {
      detected.push({
        name: 'Kestrel',
        category: 'Web Server',
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
      if (!detected.some((d) => d.name === 'Microsoft .NET')) {
        detected.push({
          name: 'Microsoft .NET',
          category: 'Backend Runtime',
          confidence: 0.95,
          evidence: 'Kestrel web server',
        });
      }
    }
    // Microsoft-IIS
    else if (/microsoft-iis/i.test(server)) {
      const vMatch = server.match(/microsoft-iis\/([\d.]+)/i);
      detected.push({
        name: 'Microsoft IIS',
        category: 'Web Server',
        version: vMatch ? vMatch[1] : undefined,
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
    // Gunicorn (Python WSGI)
    else if (/gunicorn/i.test(server)) {
      const vMatch = server.match(/gunicorn\/([\d.]+)/i);
      detected.push({
        name: 'Gunicorn',
        category: 'WSGI Server',
        version: vMatch ? vMatch[1] : undefined,
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
      if (!detected.some((d) => d.name === 'Python')) {
        detected.push({
          name: 'Python',
          category: 'Backend Language',
          confidence: 0.95,
          evidence: 'Gunicorn WSGI server',
        });
      }
    }
    // Uvicorn (Python ASGI)
    else if (/uvicorn/i.test(server)) {
      detected.push({
        name: 'Uvicorn',
        category: 'ASGI Server',
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
      if (!detected.some((d) => d.name === 'Python')) {
        detected.push({
          name: 'Python',
          category: 'Backend Language',
          confidence: 0.95,
          evidence: 'Uvicorn ASGI server',
        });
      }
    }
    // Werkzeug (Python Flask)
    else if (/werkzeug/i.test(server)) {
      const vMatch = server.match(/werkzeug\/([\d.]+)/i);
      detected.push({
        name: 'Flask / Werkzeug',
        category: 'Python Framework',
        version: vMatch ? vMatch[1] : undefined,
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
      if (!detected.some((d) => d.name === 'Python')) {
        detected.push({
          name: 'Python',
          category: 'Backend Language',
          confidence: 0.95,
          evidence: 'Werkzeug server',
        });
      }
    }
    // Cowboy (Erlang / Elixir Phoenix)
    else if (/cowboy/i.test(server)) {
      detected.push({
        name: 'Cowboy (Elixir/Erlang)',
        category: 'Web Server',
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
    // OpenResty
    else if (/openresty/i.test(server)) {
      const vMatch = server.match(/openresty\/([\d.]+)/i);
      detected.push({
        name: 'OpenResty',
        category: 'Web Server',
        version: vMatch ? vMatch[1] : undefined,
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
    // Traefik
    else if (/traefik/i.test(server)) {
      detected.push({
        name: 'Traefik',
        category: 'Reverse Proxy',
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
    // Envoy
    else if (/envoy/i.test(server)) {
      detected.push({
        name: 'Envoy',
        category: 'Proxy / Service Mesh',
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
    // Netlify (from Server header)
    else if (/netlify/i.test(server)) {
      detected.push({
        name: 'Netlify',
        category: 'Cloud / Edge Platform',
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
    // Google Frontend (GFE)
    else if (/gfe|google frontend/i.test(server)) {
      detected.push({
        name: 'Google Cloud Infrastructure (GFE)',
        category: 'Cloud Platform',
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
    // Cloudflare
    else if (/cloudflare/i.test(server)) {
      detected.push({
        name: 'Cloudflare',
        category: 'CDN / Edge Network',
        confidence: 1.0,
        evidence: `Server header: ${server}`,
      });
    }
  }

  // ==========================================
  // 2. Backend Runtimes (from X-Powered-By)
  // ==========================================
  if (poweredBy) {
    // PHP
    if (/php/i.test(poweredBy)) {
      const vMatch = poweredBy.match(/php\/([\d.]+)/i);
      detected.push({
        name: 'PHP',
        category: 'Backend Language',
        version: vMatch ? vMatch[1] : undefined,
        confidence: 1.0,
        evidence: `X-Powered-By: ${poweredBy}`,
      });
    }
    // Express (Node.js)
    else if (/express/i.test(poweredBy)) {
      detected.push({
        name: 'Express',
        category: 'Backend Framework',
        confidence: 1.0,
        evidence: `X-Powered-By: ${poweredBy}`,
      });
      if (!detected.some((d) => d.name === 'Node.js')) {
        detected.push({
          name: 'Node.js',
          category: 'JavaScript Runtime',
          confidence: 0.98,
          evidence: 'Express web framework dependency',
        });
      }
    }
    // ASP.NET
    else if (/asp\.net/i.test(poweredBy)) {
      detected.push({
        name: 'ASP.NET',
        category: '.NET Framework',
        confidence: 1.0,
        evidence: `X-Powered-By: ${poweredBy}`,
      });
      if (!detected.some((d) => d.name === 'Microsoft .NET')) {
        detected.push({
          name: 'Microsoft .NET',
          category: 'Backend Runtime',
          confidence: 0.95,
          evidence: 'ASP.NET powered-by header',
        });
      }
    }
    // Next.js (from X-Powered-By)
    else if (/next\.js/i.test(poweredBy)) {
      const vMatch = poweredBy.match(/next\.js\s+([\d.]+)/i);
      detected.push({
        name: 'Next.js',
        category: 'Web Framework',
        version: vMatch ? vMatch[1] : undefined,
        confidence: 1.0,
        evidence: `X-Powered-By: ${poweredBy}`,
      });
    }
    // Java Servlet
    else if (/servlet/i.test(poweredBy)) {
      const vMatch = poweredBy.match(/servlet\/([\d.]+)/i);
      detected.push({
        name: 'Java Servlet',
        category: 'Backend Runtime',
        version: vMatch ? vMatch[1] : undefined,
        confidence: 1.0,
        evidence: `X-Powered-By: ${poweredBy}`,
      });
      if (!detected.some((d) => d.name === 'Java')) {
        detected.push({
          name: 'Java',
          category: 'Backend Runtime',
          confidence: 0.95,
          evidence: 'Java Servlet runtime',
        });
      }
    }
    // Phusion Passenger (Ruby / Python)
    else if (/phusion passenger/i.test(poweredBy)) {
      const vMatch = poweredBy.match(/passenger\/([\d.]+)/i);
      detected.push({
        name: 'Phusion Passenger',
        category: 'Application Server',
        version: vMatch ? vMatch[1] : undefined,
        confidence: 1.0,
        evidence: `X-Powered-By: ${poweredBy}`,
      });
    }
  }

  // ==========================================
  // 3. Framework-Specific Headers
  // ==========================================
  // ASP.NET Version headers
  if (xAspNet || xAspNetMvc) {
    const existing = detected.find((d) => d.name.includes('ASP.NET'));
    if (existing) {
      existing.version = xAspNet || xAspNetMvc;
      existing.evidence += ` (${xAspNet ? `X-AspNet-Version: ${xAspNet}` : `X-AspNetMvc-Version: ${xAspNetMvc}`})`;
    } else {
      detected.push({
        name: 'ASP.NET',
        category: '.NET Framework',
        version: xAspNet || xAspNetMvc,
        confidence: 1.0,
        evidence: xAspNet ? `X-AspNet-Version: ${xAspNet}` : `X-AspNetMvc-Version: ${xAspNetMvc}`,
      });
    }
    if (!detected.some((d) => d.name === 'Microsoft .NET')) {
      detected.push({
        name: 'Microsoft .NET',
        category: 'Backend Runtime',
        confidence: 0.95,
        evidence: 'ASP.NET framework header',
      });
    }
  }

  // Ruby on Rails (X-Runtime header)
  if (xRuntime && !detected.some((d) => d.name === 'Ruby on Rails')) {
    // X-Runtime header has format like 0.023412 or float seconds
    if (/^[\d.]+$/.test(xRuntime)) {
      detected.push({
        name: 'Ruby on Rails',
        category: 'Ruby Framework',
        confidence: 0.95,
        evidence: `X-Runtime header: ${xRuntime}s server response`,
      });
      if (!detected.some((d) => d.name === 'Ruby')) {
        detected.push({
          name: 'Ruby',
          category: 'Backend Language',
          confidence: 0.9,
          evidence: 'Ruby on Rails runtime',
        });
      }
    }
  }

  // ==========================================
  // 4. Cloud, Hosting & Edge Platforms
  // ==========================================
  // Vercel
  if (xVercelId || xVercelCache) {
    if (!detected.some((d) => d.name === 'Vercel')) {
      detected.push({
        name: 'Vercel',
        category: 'Cloud / Edge Platform',
        confidence: 1.0,
        evidence: xVercelId ? `X-Vercel-Id: ${xVercelId}` : 'X-Vercel-Cache header',
      });
    }
  }

  // AWS CloudFront / S3
  if (xAmzCfId) {
    if (!detected.some((d) => d.name === 'Amazon CloudFront')) {
      detected.push({
        name: 'Amazon CloudFront',
        category: 'CDN / Edge Network',
        confidence: 1.0,
        evidence: 'X-Amz-Cf-Id response header',
      });
    }
  }
  if (xAmzRequestId) {
    if (!detected.some((d) => d.name === 'Amazon Web Services (AWS)')) {
      detected.push({
        name: 'Amazon Web Services (AWS)',
        category: 'Cloud Platform',
        confidence: 0.95,
        evidence: 'X-Amz-Request-Id response header',
      });
    }
  }

  // Fly.io
  if (flyReqId) {
    detected.push({
      name: 'Fly.io',
      category: 'Cloud Platform',
      confidence: 1.0,
      evidence: `Fly-Request-Id: ${flyReqId}`,
    });
  }

  // Render
  if (renderOrigin) {
    detected.push({
      name: 'Render',
      category: 'Cloud Platform',
      confidence: 1.0,
      evidence: `X-Render-Origin-Server: ${renderOrigin}`,
    });
  }

  // Fastly
  if (fastlyReqId) {
    detected.push({
      name: 'Fastly',
      category: 'CDN',
      confidence: 1.0,
      evidence: `X-Fastly-Request-Id: ${fastlyReqId}`,
    });
  }

  // Varnish
  if (xVarnish) {
    detected.push({
      name: 'Varnish Cache',
      category: 'Caching Reverse Proxy',
      confidence: 1.0,
      evidence: `X-Varnish: ${xVarnish}`,
    });
  }

  // Cloudflare (CF-Ray)
  if (cfRay && !detected.some((d) => d.name === 'Cloudflare')) {
    detected.push({
      name: 'Cloudflare',
      category: 'CDN / Edge Network',
      confidence: 1.0,
      evidence: `CF-Ray header: ${cfRay}`,
    });
  }

  return detected;
}
