import { DataSource } from "@/app/lib/types";
import { Spinner } from "@nextui-org/react";
import { Link } from "@nextui-org/react";
import { z } from 'zod';

export function SourceStatus({
    status,
    projectId,
    compact = false,
}: {
    status: z.infer<typeof DataSource>['status'],
    projectId: string,
    compact?: boolean;
}) {
    return <div>
        {status == 'error' && <div className="flex flex-col gap-1 items-start">
            <div className="flex gap-1 items-center">
                <svg className="w-[24px] h-[24px] text-red-600" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm11-4a1 1 0 1 0-2 0v5a1 1 0 1 0 2 0V8Zm-1 7a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2H12Z" clipRule="evenodd" />
                </svg>
                <div>Error</div>
            </div>
            {!compact && <div className="text-sm text-gray-400">
                There was an unexpected error while processing this resource.
            </div>}
        </div>}
        {status == 'pending' && <div className="flex flex-col gap-1 items-start">
            <div className="flex gap-1 items-center">
                <Spinner size="sm" />
                <div className="text-gray-400">
                    Processing&hellip;
                </div>
            </div>
            {!compact && <div className="text-sm text-gray-400">
                This source is being processed. This may take a few minutes.
            </div>}
        </div>}
        {status === 'ready' && <div className="flex flex-col gap-1 items-start">
            <div className="flex gap-1 items-center">
                <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm13.707-1.293a1 1 0 0 0-1.414-1.414L11 12.586l-1.793-1.793a1 1 0 0 0-1.414 1.414l2.5 2.5a1 1 0 0 0 1.414 0l4-4Z" clipRule="evenodd" />
                </svg>
                <div>Ready</div>
            </div>
            {!compact && <div>
                This source has been indexed and is ready to use.
            </div>}
        </div>}
    </div>;
}