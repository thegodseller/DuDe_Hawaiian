import { AgenticAPIChatMessage, AgenticAPIChatRequest, AgenticAPIChatResponse, ClientToolCallJwt, ClientToolCallRequest, ClientToolCallRequestBody, convertFromAgenticAPIChatMessages, Workflow } from "../lib/types";
import { z } from "zod";
import { projectsCollection } from "./mongodb";
import { apiV1 } from "rowboat-shared";
import { SignJWT } from "jose";
import crypto from "crypto";

export async function callClientToolWebhook(
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number],
    messages: z.infer<typeof apiV1.ChatMessage>[],
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
        messages,
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
    const response = await fetch(process.env.AGENTS_API_URL + '/chat', {
        method: 'POST',
        body: JSON.stringify(request),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.AGENTS_API_KEY || 'test'}`,
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