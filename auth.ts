import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/prisma";
import EmailProvider from "next-auth/providers/email";
import NextAuth, { SessionStrategy, NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: "jwt" as SessionStrategy,
    maxAge: 60 * 60, // 1 hour in seconds
  },
  jwt: {
    maxAge: 60 * 60, // Also enforce 1 hour expiry in token
  },
  callbacks: {
    // Modify the signIn callback to only allow users who exist in the database
    async signIn({ user }: any) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (dbUser) {
          user.role = dbUser.role; // Save the role to the user object
          return true; // Allow sign in only if user exists in DB
        } else {
          return false; // Reject sign in if user does not exist in DB
        }
      }
      return false; // Reject if no email
    },
    // Use the user object to populate the token (no DB call needed here)
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role; // Pass the role to the token
      }
      // Check if the user still exists in the database
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });
        if (!dbUser) {
          throw new Error("User no longer exists"); // Invalidate the token by throwing an error
        }
      }
      return token;
    },
    // Use the role from the token in the session
    async session({ session, token }: any) {
      if (session.user) {
        session.user.role = token.role; // Attach role from token to session
        // Check if the user still exists in the database
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
        });
        if (!dbUser) {
          session.user = null; // Clear the session user if the user is deleted
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);