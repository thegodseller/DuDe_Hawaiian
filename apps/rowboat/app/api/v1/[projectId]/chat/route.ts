import { NextRequest } from "next/server";
import { agentWorkflowsCollection, db, projectsCollection } from "@/app/lib/mongodb";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { authCheck } from "@/app/api/v1/utils";
import { convertFromApiToAgenticApiMessages, convertFromAgenticApiToApiMessages, AgenticAPIChatRequest, ApiRequest, ApiResponse, convertWorkflowToAgenticAPI } from "@/app/lib/types";
import { getAgenticApiResponse } from "@/app/lib/utils";

// get next turn / agent response
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
): Promise<Response> {
    const { projectId } = await params;

    return await authCheck(projectId, req, async () => {
        // parse and validate the request body
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
        }
        const result = ApiRequest.safeParse(body);
        if (!result.success) {
            return Response.json({ error: `Invalid request body: ${result.error.message}` }, { status: 400 });
        }
        const reqMessages = result.data.messages;
        const reqState = result.data.state;

        // fetch published workflow id
        const project = await projectsCollection.findOne({
            _id: projectId,
        });
        if (!project) {
            return Response.json({ error: "Project not found" }, { status: 404 });
        }
        if (!project.publishedWorkflowId) {
            return Response.json({ error: "Project has no published workflow" }, { status: 404 });
        }
        // fetch workflow
        const workflow = await agentWorkflowsCollection.findOne({
            projectId: projectId,
            _id: new ObjectId(project.publishedWorkflowId),
        });
        if (!workflow) {
            return Response.json({ error: "Workflow not found" }, { status: 404 });
        }

        // get assistant response
        const { agents, tools, prompts, startAgent } = convertWorkflowToAgenticAPI(workflow);
        const request: z.infer<typeof AgenticAPIChatRequest> = {
            messages: convertFromApiToAgenticApiMessages(reqMessages),
            state: reqState ?? { last_agent_name: startAgent },
            agents,
            tools,
            prompts,
            startAgent,
        };
        console.log("turn: sending agentic request from /chat api", JSON.stringify(request, null, 2));
        const { messages, state } = await getAgenticApiResponse(request);

        const response: z.infer<typeof ApiResponse> = {
            messages: convertFromAgenticApiToApiMessages(messages),
            state,
        };

        return Response.json(response);
    });
}
