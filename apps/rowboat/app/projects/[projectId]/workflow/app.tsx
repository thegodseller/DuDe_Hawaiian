"use client";
import { MCPServer, WithStringId } from "../../../lib/types/types";
import { DataSource } from "../../../lib/types/datasource_types";
import { Project } from "../../../lib/types/project_types";
import { z } from "zod";
import { useCallback, useEffect, useState } from "react";
import { WorkflowEditor } from "./workflow_editor";
import { Spinner } from "@heroui/react";
import { listDataSources } from "../../../actions/datasource_actions";
import { collectProjectTools, revertToLiveWorkflow } from "@/app/actions/project_actions";
import { getProjectConfig } from "@/app/actions/project_actions";
import { Workflow, WorkflowTool } from "@/app/lib/types/workflow_types";
import { getEligibleModels } from "@/app/actions/billing_actions";
import { ModelsResponse } from "@/app/lib/types/billing_types";

export function App({
    projectId,
    useRag,
    defaultModel,
}: {
    projectId: string;
    useRag: boolean;
    defaultModel: string;
}) {
    const [mode, setMode] = useState<'draft' | 'live'>('draft');
    const [project, setProject] = useState<WithStringId<z.infer<typeof Project>> | null>(null);
    const [dataSources, setDataSources] = useState<WithStringId<z.infer<typeof DataSource>>[] | null>(null);
    const [projectTools, setProjectTools] = useState<z.infer<typeof WorkflowTool>[] | null>(null);
    const [projectConfig, setProjectConfig] = useState<z.infer<typeof Project> | null>(null);
    const [loading, setLoading] = useState(false);
    const [eligibleModels, setEligibleModels] = useState<z.infer<typeof ModelsResponse> | "*">("*");
    const [projectMcpServers, setProjectMcpServers] = useState<Array<z.infer<typeof MCPServer>>>([]);
    const [webhookUrl, setWebhookUrl] = useState<string>('');

    console.log('workflow app.tsx render');

    // choose which workflow to display
    let workflow: z.infer<typeof Workflow> | undefined = project?.draftWorkflow;
    if (mode == 'live') {
        workflow = project?.liveWorkflow;
    }

    const loadData = useCallback(async () => {
        setLoading(true);
        const [
            project,
            dataSources,
            projectTools,
            eligibleModels,
        ] = await Promise.all([
            getProjectConfig(projectId),
            listDataSources(projectId),
            collectProjectTools(projectId),
            getEligibleModels(),
        ]);

        setProject(project);
        setDataSources(dataSources);
        setProjectTools(projectTools);
        setEligibleModels(eligibleModels);
        if (project.mcpServers) {
            setProjectMcpServers(project.mcpServers);
        }
        if (project.webhookUrl) {
            setWebhookUrl(project.webhookUrl);
        }
        setLoading(false);
    }, [projectId]);

    const handleProjectToolsUpdate = useCallback(async () => {
        // Lightweight refresh for tool-only updates
        const [projectConfig, projectTools] = await Promise.all([
            getProjectConfig(projectId),
            collectProjectTools(projectId),
        ]);
        
        setProject(projectConfig);
        setProjectConfig(projectConfig);
        setProjectTools(projectTools);
        
        // Update MCP servers if they changed
        if (projectConfig.mcpServers) {
            setProjectMcpServers(projectConfig.mcpServers);
        }
        
        // Update webhook URL if it changed
        if (projectConfig.webhookUrl) {
            setWebhookUrl(projectConfig.webhookUrl);
        }
    }, [projectId]);
    // Add this useEffect for initial load
    useEffect(() => {
        loadData();
    }, [mode, loadData, projectId]);

    // Add focus-based refresh to handle cross-page updates
    useEffect(() => {
        const handleFocus = () => {
            // Refresh data when user returns to this page/tab
            loadData();
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                loadData();
            }
        };

        const handleStorageChange = (e: StorageEvent) => {
            // Listen for tool updates from other tabs
            if (e.key === `tools-updated-${projectId}` && e.newValue) {
                loadData();
                // Clear the flag
                localStorage.removeItem(`tools-updated-${projectId}`);
            } else if (e.key === `tools-light-refresh-${projectId}` && e.newValue) {
                // Lightweight refresh for tool-only updates
                handleProjectToolsUpdate();
                // Clear the flag
                localStorage.removeItem(`tools-light-refresh-${projectId}`);
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [loadData, handleProjectToolsUpdate, projectId]);

    function handleSetMode(mode: 'draft' | 'live') {
        setMode(mode);
    }

    async function handleRevertToLive() {
        setLoading(true);
        await revertToLiveWorkflow(projectId);
        loadData();
    }

    // if workflow is null, show the selector
    // else show workflow editor
    return <>
        {loading && <div className="flex items-center gap-1">
            <Spinner size="sm" />
            <div>Loading workflow...</div>
        </div>}
        {!loading && !workflow && <div>No workflow found!</div>}
        {!loading && project && workflow && (dataSources !== null) && (projectTools !== null) && <WorkflowEditor
            projectId={projectId}
            isLive={mode == 'live'}
            workflow={workflow}
            dataSources={dataSources}
            projectTools={projectTools}
            projectConfig={projectConfig || project}
            useRag={useRag}
            mcpServerUrls={projectMcpServers}
            toolWebhookUrl={webhookUrl}
            defaultModel={defaultModel}
            eligibleModels={eligibleModels}
            onChangeMode={handleSetMode}
            onRevertToLive={handleRevertToLive}
            onProjectToolsUpdated={handleProjectToolsUpdate}
        />}
    </>
}
