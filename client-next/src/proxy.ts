import { NextRequest, NextResponse } from 'next/server';

// The Next rewrite otherwise replaces the external Host with 127.0.0.1,
// defeating the backend's DNS-rebinding protection. Check it before rewriting.
export function proxy(request: NextRequest) {
  if (process.env.STUDIO_PROXY_API !== '1') return NextResponse.next();
  try {
    const configured = new URL(process.env.STUDIO_PUBLIC_ORIGIN || '');
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname);
    if (configured.origin !== process.env.STUDIO_PUBLIC_ORIGIN ||
        !(configured.protocol === 'https:' || (configured.protocol === 'http:' && isLoopback)) ||
        request.headers.get('host')?.toLowerCase() !== configured.host.toLowerCase()) {
      return new NextResponse('Untrusted host', { status: 403 });
    }
  } catch {
    return new NextResponse('Invalid configured origin', { status: 503 });
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
