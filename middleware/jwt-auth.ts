import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// These routes will be protected by JWT auth
const JWT_PROTECTED_ROUTES = [
  '/api/operations/extension/check-allowance',
  '/api/operations/extension/update-allowance'
];

// For development only - in production this should be an environment variable
// This MUST match the secret in app/api/auth/token/route.ts
const JWT_SECRET_KEY = process.env.JWT_SECRET || "emergency-withdrawal-system-super-secret-key";

// Helper function to add CORS headers to any response - export it for use in middleware.ts
export function addCorsHeaders(response: NextResponse, requestOrigin: string = '*') {
  // Get the actual origin from the request if available
  const origin = requestOrigin === '*' ? requestOrigin : requestOrigin;
  
  // If allowed, set CORS headers as usual
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Additional security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  
  return response;
}

export async function jwtMiddleware(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  const requestPath = req.nextUrl.pathname;

  if (!JWT_PROTECTED_ROUTES.some(route => requestPath.startsWith(route))) {
    return NextResponse.next(); // Not a JWT protected route, proceed
  }

  // Handle preflight CORS requests
  if (req.method === 'OPTIONS') {
    // Respond with 204 No Content and CORS headers
    return addCorsHeaders(new NextResponse(null, { status: 204 }), '*');
  }

  // Get authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const response = NextResponse.json(
      { success: false, error: 'Unauthorized: Missing JWT token' }, 
      { status: 401 }
    );
    return addCorsHeaders(response, '*');
  }

  const token = authHeader.split(' ')[1];
  try {
    // Verify JWT token using the secret
    const secretKey = new TextEncoder().encode(JWT_SECRET_KEY);
    const { payload } = await jwtVerify(token, secretKey);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('X-Token-ID', payload.sub as string);
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    return addCorsHeaders(response, '*');
  } catch (error) {
    console.error('JWT verification failed:', error);
    const response = NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid token' }, 
      { status: 401 }
    );
    return addCorsHeaders(response, '*');
  }
}