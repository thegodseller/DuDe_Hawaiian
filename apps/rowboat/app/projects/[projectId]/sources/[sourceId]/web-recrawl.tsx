'use client';
import { FormStatusButton } from "../../../../lib/components/FormStatusButton";
import { RefreshCwIcon } from "lucide-react";

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
                startContent: <RefreshCwIcon />,
                children: "Refresh",
            }}
        />
    </form>;
}