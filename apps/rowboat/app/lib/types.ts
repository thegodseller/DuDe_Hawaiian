import { CoreMessage, ToolCallPart } from "ai";
import { z } from "zod";
import { apiV1 } from "rowboat-shared";

export const SimulationArticleData = z.object({
    articleUrl: z.string(),
    articleTitle: z.string().default('').optional(),
    articleContent: z.string().default('').optional(),
});

export const Scenario = z.object({
    projectId: z.string(),
    name: z.string().min(1, "Name cannot be empty"),
    description: z.string().min(1, "Description cannot be empty"),
    createdAt: z.string().datetime(),
    lastUpdatedAt: z.string().datetime(),
});

export const SimulationScenarioData = z.object({
    scenario: z.string(),
});

export const SimulationChatMessagesData = z.object({
    chatMessages: z.string(),
});

export const SimulationData = z.union([SimulationArticleData, SimulationScenarioData, SimulationChatMessagesData]);

export const PlaygroundChat = z.object({
    createdAt: z.string().datetime(),
    projectId: z.string(),
    title: z.string().optional(),
    messages: z.array(apiV1.ChatMessage),
    simulated: z.boolean().default(false).optional(),
    simulationData: SimulationData.optional(),
    simulationComplete: z.boolean().default(false).optional(),
    agenticState: z.unknown().optional(),
    systemMessage: z.string().optional(),
});

export const Webpage = z.object({
    _id: z.string(),
    title: z.string(),
    contentSimple: z.string(),
    lastUpdatedAt: z.string().datetime(),
});

export const ChatClientId = z.object({
    _id: z.string(),
    projectId: z.string(),
});

export const DataSource = z.object({
    name: z.string(),
    projectId: z.string(),
    active: z.boolean().default(true),
    status: z.union([
        z.literal('pending'),
        z.literal('ready'),
        z.literal('error'),
        z.literal('deleted'),
    ]),
    version: z.number(),
    error: z.string().optional(),
    createdAt: z.string().datetime(),
    lastUpdatedAt: z.string().datetime().optional(),
    attempts: z.number(),
    lastAttemptAt: z.string().datetime().optional(),
    pendingRefresh: z.boolean().default(false).optional(),
    data: z.discriminatedUnion('type', [
        z.object({
            type: z.literal('urls'),
        }),
        z.object({
            type: z.literal('files'),
        }),
    ]),
});

export const DataSourceDoc = z.object({
    sourceId: z.string(),
    name: z.string(),
    version: z.number(),
    status: z.union([
        z.literal('pending'),
        z.literal('ready'),
        z.literal('error'),
        z.literal('deleted'),
    ]),
    content: z.string().optional(),
    createdAt: z.string().datetime(),
    lastUpdatedAt: z.string().datetime().optional(),
    error: z.string().optional(),
    data: z.discriminatedUnion('type', [
        z.object({
            type: z.literal('url'),
            url: z.string(),
        }),
        z.object({
            type: z.literal('file'),
            name: z.string(),
            size: z.number(),
            mimeType: z.string(),
            s3Key: z.string(),
        }),
    ]),
})

export const EmbeddingDoc = z.object({
    content: z.string(),
    sourceId: z.string(),
    embeddings: z.array(z.number()),
    metadata: z.object({
        sourceURL: z.string(),
        title: z.string(),
        score: z.number().optional(),
    }),
});

export const Project = z.object({
    _id: z.string().uuid(),
    name: z.string(),
    createdAt: z.string().datetime(),
    lastUpdatedAt: z.string().datetime(),
    createdByUserId: z.string(),
    secret: z.string(),
    chatClientId: z.string(),
    webhookUrl: z.string().optional(),
    publishedWorkflowId: z.string().optional(),
    nextWorkflowNumber: z.number().optional(),
});

export const ProjectMember = z.object({
    userId: z.string(),
    projectId: z.string(),
    createdAt: z.string().datetime(),
    lastUpdatedAt: z.string().datetime(),
});

export const ApiKey = z.object({
    projectId: z.string(),
    key: z.string(),
    createdAt: z.string().datetime(),
    lastUsedAt: z.string().datetime().optional(),
});

export const GetInformationToolResultItem = z.object({
    title: z.string(),
    name: z.string(),
    content: z.string(),
    docId: z.string(),
    sourceId: z.string(),
});

export const GetInformationToolResult = z.object({
    results: z.array(GetInformationToolResultItem)
});

export const WebpageCrawlResponse = z.object({
    title: z.string(),
    content: z.string(),
});

export const AgenticAPIChatMessage = z.object({
    role: z.union([z.literal('user'), z.literal('assistant'), z.literal('tool'), z.literal('system')]),
    content: z.string().nullable(),
    tool_calls: z.array(z.object({
        id: z.string(),
        function: z.object({
            name: z.string(),
            arguments: z.string(),
        }),
        type: z.literal('function'),
    })).nullable(),
    tool_call_id: z.string().nullable(),
    tool_name: z.string().nullable(),
    sender: z.string().nullable(),
    response_type: z.union([
        z.literal('internal'),
        z.literal('external'),
    ]).optional(),
});

export const EmbeddingRecord = z.object({
    id: z.string().uuid(),
    vector: z.array(z.number()),
    payload: z.object({
        projectId: z.string(),
        sourceId: z.string(),
        docId: z.string(),
        content: z.string(),
        title: z.string(),
        name: z.string(),
    }),
});

export const WorkflowAgent = z.object({
    name: z.string(),
    type: z.union([
        z.literal('conversation'),
        z.literal('post_process'),
        z.literal('escalation'),
    ]),
    description: z.string(),
    disabled: z.boolean().default(false).optional(),
    instructions: z.string(),
    examples: z.string().optional(),
    prompts: z.array(z.string()),
    tools: z.array(z.string()),
    model: z.union([
        z.literal('gpt-4o'),
        z.literal('gpt-4o-mini'),
    ]),
    locked: z.boolean().default(false).describe('Whether this agent is locked and cannot be deleted').optional(),
    toggleAble: z.boolean().default(true).describe('Whether this agent can be enabled or disabled').optional(),
    global: z.boolean().default(false).describe('Whether this agent is a global agent, in which case it cannot be connected to other agents').optional(),
    ragDataSources: z.array(z.string()).optional(),
    ragReturnType: z.union([z.literal('chunks'), z.literal('content')]).default('chunks'),
    ragK: z.number().default(3),
    connectedAgents: z.array(z.string()),
    controlType: z.union([z.literal('retain'), z.literal('relinquish_to_parent'), z.literal('relinquish_to_start')]).default('retain').describe('Whether this agent retains control after a turn, relinquishes to the parent agent, or relinquishes to the start agent'),
});

export const WorkflowPrompt = z.object({
    name: z.string(),
    type: z.union([
        z.literal('base_prompt'),
        z.literal('style_prompt'),
    ]),
    prompt: z.string(),
});

export const WorkflowTool = z.object({
    name: z.string(),
    description: z.string(),
    mockInPlayground: z.boolean().default(false).optional(),
    autoSubmitMockedResponse: z.boolean().default(false).optional(),
    parameters: z.object({
        type: z.literal('object'),
        properties: z.record(z.object({
            type: z.string(),
            description: z.string(),
        })),
        required: z.array(z.string()).optional(),
    }),
});

export const AgenticAPIAgent = WorkflowAgent
    .omit({
        disabled: true,
        examples: true,
        prompts: true,
        locked: true,
        toggleAble: true,
        global: true,
        ragDataSources: true,
        ragReturnType: true,
        ragK: true,
    })
    .extend({
        hasRagSources: z.boolean().default(false).optional(),
    });

export const AgenticAPIPrompt = WorkflowPrompt;

export const AgenticAPITool = WorkflowTool.omit({
    mockInPlayground: true,
    autoSubmitMockedResponse: true,
});

export const Workflow = z.object({
    name: z.string().optional(),
    agents: z.array(WorkflowAgent),
    prompts: z.array(WorkflowPrompt),
    tools: z.array(WorkflowTool),
    startAgent: z.string(),
    createdAt: z.string().datetime(),
    lastUpdatedAt: z.string().datetime(),
    projectId: z.string(),
});

export const WorkflowTemplate = Workflow
    .omit({
        projectId: true,
        lastUpdatedAt: true,
        createdAt: true,
    })
    .extend({
        name: z.string(),
        description: z.string(),
    });

export type WithStringId<T> = T & { _id: string };

export const CopilotWorkflow = Workflow.omit({
    lastUpdatedAt: true,
    projectId: true,
});

export const AgenticAPIChatRequest = z.object({
    messages: z.array(AgenticAPIChatMessage),
    state: z.unknown(),
    agents: z.array(AgenticAPIAgent),
    tools: z.array(AgenticAPITool),
    prompts: z.array(WorkflowPrompt),
    startAgent: z.string(),
});

export const AgenticAPIChatResponse = z.object({
    messages: z.array(AgenticAPIChatMessage),
    state: z.unknown(),
});

export const CopilotUserMessage = z.object({
    role: z.literal('user'),
    content: z.string(),
});

export const CopilotAssistantMessageTextPart = z.object({
    type: z.literal("text"),
    content: z.string(),
});

export const CopilotAssistantMessageActionPart = z.object({
    type: z.literal("action"),
    content: z.object({
        config_type: z.union([z.literal('tool'), z.literal('agent'), z.literal('prompt')]),
        action: z.union([z.literal('create_new'), z.literal('edit')]),
        name: z.string(),
        change_description: z.string(),
        config_changes: z.record(z.string(), z.unknown()),
        error: z.string().optional(),
    })
});

export const CopilotAssistantMessage = z.object({
    role: z.literal('assistant'),
    content: z.object({
        thoughts: z.string().optional(),
        response: z.array(z.union([CopilotAssistantMessageTextPart, CopilotAssistantMessageActionPart])),
    }),
});

export const CopilotMessage = z.union([CopilotUserMessage, CopilotAssistantMessage]);

export const CopilotApiMessage = z.object({
    role: z.union([z.literal('assistant'), z.literal('user')]),
    content: z.string(),
});

export const CopilotChatContext = z.union([
    z.object({
        type: z.literal('chat'),
        messages: z.array(apiV1.ChatMessage),
    }),
    z.object({
        type: z.literal('agent'),
        name: z.string(),
    }),
    z.object({
        type: z.literal('tool'),
        name: z.string(),
    }),
    z.object({
        type: z.literal('prompt'),
        name: z.string(),
    }),
]);

export const CopilotApiChatContext = z.union([
    z.object({
        type: z.literal('chat'),
        messages: z.array(AgenticAPIChatMessage),
    }),
    z.object({
        type: z.literal('agent'),
        agentName: z.string(),
    }),
    z.object({
        type: z.literal('tool'),
        toolName: z.string(),
    }),
    z.object({
        type: z.literal('prompt'),
        promptName: z.string(),
    }),
]);

export const CopilotAPIRequest = z.object({
    messages: z.array(CopilotApiMessage),
    workflow_schema: z.string(),
    current_workflow_config: z.string(),
    context: CopilotApiChatContext.nullable(),
});

export const CopilotAPIResponse = z.union([
    z.object({
        response: z.string(),
    }),
    z.object({
        error: z.string(),
    }),
]);

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

export function convertToCopilotApiChatContext(context: z.infer<typeof CopilotChatContext>): z.infer<typeof CopilotApiChatContext> {
    switch (context.type) {
        case 'chat':
            return {
                type: 'chat',
                messages: convertToAgenticAPIChatMessages(context.messages),
            };
        case 'agent':
            return {
                type: 'agent',
                agentName: context.name,
            };
        case 'tool':
            return {
                type: 'tool',
                toolName: context.name,
            };
        case 'prompt':
            return {
                type: 'prompt',
                promptName: context.name,
            };
    }
}

export function convertToCopilotApiMessage(message: z.infer<typeof CopilotMessage>): z.infer<typeof CopilotApiMessage> {
    return {
        role: message.role,
        content: JSON.stringify(message.content),
    };
}

export function convertToCopilotMessage(message: z.infer<typeof CopilotApiMessage>): z.infer<typeof CopilotMessage> {
    switch (message.role) {
        case 'assistant':
            return CopilotAssistantMessage.parse({
                role: 'assistant',
                content: JSON.parse(message.content),
            });
        case 'user':
            return {
                role: 'user',
                content: message.content,
            };
        default:
            throw new Error(`Unknown role: ${message.role}`);
    }
}

export function convertWorkflowToAgenticAPI(workflow: z.infer<typeof Workflow>): {
    agents: z.infer<typeof AgenticAPIAgent>[],
    tools: z.infer<typeof AgenticAPITool>[],
    prompts: z.infer<typeof AgenticAPIPrompt>[],
    startAgent: string,
} {
    return {
        agents: workflow.agents
            .filter(agent => !agent.disabled)
            .map(agent => ({
                name: agent.name,
                type: agent.type,
                description: agent.description,
                instructions: agent.instructions +
                    '\n\n' + agent.prompts.map(prompt =>
                        workflow.prompts.find(p => p.name === prompt)?.prompt
                    ).join('\n\n') +
                    (agent.examples ? '\n\n# Examples\n' + agent.examples : ''),
                tools: agent.tools,
                model: agent.model,
                hasRagSources: agent.ragDataSources ? agent.ragDataSources.length > 0 : false,
                connectedAgents: agent.connectedAgents,
                controlType: agent.controlType,
            })),
        tools: workflow.tools.map(tool => {
            const { mockInPlayground, autoSubmitMockedResponse, ...rest } = tool;
            return {
                ...rest,
            };
        }),
        prompts: workflow.prompts,
        startAgent: workflow.startAgent,
    };
}

export function convertToCoreMessages(messages: z.infer<typeof apiV1.ChatMessage>[]): CoreMessage[] {
    // convert to core messages
    const coreMessages: CoreMessage[] = [];
    for (const m of messages) {
        switch (m.role) {
            case 'system':
                coreMessages.push({
                    role: 'system',
                    content: m.content,
                });
                break;
            case 'user':
                coreMessages.push({
                    role: 'user',
                    content: m.content,
                });
                break;
            case 'assistant':
                if ('tool_calls' in m) {
                    const toolCallParts: ToolCallPart[] = m.tool_calls.map((toolCall) => ({
                        type: 'tool-call',
                        toolCallId: toolCall.id,
                        toolName: toolCall.function.name,
                        args: JSON.parse(toolCall.function.arguments),
                    }));
                    if (m.content) {
                        coreMessages.push({
                            role: 'assistant',
                            content: [
                                {
                                    type: 'text',
                                    text: m.content,
                                },
                                ...toolCallParts,
                            ]
                        });
                    } else {
                        coreMessages.push({
                            role: 'assistant',
                            content: toolCallParts,
                        });
                    }
                } else {
                    coreMessages.push({
                        role: 'assistant',
                        content: m.content,
                    });
                }
                break;
            case 'tool':
                coreMessages.push({
                    role: 'tool',
                    content: [
                        {
                            type: 'tool-result',
                            toolCallId: m.tool_call_id,
                            toolName: m.tool_name,
                            result: JSON.parse(m.content),
                        }
                    ]
                });
                break;
        }
    }
    return coreMessages;
}

export function convertToAgenticAPIChatMessages(messages: z.infer<typeof apiV1.ChatMessage>[]): z.infer<typeof AgenticAPIChatMessage>[] {
    const converted: z.infer<typeof AgenticAPIChatMessage>[] = [];

    for (const m of messages) {
        const baseMessage: z.infer<typeof AgenticAPIChatMessage> = {
            content: null,
            role: m.role,
            sender: null,
            tool_calls: null,
            tool_call_id: null,
            tool_name: null,
        };

        switch (m.role) {
            case 'system':
                converted.push({
                    ...baseMessage,
                    content: m.content,
                });
                break;
            case 'user':
                converted.push({
                    ...baseMessage,
                    content: m.content,
                });
                break;
            case 'assistant':
                if ('tool_calls' in m) {
                    converted.push({
                        ...baseMessage,
                        tool_calls: m.tool_calls,
                        sender: m.agenticSender ?? null,
                        response_type: m.agenticResponseType,
                    });
                } else {
                    converted.push({
                        ...baseMessage,
                        content: m.content,
                        sender: m.agenticSender ?? null,
                        response_type: m.agenticResponseType,
                    });
                }
                break;
            case 'tool':
                converted.push({
                    ...baseMessage,
                    content: m.content,
                    tool_call_id: m.tool_call_id,
                    tool_name: m.tool_name,
                });
                break;
            default:
                continue;
        }
    }

    return converted;
}

export function convertFromAgenticAPIChatMessages(messages: z.infer<typeof AgenticAPIChatMessage>[]): z.infer<typeof apiV1.ChatMessage>[] {
    const converted: z.infer<typeof apiV1.ChatMessage>[] = [];

    for (const m of messages) {
        const baseMessage = {
            version: 'v1' as const,
            chatId: '',
            createdAt: new Date().toISOString(),
        };
        switch (m.role) {
            case 'user':
                converted.push({
                    ...baseMessage,
                    role: 'user',
                    content: m.content ?? '',
                });
                break;
            case 'assistant':
                if (m.tool_calls) {
                    // TODO: handle tool calls
                    converted.push({
                        ...baseMessage,
                        role: 'assistant',
                        tool_calls: m.tool_calls,
                        agenticSender: m.sender ?? undefined,
                        agenticResponseType: m.response_type ?? 'internal',
                    });
                } else {
                    converted.push({
                        ...baseMessage,
                        role: 'assistant',
                        content: m.content ?? '',
                        agenticSender: m.sender ?? undefined,
                        agenticResponseType: m.response_type ?? 'internal',
                    });
                }
                break;
            case 'tool':
                converted.push({
                    ...baseMessage,
                    role: 'tool',
                    content: m.content ?? '',
                    tool_call_id: m.tool_call_id ?? '',
                    tool_name: m.tool_name ?? '',
                });
                break;
        }
    }
    return converted;
}

export function convertToCopilotWorkflow(workflow: z.infer<typeof Workflow>): z.infer<typeof CopilotWorkflow> {
    const { lastUpdatedAt, projectId, ...rest } = workflow;
    return {
        ...rest,
    };
}

export const ApiMessage = z.union([
    apiV1.SystemMessage,
    apiV1.UserMessage,
    apiV1.AssistantMessage,
    apiV1.AssistantMessageWithToolCalls,
    apiV1.ToolMessage,
]);

export const ApiRequest = z.object({
    messages: z.array(ApiMessage),
    state: z.unknown(),
});

export const ApiResponse = z.object({
    messages: z.array(ApiMessage),
    state: z.unknown(),
});

export function convertFromApiToAgenticApiMessages(messages: z.infer<typeof ApiMessage>[]): z.infer<typeof AgenticAPIChatMessage>[] {
    return messages.map(m => {
        switch (m.role) {
            case 'system':
                return {
                    role: 'system',
                    content: m.content,
                    tool_calls: null,
                    tool_call_id: null,
                    tool_name: null,
                    sender: null,
                };
            case 'user':
                return {
                    role: 'user',
                    content: m.content,
                    tool_calls: null,
                    tool_call_id: null,
                    tool_name: null,
                    sender: null,
                };

            case 'assistant':
                if ('tool_calls' in m) {
                    return {
                        role: 'assistant',
                        content: m.content ?? null,
                        tool_calls: m.tool_calls,
                        tool_call_id: null,
                        tool_name: null,
                        sender: m.agenticSender ?? null,
                        response_type: m.agenticResponseType ?? 'external',
                    };
                } else {
                    return {
                        role: 'assistant',
                        content: m.content ?? null,
                        sender: m.agenticSender ?? null,
                        response_type: m.agenticResponseType ?? 'external',
                        tool_call_id: null,
                        tool_calls: null,
                        tool_name: null,
                    };
                }
            case 'tool':
                return {
                    role: 'tool',
                    content: m.content ?? null,
                    tool_calls: null,
                    tool_call_id: m.tool_call_id ?? null,
                    tool_name: m.tool_name ?? null,
                    sender: null,
                };
            default:
                return {
                    role: "user",
                    content: "foo",
                    tool_calls: null,
                    tool_call_id: null,
                    tool_name: null,
                    sender: null,
                }
        }
    });
}

export function convertFromAgenticApiToApiMessages(messages: z.infer<typeof AgenticAPIChatMessage>[]): z.infer<typeof ApiMessage>[] {
    const converted: z.infer<typeof ApiMessage>[] = [];

    for (const m of messages) {
        switch (m.role) {
            case 'user':
                converted.push({
                    role: 'user',
                    content: m.content ?? '',
                });
                break;
            case 'assistant':
                if (m.tool_calls) {
                    converted.push({
                        role: 'assistant',
                        tool_calls: m.tool_calls,
                        agenticSender: m.sender ?? undefined,
                        agenticResponseType: m.response_type ?? 'internal',
                    });
                } else {
                    converted.push({
                        role: 'assistant',
                        content: m.content ?? '',
                        agenticSender: m.sender ?? undefined,
                        agenticResponseType: m.response_type ?? 'internal',
                    });
                }
                break;
            case 'tool':
                converted.push({
                    role: 'tool',
                    content: m.content ?? '',
                    tool_call_id: m.tool_call_id ?? '',
                    tool_name: m.tool_name ?? '',
                });
                break;
        }
    }
    return converted;
}