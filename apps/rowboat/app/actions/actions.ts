'use server';
import { z } from 'zod';
import { getAgenticResponseStreamId } from "../lib/utils";
import { check_query_limit } from "../lib/rate_limiting";
import { QueryLimitError } from "../lib/client_utils";
import { projectAuthCheck } from "./project_actions";
import { authorizeUserAction } from "./billing_actions";
import { Workflow } from "../lib/types/workflow_types";
import { Message } from "@/app/lib/types/types";

export async function getAssistantResponseStreamId(
    projectId: string,
    workflow: z.infer<typeof Workflow>,
    messages: z.infer<typeof Message>[],
): Promise<{ streamId: string } | { billingError: string }> {
    await projectAuthCheck(projectId);
    if (!await check_query_limit(projectId)) {
        throw new QueryLimitError();
    }

    // Check billing authorization
    const agentModels = workflow.agents.reduce((acc, agent) => {
        acc.push(agent.model);
        return acc;
    }, [] as string[]);
    const { success, error } = await authorizeUserAction({
        type: 'agent_response',
        data: {
            agentModels,
        },
    });
    if (!success) {
        return { billingError: error || 'Billing error' };
    }

    const response = await getAgenticResponseStreamId(projectId, workflow, messages);
    return response;
}