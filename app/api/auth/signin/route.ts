import NextAuth from "next-auth";
import { authOptions } from '@/auth';

export const { GET, POST } = NextAuth(authOptions);