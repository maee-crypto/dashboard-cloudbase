import { Breadcrumbs } from '@/components/breadcrumbs';
import PageContainer from '@/components/layout/page-container';
import { columns } from '@/components/tables/user-tables/columns';
import { UsersTable } from '@/components/tables/user-tables/users-table';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { fetchUsers } from '@/utils/Users';

type paramsProps = {
  searchParams: {
    search?: string;
    page?: string;
    limit?: string;
  };
};

const breadcrumbItems = [
  { title: 'Dashboard', link: '/dashboard' },
  { title: 'Active Users', link: '/dashboard/teams' }
];

export default async function Page({ searchParams }: paramsProps) {
  const search = searchParams.search || '';
  const pageNo = parseInt(searchParams.page || '1', 10);
  const pageLimit = parseInt(searchParams.limit || '10', 10);

  const { userLists = [], totalUserLists = 0 } = await fetchUsers(search, pageNo, pageLimit);
  const pageCount = Math.ceil(totalUserLists / pageLimit);

  return (
    <PageContainer>
      <div className="space-y-4">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="flex items-start justify-between">
          <Heading
            title={`Active Users (${totalUserLists})`}
            description="List of current team members."
          />
          <Link
            href="/dashboard/teams/new"
            className={cn(buttonVariants({ variant: 'default' }))}
            >
            <Plus className="mr-2 h-4 w-4" /> Add New
          </Link>
        </div>
        <Separator />

        <UsersTable
          searchKey="email"
          columns={columns}
          data={userLists}
          pageNo={pageNo}
          totalUsers={totalUserLists}
          pageCount={pageCount}
        />
      </div>
    </PageContainer>
  );
}
