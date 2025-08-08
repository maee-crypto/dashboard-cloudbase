'use client';

import { Breadcrumbs } from '@/components/breadcrumbs';
import PageContainer from '@/components/layout/page-container';
import { AddTeamMemberForm } from '@/components/forms/new-user-form';
import { useState } from 'react';

const breadcrumbItems = [
  { title: 'Dashboard', link: '/dashboard' },
  { title: 'Teams', link: '/dashboard/teams' },
  { title: 'Add New Team Member', link: '#' }
];

export default function NewTeamMemberPage() {
  const [initialData] = useState(null); // No initial data for a new form

  return (
    <PageContainer scrollable={true}>
      <div className="space-y-2">
        <Breadcrumbs items={breadcrumbItems} />
        <AddTeamMemberForm /> {/* Render the new form */}
      </div>
    </PageContainer>
  );
}
