'use client';
import { toggleDataSource } from "@/app/actions/datasource_actions";
import { Spinner } from "@nextui-org/react";
import { Switch } from "@nextui-org/react";
import { useState } from "react";

export function ToggleSource({
    projectId,
    sourceId,
    active,
    compact=false,
}: {
    projectId: string;
    sourceId: string;
    active: boolean;
    compact?: boolean;
}) {
    const [loading, setLoading] = useState(false);
    const [isActive, setIsActive] = useState(active);

    function handleActiveSwitchChange(isSelected: boolean) {
        setIsActive(isSelected);
        setLoading(true);
        toggleDataSource(projectId, sourceId, isSelected)
            .finally(() => {
                setLoading(false);
            });
    }

    return <div className="flex flex-col gap-1 items-start">
        <div className="flex items-center gap-1">
            <Switch
                size={compact ? 'sm' : 'md'}
                disabled={loading}
                isSelected={isActive}
                onValueChange={handleActiveSwitchChange}
            >
                {isActive ? 'Active' : 'Inactive'}
            </Switch>
            {loading && <Spinner size="sm" />}
        </div>
        {!compact && !isActive && <p className="text-sm text-red-800">This data source will not be used for RAG.</p>}
    </div>;
}