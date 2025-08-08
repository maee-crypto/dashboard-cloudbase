import { prisma } from '@/prisma'; // Assuming Prisma is set up here

export async function fetchUsers(search: string, pageNo: number, pageLimit: number) {
    const skip = (pageNo - 1) * pageLimit;
    const userLists = await prisma.user.findMany({
        where: {
            email: {
                contains: search,
                mode: 'insensitive',
            },
        },
        skip,
        take: pageLimit,
    });

    const totalUserLists = await prisma.user.count({
        where: {
            email: {
                contains: search,
                mode: 'insensitive',
            },
        },
    });

    return { userLists, totalUserLists };
}
