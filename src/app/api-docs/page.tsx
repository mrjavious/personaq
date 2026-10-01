'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    SwaggerUIBundle: {
      (config: Record<string, unknown>): void;
      presets: {
        apis: unknown;
      };
    };
    SwaggerUIStandalonePreset: unknown;
  }
}

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Swagger UI from CDN
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
    script.onload = () => {
      if (containerRef.current && window.SwaggerUIBundle) {
        window.SwaggerUIBundle({
          url: '/api-docs/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            window.SwaggerUIBundle.presets.apis,
            window.SwaggerUIStandalonePreset,
          ],
        });
      }
    };
    document.head.appendChild(script);

    // Load Swagger UI styles
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(script);
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div ref={containerRef} id="swagger-ui" />
    </div>
  );
}
