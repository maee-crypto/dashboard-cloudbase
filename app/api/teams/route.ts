import { NextResponse } from 'next/server';
import { prisma } from '@/prisma';
import { authenticated } from '@/lib/authenticated';

export const POST = authenticated(1, async (session, req) => {
  try {
    const { name, email, role } = await req.json();

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        role,
      },
    });

    return NextResponse.json({ message: 'Team member added successfully', user: newUser });
  } catch (error) {
    console.error('Error adding team member:', error);
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
})
