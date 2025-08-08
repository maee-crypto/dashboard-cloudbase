import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/prisma';

/**
 * Authenticate based on access levels:
 * - Level 1: Admin only
 * - Level 2: Viewer only
 * - Level 3: Both admin and viewer
 */
export function authenticated (level: number, handler: (session: any, req: Request, params?: any) => Promise<Response>) {
  return async (req: Request, ...args: any[]) => {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user exists in DB and get their role
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized: User not found' }, { status: 401 });
    }
    
    const userRole = dbUser.role;
    
    // Apply level-based access control
    switch (level) {
      case 1: // Admin only
        if (userRole !== 'admin') {
          return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }
        break;
      case 2: // Viewer only
        if (userRole !== 'viewer') {
          return NextResponse.json({ error: 'Forbidden: Viewer access required' }, { status: 403 });
        }
        break;
      case 3: // Both admin and viewer
        if (userRole !== 'admin' && userRole !== 'viewer') {
          return NextResponse.json({ error: 'Forbidden: Admin or viewer access required' }, { status: 403 });
        }
        break;
      default:
        return NextResponse.json({ error: 'Invalid access level configuration' }, { status: 500 });
    }
    
    // If we've reached here, the user is authorized for this level
    return handler(session, req, ...args);
  };
}