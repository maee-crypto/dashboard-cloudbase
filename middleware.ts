import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtMiddleware } from './middleware/jwt-auth';

export async function middleware(req: NextRequest) {
    // For JWT-protected API routes
    if (req.nextUrl.pathname.startsWith('/api/operations/extension/')) {
      return jwtMiddleware(req);
    }
    
  // For NextAuth protected dashboard routes
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const url = req.nextUrl.clone();

  if (token) {
    if (req.nextUrl.pathname === '/') {
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  } else {
    if (req.nextUrl.pathname.startsWith('/dashboard')) {
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  } 

  return NextResponse.next();
}

// Configure middleware to run only on API routes
export const config = {
  matcher: [
    "/dashboard/:path*", 
    "/",
    '/api/operations/extension/:path*'
  ],
};
