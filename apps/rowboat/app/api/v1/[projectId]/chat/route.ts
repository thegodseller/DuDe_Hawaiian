import { NextRequest } from "next/server";
import { projectsCollection } from "../../../../lib/mongodb";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { authCheck } from "../../utils";
import { ApiRequest, ApiResponse } from "../../../../lib/types/types";
import { check_query_limit } from "../../../../lib/rate_limiting";
import { PrefixLogger } from "../../../../lib/utils";
import { authorize, getCustomerIdForProject, logUsage } from "@/app/lib/billing";
import { USE_BILLING } from "@/app/lib/feature_flags";
import { getResponse } from "@/app/lib/agents";

// get next turn / agent response
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
): Promise<Response> {
    const { projectId } = await params;
    const requestId = crypto.randomUUID();
    const logger = new PrefixLogger(`${requestId}`);

    logger.log(`Got chat request for project ${projectId}`);

    // check query limit
    if (!await check_query_limit(projectId)) {
        logger.log(`Query limit exceeded for project ${projectId}`);
        return Response.json({ error: "Query limit exceeded" }, { status: 429 });
    }

    return await authCheck(projectId, req, async () => {
        // fetch billing customer id
        let billingCustomerId: string | null = null;
        if (USE_BILLING) {
            billingCustomerId = await getCustomerIdForProject(projectId);
        }

        // parse and validate the request body
        let body;
        try {
            body = await req.json();
        } catch (e) {
            logger.log(`Invalid JSON in request body: ${e}`);
            return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
        }
        logger.log(`Request json: ${JSON.stringify(body, null, 2)}`);
        const result = ApiRequest.safeParse(body);
        if (!result.success) {
            logger.log(`Invalid request body: ${result.error.message}`);
            return Response.json({ error: `Invalid request body: ${result.error.message}` }, { status: 400 });
        }
        const reqMessages = result.data.messages;
        const mockToolOverrides = result.data.mockTools;

        // fetch published workflow id
        const project = await projectsCollection.findOne({
            _id: projectId,
        });
        if (!project) {
            logger.log(`Project ${projectId} not found`);
            return Response.json({ error: "Project not found" }, { status: 404 });
        }

        // fetch workflow
        const workflow = project.liveWorkflow;
        if (!workflow) {
            logger.log(`Workflow not found for project ${projectId}`);
            return Response.json({ error: "Workflow not found" }, { status: 404 });
        }

        // override mock instructions
        if (mockToolOverrides) {
            workflow.mockTools = mockToolOverrides;
        }

        // check billing authorization
        if (USE_BILLING && billingCustomerId) {
            const agentModels = workflow.agents.reduce((acc, agent) => {
                acc.push(agent.model);
                return acc;
            }, [] as string[]);
            const response = await authorize(billingCustomerId, {
                type: 'agent_response',
                data: {
                    agentModels,
                },
            });
            if (!response.success) {
                return Response.json({ error: response.error || 'Billing error' }, { status: 402 });
            }
        }

        // get assistant response
        const { messages } = await getResponse(projectId, workflow, reqMessages);

        // log billing usage
        if (USE_BILLING && billingCustomerId) {
            const agentMessageCount = messages.filter(m => m.role === 'assistant').length;
            await logUsage(billingCustomerId, {
                type: 'agent_messages',
                amount: agentMessageCount,
            });
        }

        const responseBody: z.infer<typeof ApiResponse> = {
            messages,
        };
        return Response.json(responseBody);
    });
}
