import { PrismaClient } from '@prisma/client';

// Singleton pattern for PrismaClient to avoid connection issues
export class PrismaService {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaClient();
    }
    return PrismaService.instance;
  }
}

export const prisma = PrismaService.getInstance(); 