import { z } from "zod";
import { apiV1 } from "rowboat-shared"

export const GetInformationToolResultItem = z.object({
    title: z.string(),
    name: z.string(),
    content: z.string(),
    docId: z.string(),
    sourceId: z.string(),
});export const GetInformationToolResult = z.object({
    results: z.array(GetInformationToolResultItem)
});
export const WebpageCrawlResponse = z.object({
    title: z.string(),
    content: z.string(),
});
export const ClientToolCallRequestBody = z.object({
    toolCall: apiV1.AssistantMessageWithToolCalls.shape.tool_calls.element,
});
export const ClientToolCallJwt = z.object({
    requestId: z.string().uuid(),
    projectId: z.string(),
    bodyHash: z.string(),
    iat: z.number(),
    exp: z.number(),
});
export const ClientToolCallRequest = z.object({
    requestId: z.string().uuid(),
    content: z.string(), // json stringified ClientToolCallRequestBody
});
export const ClientToolCallResponse = z.unknown();

