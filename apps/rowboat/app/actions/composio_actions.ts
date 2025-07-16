"use server";
import { z } from "zod";
import {
    listToolkits as libListToolkits,
    listTools as libListTools,
    searchTools as libSearchTools,
    getToolsByIds as libGetToolsByIds,
    getTool as libGetTool,
    getConnectedAccount as libGetConnectedAccount,
    deleteConnectedAccount as libDeleteConnectedAccount,
    listAuthConfigs as libListAuthConfigs,
    createAuthConfig as libCreateAuthConfig,
    getToolkit as libGetToolkit,
    createConnectedAccount as libCreateConnectedAccount,
    getAuthConfig as libGetAuthConfig,
    deleteAuthConfig as libDeleteAuthConfig,
    ZToolkit,
    ZGetToolkitResponse,
    ZTool,
    ZListResponse,
    ZCreateConnectedAccountResponse,
    ZAuthScheme,
    ZCredentials,
} from "@/app/lib/composio/composio";
import { ComposioConnectedAccount } from "@/app/lib/types/project_types";
import { WorkflowTool } from "@/app/lib/types/workflow_types";
import { getProjectConfig, projectAuthCheck } from "./project_actions";
import { projectsCollection } from "../lib/mongodb";

const ZCreateCustomConnectedAccountRequest = z.object({
    toolkitSlug: z.string(),
    authConfig: z.object({
        authScheme: ZAuthScheme,
        credentials: ZCredentials,
    }),
    callbackUrl: z.string(),
});

export async function listToolkits(projectId: string, cursor: string | null = null): Promise<z.infer<ReturnType<typeof ZListResponse<typeof ZToolkit>>>> {
    await projectAuthCheck(projectId);
    return await libListToolkits(cursor);
}

export async function getToolkit(projectId: string, toolkitSlug: string): Promise<z.infer<typeof ZGetToolkitResponse>> {
    await projectAuthCheck(projectId);
    return await libGetToolkit(toolkitSlug);
}

export async function listTools(projectId: string, toolkitSlug: string, cursor: string | null = null): Promise<z.infer<ReturnType<typeof ZListResponse<typeof ZTool>>>> {
    await projectAuthCheck(projectId);
    return await libListTools(toolkitSlug, cursor);
}

// New efficient search functions

export async function searchTools(projectId: string, searchQuery: string, cursor: string | null = null, limit?: number): Promise<z.infer<ReturnType<typeof ZListResponse<typeof ZTool>>>> {
    await projectAuthCheck(projectId);
    return await libSearchTools(searchQuery, cursor, limit);
}

export async function getToolsByIds(projectId: string, toolSlugs: string[], cursor: string | null = null): Promise<z.infer<ReturnType<typeof ZListResponse<typeof ZTool>>>> {
    await projectAuthCheck(projectId);
    return await libGetToolsByIds(toolSlugs, cursor);
}

export async function getTool(projectId: string, toolSlug: string): Promise<z.infer<typeof ZTool>> {
    await projectAuthCheck(projectId);
    return await libGetTool(toolSlug);
}


export async function createComposioManagedOauth2ConnectedAccount(projectId: string, toolkitSlug: string, callbackUrl: string): Promise<z.infer<typeof ZCreateConnectedAccountResponse>> {
    await projectAuthCheck(projectId);

    // fetch managed auth configs
    const configs = await libListAuthConfigs(toolkitSlug, null, true);

    // check if managed oauth2 config exists
    let authConfigId: string | undefined = undefined;
    const authConfig = configs.items.find(config => config.auth_scheme === 'OAUTH2' && config.is_composio_managed);
    authConfigId = authConfig?.id;
    if (!authConfig) {
        // create a new managed oauth2 auth config
        const newAuthConfig = await libCreateAuthConfig({
            toolkit: {
                slug: toolkitSlug,
            },
            auth_config: {
                type: 'use_composio_managed_auth',
                name: 'composio-managed-oauth2',
            },
        });
        authConfigId = newAuthConfig.auth_config.id;
    }
    if (!authConfigId) {
        throw new Error(`No managed oauth2 auth config found for toolkit ${toolkitSlug}`);
    }

    // create new connected account
    const response = await libCreateConnectedAccount({
        auth_config: {
            id: authConfigId,
        },
        connection: {
            user_id: projectId,
            callback_url: callbackUrl,
        },
    });

    // update project with new connected account
    const key = `composioConnectedAccounts.${toolkitSlug}`;
    const data: z.infer<typeof ComposioConnectedAccount> = {
        id: response.id,
        authConfigId: authConfigId,
        status: 'INITIATED',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
    }
    await projectsCollection.updateOne({ _id: projectId }, { $set: { [key]: data } });

    return response;
}

export async function createCustomConnectedAccount(projectId: string, request: z.infer<typeof ZCreateCustomConnectedAccountRequest>): Promise<z.infer<typeof ZCreateConnectedAccountResponse>> {
    await projectAuthCheck(projectId);

    // first, create the auth config
    const authConfig = await libCreateAuthConfig({
        toolkit: {
            slug: request.toolkitSlug,
        },
        auth_config: {
            type: 'use_custom_auth',
            authScheme: request.authConfig.authScheme,
            credentials: request.authConfig.credentials,
            name: `pid-${projectId}-${Date.now()}`,
        },
    });

    // then, create the connected account
    let state = undefined;
    if (request.authConfig.authScheme !== 'OAUTH2') {
        state = {
            authScheme: request.authConfig.authScheme,
            val: {
                status: 'ACTIVE' as const,
                ...request.authConfig.credentials,
            },
        };
    }
    const response = await libCreateConnectedAccount({
        auth_config: {
            id: authConfig.auth_config.id,
        },
        connection: {
            state,
            user_id: projectId,
            callback_url: request.callbackUrl,
        },
    });

    // update project with new connected account
    const key = `composioConnectedAccounts.${request.toolkitSlug}`;
    const data: z.infer<typeof ComposioConnectedAccount> = {
        id: response.id,
        authConfigId: authConfig.auth_config.id,
        status: 'INITIATED',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
    }
    await projectsCollection.updateOne({ _id: projectId }, { $set: { [key]: data } });

    // return the connected account
    return response;
}

export async function syncConnectedAccount(projectId: string, toolkitSlug: string, connectedAccountId: string): Promise<z.infer<typeof ComposioConnectedAccount>> {
    await projectAuthCheck(projectId);

    // ensure that the connected account belongs to this project
    const project = await getProjectConfig(projectId);
    const account = project.composioConnectedAccounts?.[toolkitSlug];
    if (!account || account.id !== connectedAccountId) {
        throw new Error(`Connected account ${connectedAccountId} not found in project ${projectId}`);
    }

    // if account is already active, nothing to sync
    if (account.status === 'ACTIVE') {
        return account;
    }

    // get the connected account
    const response = await libGetConnectedAccount(connectedAccountId);

    // update project with new connected account
    const key = `composioConnectedAccounts.${response.toolkit.slug}`;
    switch (response.status) {
        case 'INITIALIZING':
        case 'INITIATED':
            account.status = 'INITIATED';
            break;
        case 'ACTIVE':
            account.status = 'ACTIVE';
            break;
        default:
            account.status = 'FAILED';
            break;
    }
    account.lastUpdatedAt = new Date().toISOString();
    await projectsCollection.updateOne({ _id: projectId }, { $set: { [key]: account } });

    return account;
}

export async function deleteConnectedAccount(projectId: string, toolkitSlug: string, connectedAccountId: string): Promise<boolean> {
    await projectAuthCheck(projectId);

    // ensure that the connected account belongs to this project
    const project = await getProjectConfig(projectId);
    const account = project.composioConnectedAccounts?.[toolkitSlug];
    if (!account || account.id !== connectedAccountId) {
        throw new Error(`Connected account ${connectedAccountId} not found in project ${projectId} for toolkit ${toolkitSlug}`);
    }

    // delete the connected account
    await libDeleteConnectedAccount(connectedAccountId);

    // get auth config data
    const authConfig = await libGetAuthConfig(account.authConfigId);

    // delete the auth config if it is NOT managed by composio
    if (!authConfig.is_composio_managed) {
        await libDeleteAuthConfig(account.authConfigId);
    }

    // update project with deleted connected account
    const key = `composioConnectedAccounts.${toolkitSlug}`;
    await projectsCollection.updateOne({ _id: projectId }, { $unset: { [key]: "" } });

    // Notify other tabs about the tools update (lightweight refresh)
    if (typeof window !== 'undefined') {
        localStorage.setItem(`tools-light-refresh-${projectId}`, Date.now().toString());
    }

    return true;
}

// Note: composio tools are now stored in workflow.tools array with isComposio: true
// This function provides backward compatibility by updating workflow tools
export async function getComposioToolsFromWorkflow(projectId: string): Promise<z.infer<typeof ZTool>[]> {
    await projectAuthCheck(projectId);

    // Get the project to access draft workflow
    const project = await projectsCollection.findOne({ _id: projectId });
    if (!project || !project.draftWorkflow) {
        return [];
    }

    // Extract composio tools from workflow and convert back to ZTool format
    const composioTools = project.draftWorkflow.tools
        .filter(tool => tool.isComposio && tool.composioData)
        .map(tool => ({
            slug: tool.composioData!.slug,
            name: tool.name,
            description: tool.description,
            no_auth: tool.composioData!.noAuth,
            input_parameters: {
                type: 'object' as const,
                properties: tool.parameters.properties,
                required: tool.parameters.required || []
            },
            toolkit: {
                name: tool.composioData!.toolkitName,
                slug: tool.composioData!.toolkitSlug,
                logo: tool.composioData!.logo,
            }
        }));

    return composioTools;
}

export async function updateComposioSelectedTools(projectId: string, tools: z.infer<typeof ZTool>[]): Promise<void> {
    await projectAuthCheck(projectId);

    // Get the project to access draft workflow
    const project = await projectsCollection.findOne({ _id: projectId });
    if (!project || !project.draftWorkflow) {
        throw new Error(`Project ${projectId} not found or has no draft workflow`);
    }

    // Convert Composio tools to workflow tool format
    const composioWorkflowTools: z.infer<typeof WorkflowTool>[] = tools.map(tool => ({
        name: tool.slug,
        description: tool.description || "",
        parameters: {
            type: 'object' as const,
            properties: tool.input_parameters?.properties || {},
            required: tool.input_parameters?.required || []
        },
        isComposio: true,
        composioData: {
            slug: tool.slug,
            noAuth: tool.no_auth,
            toolkitName: tool.toolkit.name,
            toolkitSlug: tool.toolkit.slug,
            logo: tool.toolkit.logo,
        },
    }));

    // Remove existing composio tools and add new ones
    const nonComposioTools = project.draftWorkflow.tools.filter(tool => !tool.isComposio);
    const updatedWorkflow = {
        ...project.draftWorkflow,
        tools: [...nonComposioTools, ...composioWorkflowTools],
        lastUpdatedAt: new Date().toISOString()
    };

    // Update the project's draft workflow
    const result = await projectsCollection.updateOne(
        { _id: projectId },
        { $set: { draftWorkflow: updatedWorkflow } }
    );

    if (result.modifiedCount === 0) {
        throw new Error(`Failed to update workflow for project ${projectId}`);
    }

    // Notify other tabs about the tools update (lightweight refresh)
    if (typeof window !== 'undefined') {
        localStorage.setItem(`tools-light-refresh-${projectId}`, Date.now().toString());
    }
}

// Note: composio mock states are now stored in workflow.composioMockToolkitStates
// This function provides backward compatibility by updating workflow mock states
export async function toggleMockToolkitState(projectId: string, toolkitSlug: string, isMocked: boolean, mockInstructions?: string): Promise<void> {
    await projectAuthCheck(projectId);

    // Get the project to access draft workflow
    const project = await projectsCollection.findOne({ _id: projectId });
    if (!project || !project.draftWorkflow) {
        throw new Error(`Project ${projectId} not found or has no draft workflow`);
    }

    const now = new Date().toISOString();
    let updatedMockToolkitStates = { ...(project.draftWorkflow.composioMockToolkitStates || {}) };

    if (isMocked) {
        // Enable mock mode
        updatedMockToolkitStates[toolkitSlug] = {
            toolkitSlug,
            isMocked: true,
            mockInstructions: mockInstructions || 'Mock responses using GPT-4.1 based on tool descriptions.',
            autoSubmitMockedResponse: false,
            createdAt: now,
            lastUpdatedAt: now,
        };
    } else {
        // Disable mock mode - remove the toolkit from the object
        delete updatedMockToolkitStates[toolkitSlug];
    }

    // Update the workflow with new mock states
    const updatedWorkflow = {
        ...project.draftWorkflow,
        composioMockToolkitStates: updatedMockToolkitStates,
        lastUpdatedAt: now
    };

    // Update the project's draft workflow
    const result = await projectsCollection.updateOne(
        { _id: projectId },
        { $set: { draftWorkflow: updatedWorkflow } }
    );

    if (result.modifiedCount === 0) {
        throw new Error(`Failed to update workflow mock states for project ${projectId}`);
    }

    // Notify other tabs about the tools update (lightweight refresh)
    if (typeof window !== 'undefined') {
        localStorage.setItem(`tools-light-refresh-${projectId}`, Date.now().toString());
    }
}

// Note: composio mock states are now stored in workflow.composioMockToolkitStates  
// This function provides backward compatibility by updating workflow mock states
export async function updateMockToolkitInstructions(projectId: string, toolkitSlug: string, mockInstructions: string): Promise<void> {
    await projectAuthCheck(projectId);

    // Get the project to access draft workflow
    const project = await projectsCollection.findOne({ _id: projectId });
    if (!project || !project.draftWorkflow) {
        throw new Error(`Project ${projectId} not found or has no draft workflow`);
    }

    const now = new Date().toISOString();
    let updatedMockToolkitStates = { ...(project.draftWorkflow.composioMockToolkitStates || {}) };

    // Update the mock instructions for the specified toolkit
    if (updatedMockToolkitStates[toolkitSlug]) {
        updatedMockToolkitStates[toolkitSlug] = {
            ...updatedMockToolkitStates[toolkitSlug],
            mockInstructions,
            lastUpdatedAt: now
        };

        // Update the workflow with new mock states
        const updatedWorkflow = {
            ...project.draftWorkflow,
            composioMockToolkitStates: updatedMockToolkitStates,
            lastUpdatedAt: now
        };

        // Update the project's draft workflow
        const result = await projectsCollection.updateOne(
            { _id: projectId },
            { $set: { draftWorkflow: updatedWorkflow } }
        );

        if (result.modifiedCount === 0) {
            throw new Error(`Failed to update workflow mock instructions for project ${projectId}`);
        }

        // Notify other tabs about the tools update
        if (typeof window !== 'undefined') {
            localStorage.setItem(`tools-updated-${projectId}`, Date.now().toString());
        }
    } else {
        throw new Error(`Mock toolkit state for ${toolkitSlug} not found in project ${projectId}`);
    }
}