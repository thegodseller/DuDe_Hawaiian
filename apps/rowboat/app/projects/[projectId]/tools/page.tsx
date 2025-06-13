import { Suspense } from 'react';
import { ToolsConfig } from './components/ToolsConfig';
import { PageHeader } from '@/components/ui/page-header';
import { requireActiveBillingSubscription } from '@/app/lib/billing';

export default async function ToolsPage() {
  await requireActiveBillingSubscription();

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Tools"
        description="Configure and manage your project's tool integrations"
      />
      <div className="flex-1 p-6">
        <Suspense fallback={<div>Loading...</div>}>
          <ToolsConfig />
        </Suspense>
      </div>
    </div>
  );
}
