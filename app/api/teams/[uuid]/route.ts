import { NextResponse } from 'next/server';
import { prisma } from '@/prisma';
import { authenticated } from '@/lib/authenticated';

export const DELETE = authenticated(1, async (session, req, { params }) => {
  try {
    const { uuid } = params;

    if (!uuid) {
      console.error('User ID is missing');
      return NextResponse.json({ error: 'User ID is missing' }, { status: 400 });
    }

    // Attempt to delete the user from the database
    const deletedUser = await prisma.user.delete({
      where: { id: uuid },
    });

    // Return success response
    return NextResponse.json({ message: 'User deleted successfully', user: deletedUser });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
});
