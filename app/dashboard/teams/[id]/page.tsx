"use client";

import { Breadcrumbs } from "@/components/breadcrumbs";
// import { EditUserForm } from "@/components/forms/edit-user-form";
import PageContainer from "@/components/layout/page-container";
const breadcrumbItems = [
  { title: "Dashboard", link: "/dashboard" },
  { title: "Users", link: "/dashboard/teams" },
  { title: "Edit", link: "#" },
];

export default function Page({ params }: { params: { id: string } }) {
  return (
    <PageContainer scrollable={true}>
      <div className="space-y-2 w-full">
        <Breadcrumbs items={breadcrumbItems} />
        {/* <EditUserForm userId={params.id} /> */}
      </div>
    </PageContainer>
  );
}
