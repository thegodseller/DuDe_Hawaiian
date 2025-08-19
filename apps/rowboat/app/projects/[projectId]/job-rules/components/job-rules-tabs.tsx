'use client';

import { useState } from "react";
import { Tabs, Tab } from "@/components/ui/tabs";
import { ScheduledJobRulesList } from "../scheduled/components/scheduled-job-rules-list";
import { RecurringJobRulesList } from "./recurring-job-rules-list";
import { TriggersTab } from "./triggers-tab";

export function JobRulesTabs({ projectId }: { projectId: string }) {
    const [activeTab, setActiveTab] = useState<string>("triggers");

    const handleTabChange = (key: React.Key) => {
        setActiveTab(key.toString());
    };

    return (
        <div className="h-full flex flex-col">
            <Tabs
                selectedKey={activeTab}
                onSelectionChange={handleTabChange}
                aria-label="Job Rules"
                fullWidth
            >
                <Tab key="triggers" title="Triggers">
                    <TriggersTab projectId={projectId} />
                </Tab>
                <Tab key="scheduled" title="One-time">
                    <ScheduledJobRulesList projectId={projectId} />
                </Tab>
                <Tab key="recurring" title="Recurring">
                    <RecurringJobRulesList projectId={projectId} />
                </Tab>
            </Tabs>
        </div>
    );
}
