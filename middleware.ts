import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];
const PUBLIC_API_PATHS = ['/api/auth/login', '/api/auth/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some(p => pathname === p) ||
    PUBLIC_API_PATHS.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.get('shiori_session')?.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
