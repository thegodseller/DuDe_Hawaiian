'use client';

import { recrawlWebDataSource } from "@/app/actions";
import { FormStatusButton } from "@/app/lib/components/FormStatusButton";

export function Recrawl({
    projectId,
    sourceId,
    handleRefresh,
}: {
    projectId: string;
    sourceId: string;
    handleRefresh: () => void;
}) {
    return <form action={handleRefresh}>
        <FormStatusButton
            props={{
                type: "submit",
                startContent: <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4" />
                </svg>,
                children: "Refresh",
            }}
        />
    </form>;
}