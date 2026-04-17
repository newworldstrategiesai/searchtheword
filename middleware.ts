import { NextRequest, NextResponse } from 'next/server';
import type { NextConfig } from 'next';

export default function middleware(request: NextRequest) {
  // Add CSP headers for Google Drive embedding
  const response = NextResponse.next();
  
  // Add Content Security Policy headers
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "media-src 'self' https:",
      "frame-src 'self' https://drive.google.com https://docs.google.com https://accounts.google.com https://www.youtube.com",
      "connect-src 'self' https://www.google-analytics.com https://api.openai.com",
      "frame-ancestors 'self' https://drive.google.com https://docs.google.com https://accounts.google.com"
    ].join('; ')
  );

  return response;
}
