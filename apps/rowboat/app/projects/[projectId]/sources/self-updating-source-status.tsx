'use client';
import { getUpdatedSourceStatus } from "@/app/actions";
import { DataSource } from "@/app/lib/types";
import { useEffect, useState } from "react";
import { z } from 'zod';
import { SourceStatus } from "./source-status";

export function SelfUpdatingSourceStatus({
    projectId,
    sourceId,
    initialStatus,
    compact = false,
}: {
    projectId: string;
    sourceId: string,
    initialStatus: z.infer<typeof DataSource>['status'],
    compact?: boolean;
}) {
    const [status, setStatus] = useState(initialStatus);

    useEffect(() => {
        console.log("in effect i'm here")
        let unmounted = false;
        if (status !== 'processing' && status !== 'new') {
            return;
        }

        function check() {
            if (unmounted) {
                return;
            }
            if (status !== 'processing' && status !== 'new') {
                return;
            }
            console.log("i'm here")
            getUpdatedSourceStatus(projectId, sourceId)
                .then((updatedStatus) => {
                    console.log("updatedStatus", updatedStatus)
                    setStatus(updatedStatus);
                    setTimeout(check, 15 * 1000);
                });
        }
        setTimeout(check, 15 * 1000);

        return () => {
            unmounted = true;
        };
    });

    return <SourceStatus status={status} compact={compact} projectId={projectId} />;
}