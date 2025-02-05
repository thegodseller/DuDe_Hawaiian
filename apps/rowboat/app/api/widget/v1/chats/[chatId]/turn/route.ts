import { NextRequest } from "next/server";
import { apiV1 } from "rowboat-shared";
import { agentWorkflowsCollection, db, projectsCollection } from "@/app/lib/mongodb";
import { z } from "zod";
import { ObjectId, WithId } from "mongodb";
import { authCheck } from "../../../utils";
import { AgenticAPIChatRequest, convertFromAgenticAPIChatMessages, convertToAgenticAPIChatMessages, convertWorkflowToAgenticAPI } from "@/app/lib/types";
import { callClientToolWebhook, getAgenticApiResponse } from "@/app/lib/utils";
import { check_query_limit } from "@/app/lib/rate_limiting";

const chatsCollection = db.collection<z.infer<typeof apiV1.Chat>>("chats");
const chatMessagesCollection = db.collection<z.infer<typeof apiV1.ChatMessage>>("chatMessages");

// get next turn / agent response
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
): Promise<Response> {
    return await authCheck(req, async (session) => {
        const { chatId } = await params;

        // check query limit
        if (!await check_query_limit(session.projectId)) {
            return Response.json({ error: "Query limit exceeded" }, { status: 429 });
        }

        // parse and validate the request body
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
        }
        const result = apiV1.ApiChatTurnRequest.safeParse(body);
        if (!result.success) {
            return Response.json({ error: `Invalid request body: ${result.error.message}` }, { status: 400 });
        }
        const userMessage: z.infer<typeof apiV1.ChatMessage> = {
            version: 'v1',
            createdAt: new Date().toISOString(),
            chatId,
            role: 'user',
            content: result.data.message,
        };

        // ensure chat exists
        const chat = await chatsCollection.findOne({
            projectId: session.projectId,
            userId: session.userId,
            _id: new ObjectId(chatId)
        });
        if (!chat) {
            return Response.json({ error: "Chat not found" }, { status: 404 });
        }

        // prepare system message which will contain user data
        const systemMessage: z.infer<typeof apiV1.ChatMessage> = {
            version: 'v1',
            createdAt: new Date().toISOString(),
            chatId,
            role: 'system',
            content: `The following user data is available to you: ${JSON.stringify(chat.userData)}`,
        };

        // fetch existing chat messages
        const messages = await chatMessagesCollection.find({ chatId: chatId }).toArray();

        // fetch project settings
        const projectSettings = await projectsCollection.findOne({
            "_id": session.projectId,
        });
        if (!projectSettings) {
            throw new Error("Project settings not found");
        }

        // fetch workflow
        const workflow = await agentWorkflowsCollection.findOne({
            projectId: session.projectId,
            _id: new ObjectId(projectSettings.publishedWorkflowId),
        });
        if (!workflow) {
            throw new Error("Workflow not found");
        }

        // get assistant response
        const { agents, tools, prompts, startAgent } = convertWorkflowToAgenticAPI(workflow);
        const unsavedMessages: z.infer<typeof apiV1.ChatMessage>[] = [userMessage];
        let resolvingToolCalls = true;
        let state: unknown = chat.agenticState ?? {last_agent_name: startAgent};
        while (resolvingToolCalls) {
            const request: z.infer<typeof AgenticAPIChatRequest> = {
                messages: convertToAgenticAPIChatMessages([systemMessage, ...messages, ...unsavedMessages]),
                state,
                agents,
                tools,
                prompts,
                startAgent,
            };
            console.log("turn: sending agentic request", JSON.stringify(request, null, 2));
            const response = await getAgenticApiResponse(request);
            state = response.state;
            if (response.messages.length === 0) {
                throw new Error("No messages returned from assistant");
            }
            const convertedMessages = convertFromAgenticAPIChatMessages(response.messages);
            unsavedMessages.push(...convertedMessages.map(m => ({
                ...m,
                version: 'v1' as const,
                chatId,
                createdAt: new Date().toISOString(),
            })));

            // if the last messages is tool call, execute them
            const lastMessage = convertedMessages[convertedMessages.length - 1];
            if (lastMessage.role === 'assistant' && 'tool_calls' in lastMessage) {
                // execute tool calls
                console.log("Executing tool calls", lastMessage.tool_calls);
                const toolCallResults = await Promise.all(lastMessage.tool_calls.map(async toolCall => {
                    console.log('executing tool call', toolCall);
                    try {
                        return await callClientToolWebhook(
                            toolCall,
                            [...messages, ...unsavedMessages],
                            session.projectId,
                        );
                    } catch (error) {
                        console.error(`Error executing tool call ${toolCall.id}:`, error);
                        return { error: "Tool execution failed" };
                    }
                }));
                unsavedMessages.push(...toolCallResults.map((result, index) => ({
                    version: 'v1' as const,
                    chatId,
                    createdAt: new Date().toISOString(),
                    role: 'tool' as const,
                    tool_call_id: lastMessage.tool_calls[index].id,
                    tool_name: lastMessage.tool_calls[index].function.name,
                    content: JSON.stringify(result),
                })));
            } else {
                // ensure that the last message is from an assistant
                // and is of an external type
                if (lastMessage.role !== 'assistant' || lastMessage.agenticResponseType !== 'external') {
                    throw new Error("Last message is not from an assistant and is not of an external type");
                }
                resolvingToolCalls = false;
                break;
            }
        }

        // save unsaved messages and update chat state
        await chatMessagesCollection.insertMany(unsavedMessages);
        await chatsCollection.updateOne({ _id: new ObjectId(chatId) }, { $set: { agenticState: state } });

        // send back the last message
        const lastMessage = unsavedMessages[unsavedMessages.length - 1] as WithId<z.infer<typeof apiV1.ChatMessage>>;
        return Response.json({
            ...lastMessage,
            id: lastMessage._id.toString(),
            _id: undefined,
        });
    });
}
