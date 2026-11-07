import { describe, it, expect } from 'vitest';
import { detectBackendFromHeaders, detectBackendFromDom } from '../src/collectors/page/backend-signatures';

describe('Backend Technology Detection', () => {
  describe('detectBackendFromHeaders', () => {
    it('detects Nginx web server with version', () => {
      const headers = { server: 'nginx/1.24.0' };
      const detected = detectBackendFromHeaders(headers);
      const nginx = detected.find((d) => d.name === 'Nginx');
      expect(nginx).toBeDefined();
      expect(nginx?.version).toBe('1.24.0');
      expect(nginx?.category).toBe('Web Server');
    });

    it('detects Apache HTTP Server with version', () => {
      const headers = { server: 'Apache/2.4.52 (Ubuntu)' };
      const detected = detectBackendFromHeaders(headers);
      const apache = detected.find((d) => d.name === 'Apache HTTP Server');
      expect(apache).toBeDefined();
      expect(apache?.version).toBe('2.4.52');
      expect(apache?.category).toBe('Web Server');
    });

    it('detects PHP runtime and version from X-Powered-By', () => {
      const headers = {
        server: 'nginx',
        'x-powered-by': 'PHP/8.2.12',
      };
      const detected = detectBackendFromHeaders(headers);
      const php = detected.find((d) => d.name === 'PHP');
      expect(php).toBeDefined();
      expect(php?.version).toBe('8.2.12');
      expect(php?.category).toBe('Backend Language');
    });

    it('detects Express and Node.js from X-Powered-By', () => {
      const headers = { 'x-powered-by': 'Express' };
      const detected = detectBackendFromHeaders(headers);
      expect(detected.some((d) => d.name === 'Express')).toBe(true);
      expect(detected.some((d) => d.name === 'Node.js')).toBe(true);
    });

    it('detects Kestrel and Microsoft .NET', () => {
      const headers = { server: 'Kestrel' };
      const detected = detectBackendFromHeaders(headers);
      expect(detected.some((d) => d.name === 'Kestrel')).toBe(true);
      expect(detected.some((d) => d.name === 'Microsoft .NET')).toBe(true);
    });

    it('detects Python WSGI/ASGI servers (Gunicorn, Uvicorn, Werkzeug)', () => {
      const headers = { server: 'gunicorn/20.1.0' };
      const detected = detectBackendFromHeaders(headers);
      expect(detected.some((d) => d.name === 'Gunicorn')).toBe(true);
      expect(detected.some((d) => d.name === 'Python')).toBe(true);
    });

    it('detects Ruby on Rails from X-Runtime header', () => {
      const headers = {
        server: 'nginx',
        'x-runtime': '0.045231',
      };
      const detected = detectBackendFromHeaders(headers);
      expect(detected.some((d) => d.name === 'Ruby on Rails')).toBe(true);
      expect(detected.some((d) => d.name === 'Ruby')).toBe(true);
    });

    it('detects ASP.NET and .NET version headers', () => {
      const headers = {
        'x-aspnet-version': '4.0.30319',
        'x-powered-by': 'ASP.NET',
      };
      const detected = detectBackendFromHeaders(headers);
      const aspnet = detected.find((d) => d.name === 'ASP.NET');
      expect(aspnet).toBeDefined();
      expect(aspnet?.version).toBe('4.0.30319');
      expect(detected.some((d) => d.name === 'Microsoft .NET')).toBe(true);
    });

    it('detects cloud platforms: Vercel, AWS CloudFront, Fly.io, Netlify', () => {
      const vercelHeaders = { 'x-vercel-id': 'iad1::abcdef', server: 'Vercel' };
      expect(detectBackendFromHeaders(vercelHeaders).some((d) => d.name === 'Vercel')).toBe(true);

      const awsHeaders = { 'x-amz-cf-id': 'xyz123==', 'x-amz-request-id': 'ABCDEF' };
      const awsDetected = detectBackendFromHeaders(awsHeaders);
      expect(awsDetected.some((d) => d.name === 'Amazon CloudFront')).toBe(true);
      expect(awsDetected.some((d) => d.name === 'Amazon Web Services (AWS)')).toBe(true);

      const flyHeaders = { 'fly-request-id': 'fly_0123' };
      expect(detectBackendFromHeaders(flyHeaders).some((d) => d.name === 'Fly.io')).toBe(true);

      const netlifyHeaders = { server: 'Netlify' };
      expect(detectBackendFromHeaders(netlifyHeaders).some((d) => d.name === 'Netlify')).toBe(true);
    });
  });

  describe('detectBackendFromDom', () => {
    it('detects PHP via PHPSESSID cookie', () => {
      const mockDoc = {
        cookie: 'PHPSESSID=abcdef123456; other=1',
        querySelector: () => null,
      } as unknown as Document;

      const detected = detectBackendFromDom(mockDoc);
      expect(detected.some((d) => d.name === 'PHP')).toBe(true);
    });

    it('detects Laravel via laravel_session cookie', () => {
      const mockDoc = {
        cookie: 'laravel_session=eyJpdiI6...; XSRF-TOKEN=xyz',
        querySelector: () => null,
      } as unknown as Document;

      const detected = detectBackendFromDom(mockDoc);
      expect(detected.some((d) => d.name === 'Laravel')).toBe(true);
      expect(detected.some((d) => d.name === 'PHP')).toBe(true);
    });

    it('detects Django via CSRF form token or csrftoken cookie', () => {
      const mockDoc = {
        cookie: 'csrftoken=abcdef;',
        querySelector: (sel: string) => (sel === 'input[name="csrfmiddlewaretoken"]' ? {} : null),
      } as unknown as Document;

      const detected = detectBackendFromDom(mockDoc);
      expect(detected.some((d) => d.name === 'Django')).toBe(true);
      expect(detected.some((d) => d.name === 'Python')).toBe(true);
    });

    it('detects ASP.NET Core via anti-forgery token and session cookie', () => {
      const mockDoc = {
        cookie: '.AspNetCore.Session=abc; .AspNetCore.Antiforgery.xyz=123',
        querySelector: (sel: string) => (sel.includes('__RequestVerificationToken') ? {} : null),
      } as unknown as Document;

      const detected = detectBackendFromDom(mockDoc);
      expect(detected.some((d) => d.name === 'ASP.NET Core')).toBe(true);
      expect(detected.some((d) => d.name === 'Microsoft .NET')).toBe(true);
    });

    it('detects Java via JSESSIONID cookie', () => {
      const mockDoc = {
        cookie: 'JSESSIONID=1234567890ABCDEF',
        querySelector: () => null,
      } as unknown as Document;

      const detected = detectBackendFromDom(mockDoc);
      expect(detected.some((d) => d.name === 'Java')).toBe(true);
    });

    it('detects Express & Node.js via connect.sid cookie', () => {
      const mockDoc = {
        cookie: 'connect.sid=s%3A12345.abcdef',
        querySelector: () => null,
      } as unknown as Document;

      const detected = detectBackendFromDom(mockDoc);
      expect(detected.some((d) => d.name === 'Express')).toBe(true);
      expect(detected.some((d) => d.name === 'Node.js')).toBe(true);
    });
  });
});

