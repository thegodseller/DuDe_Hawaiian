import { AgenticAPIChatMessage, AgenticAPIChatRequest, AgenticAPIChatResponse, ClientToolCallJwt, ClientToolCallRequest, ClientToolCallRequestBody, convertFromAgenticAPIChatMessages, Workflow } from "@/app/lib/types";
import { z } from "zod";
import { projectsCollection } from "./mongodb";
import { apiV1 } from "rowboat-shared";
import { SignJWT } from "jose";
import crypto from "crypto";

export const baseWorkflow: z.infer<typeof Workflow> = {
    projectId: "",
    createdAt: "",
    lastUpdatedAt: "",
    startAgent: "Example Agent",
    agents: [
        {
            name: "Example Agent",
            type: "conversation",
            description: "An example agent",
            instructions: `## 🧑‍ Role:
You are an helpful customer support assistant

---
## ⚙️ Steps to Follow:
1. Ask the user what they would like help with
2. Ask the user for their email address and let them know someone will contact them soon.

---
## 🎯 Scope:
✅ In Scope:
- Asking the user their issue
- Getting their email

❌ Out of Scope:
- Questions unrelated to customer support
- If a question is out of scope, politely inform the user and avoid providing an answer.

---
## 📋 Guidelines:
✔️ Dos:
- ask user their issue

❌ Don'ts:
- don't ask user any other detail than email`,
            prompts: [],
            tools: [],
            model: "gpt-4o-mini",
            toggleAble: true,
            ragReturnType: "chunks",
            ragK: 3,
            connectedAgents: [],
            controlType: "retain",
        },
        {
            name: "Post process",
            type: "post_process",
            description: "",
            instructions: "Ensure that the agent response is terse and to the point.",
            prompts: [],
            tools: [],
            model: "gpt-4o-mini",
            locked: true,
            global: true,
            ragReturnType: "chunks",
            ragK: 3,
            connectedAgents: [],
            controlType: "retain",
        },
        {
            name: "Escalation",
            type: "escalation",
            description: "",
            instructions: "Get the user's contact information and let them know that their request has been escalated.",
            prompts: [],
            tools: [],
            model: "gpt-4o-mini",
            locked: true,
            toggleAble: false,
            ragReturnType: "chunks",
            ragK: 3,
            connectedAgents: [],
            controlType: "retain",
        },
    ],
    prompts: [
        {
            name: "Style prompt",
            type: "style_prompt",
            prompt: "You should be empathetic and helpful.",
        },
    ],
    tools: [],
};

export async function callClientToolWebhook(
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number],
    projectId: string,
): Promise<unknown> {
    const project = await projectsCollection.findOne({
        "_id": projectId,
    });
    if (!project) {
        throw new Error('Project not found');
    }

    if (!project.webhookUrl) {
        throw new Error('Webhook URL not found');
    }

    // prepare request body
    const content = JSON.stringify({
        toolCall,
    } as z.infer<typeof ClientToolCallRequestBody>);
    const requestId = crypto.randomUUID();
    const bodyHash = crypto
        .createHash('sha256')
        .update(content, 'utf8')
        .digest('hex');

    // sign request
    const jwt = await new SignJWT({
        requestId,
        projectId,
        bodyHash,
    } as z.infer<typeof ClientToolCallJwt>)
        .setProtectedHeader({
            alg: 'HS256',
            typ: 'JWT',
        })
        .setIssuer('rowboat')
        .setAudience(project.webhookUrl)
        .setSubject(`tool-call-${toolCall.id}`)
        .setJti(requestId)
        .setIssuedAt()
        .setExpirationTime("5 minutes")
        .sign(new TextEncoder().encode(project.secret));

    // make request
    const request: z.infer<typeof ClientToolCallRequest> = {
        requestId,
        content,
    };
    const response = await fetch(project.webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-signature-jwt': jwt,
        },
        body: JSON.stringify(request),
    });
    if (!response.ok) {
        throw new Error(`Failed to call webhook: ${response.status}: ${response.statusText}`);
    }
    const responseBody = await response.json();
    return responseBody;
}

export async function getAgenticApiResponse(
    request: z.infer<typeof AgenticAPIChatRequest>,
): Promise<{
    messages: z.infer<typeof AgenticAPIChatMessage>[],
    state: unknown,
    rawAPIResponse: unknown,
}> {
    // call agentic api
    console.log(`agentic request`, JSON.stringify(request, null, 2));
    const response = await fetch(process.env.AGENTIC_API_URL + '/chat', {
        method: 'POST',
        body: JSON.stringify(request),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        console.error('Failed to call agentic api', response);
        throw new Error(`Failed to call agentic api: ${response.statusText}`);
    }
    const responseJson = await response.json();
    const result: z.infer<typeof AgenticAPIChatResponse> = responseJson;
    return {
        messages: result.messages,
        state: result.state,
        rawAPIResponse: result,
    };
}