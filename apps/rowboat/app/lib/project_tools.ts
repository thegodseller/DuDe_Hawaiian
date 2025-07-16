import { z } from "zod";
import { projectsCollection } from "./mongodb";
import { WorkflowTool } from "./types/workflow_types";

export async function collectProjectTools(projectId: string): Promise<z.infer<typeof WorkflowTool>[]> {
    const tools: z.infer<typeof WorkflowTool>[] = [];

    // Get project data
    const project = await projectsCollection.findOne({ _id: projectId });
    if (!project) {
        throw new Error(`Project ${projectId} not found`);
    }

    // Convert MCP tools to workflow tools format, but only from ready servers
    if (project.mcpServers) {
        for (const server of project.mcpServers) {
            if (server.isReady) {
                for (const tool of server.tools) {
                    tools.push({
                        name: tool.name,
                        description: tool.description || "",
                        parameters: {
                            type: 'object' as const,
                            properties: tool.parameters?.properties || {},
                            required: tool.parameters?.required || []
                        },
                        isMcp: true,
                        mcpServerName: server.name,
                        mcpServerURL: server.serverUrl,
                    });
                }
            }
        }
    }

    // Note: Composio tools are now stored in workflow.tools array with isComposio: true
    // This function now only collects MCP tools since composio tools are managed in workflow

    return tools;
}
