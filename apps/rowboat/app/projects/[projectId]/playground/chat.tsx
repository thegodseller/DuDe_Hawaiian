'use client';
import { getAssistantResponseStreamId } from "../../../actions/actions";
import { useEffect, useOptimistic, useState } from "react";
import { Messages } from "./messages";
import z from "zod";
import { MCPServer, PlaygroundChat } from "../../../lib/types/types";
import { AgenticAPIChatMessage, convertFromAgenticAPIChatMessages, convertToAgenticAPIChatMessages } from "../../../lib/types/agents_api_types";
import { convertWorkflowToAgenticAPI } from "../../../lib/types/agents_api_types";
import { AgenticAPIChatRequest } from "../../../lib/types/agents_api_types";
import { Workflow } from "../../../lib/types/workflow_types";
import { ComposeBox } from "./compose-box";
import { Button, Spinner, Tooltip } from "@heroui/react";
import { apiV1 } from "rowboat-shared";
import { CopyAsJsonButton } from "./copy-as-json-button";
import { TestProfile } from "@/app/lib/types/testing_types";
import { ProfileSelector } from "@/app/projects/[projectId]/test/[[...slug]]/components/selectors/profile-selector";
import { WithStringId } from "@/app/lib/types/types";
import { XIcon } from "lucide-react";

export function Chat({
    chat,
    projectId,
    workflow,
    messageSubscriber,
    testProfile = null,
    onTestProfileChange,
    systemMessage,
    onSystemMessageChange,
    mcpServerUrls,
    toolWebhookUrl,
}: {
    chat: z.infer<typeof PlaygroundChat>;
    projectId: string;
    workflow: z.infer<typeof Workflow>;
    messageSubscriber?: (messages: z.infer<typeof apiV1.ChatMessage>[]) => void;
    testProfile?: z.infer<typeof TestProfile> | null;
    onTestProfileChange: (profile: WithStringId<z.infer<typeof TestProfile>> | null) => void;
    systemMessage: string;
    onSystemMessageChange: (message: string) => void;
    mcpServerUrls: Array<z.infer<typeof MCPServer>>;
    toolWebhookUrl: string;
}) {
    const [messages, setMessages] = useState<z.infer<typeof apiV1.ChatMessage>[]>(chat.messages);
    const [loadingAssistantResponse, setLoadingAssistantResponse] = useState<boolean>(false);
    const [agenticState, setAgenticState] = useState<unknown>(chat.agenticState || {
        last_agent_name: workflow.startAgent,
    });
    const [fetchResponseError, setFetchResponseError] = useState<string | null>(null);
    const [lastAgenticRequest, setLastAgenticRequest] = useState<unknown | null>(null);
    const [lastAgenticResponse, setLastAgenticResponse] = useState<unknown | null>(null);
    const [isProfileSelectorOpen, setIsProfileSelectorOpen] = useState(false);
    const [optimisticMessages, setOptimisticMessages] = useState<z.infer<typeof apiV1.ChatMessage>[]>(chat.messages);

    // reset optimistic messages when messages change
    useEffect(() => {
        setOptimisticMessages(messages);
    }, [messages]);

    // collect published tool call results
    const toolCallResults: Record<string, z.infer<typeof apiV1.ToolMessage>> = {};
    messages
        .filter((message) => message.role == 'tool')
        .forEach((message) => {
            toolCallResults[message.tool_call_id] = message;
        });
    console.log('toolCallResults', toolCallResults);

    function handleUserMessage(prompt: string) {
        const updatedMessages: z.infer<typeof apiV1.ChatMessage>[] = [...messages, {
            role: 'user',
            content: prompt,
            version: 'v1',
            chatId: '',
            createdAt: new Date().toISOString(),
        }];
        setMessages(updatedMessages);
        setFetchResponseError(null);
    }

    // reset state when workflow changes
    useEffect(() => {
        setMessages([]);
        setAgenticState({
            last_agent_name: workflow.startAgent,
        });
    }, [workflow]);

    // publish messages to subscriber
    useEffect(() => {
        if (messageSubscriber) {
            messageSubscriber(messages);
        }
    }, [messages, messageSubscriber]);

    // get assistant response
    useEffect(() => {
        console.log('stream useEffect called');
        let ignore = false;
        let eventSource: EventSource | null = null;
        let msgs: z.infer<typeof apiV1.ChatMessage>[] = [];

        async function process() {
            setLoadingAssistantResponse(true);
            setFetchResponseError(null);
            const { agents, tools, prompts, startAgent } = convertWorkflowToAgenticAPI(workflow);
            const request: z.infer<typeof AgenticAPIChatRequest> = {
                projectId,
                messages: convertToAgenticAPIChatMessages([{
                    role: 'system',
                    content: systemMessage || '',
                    version: 'v1' as const,
                    chatId: '',
                    createdAt: new Date().toISOString(),
                }, ...messages]),
                state: agenticState,
                agents,
                tools,
                prompts,
                startAgent,
                mcpServers: mcpServerUrls,
                toolWebhookUrl: toolWebhookUrl,
                testProfile: testProfile ?? undefined,
            };
            setLastAgenticRequest(null);
            setLastAgenticResponse(null);

            let streamId: string | null = null;
            try {
                const response = await getAssistantResponseStreamId(request);
                if (ignore) {
                    return;
                }
                streamId = response.streamId;
            } catch (err) {
                if (!ignore) {
                    setFetchResponseError(`Failed to get assistant response: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    setLoadingAssistantResponse(false);
                }
            }

            if (ignore || !streamId) {
                console.log('almost there', ignore, streamId);
                return;
            }

            // log the stream id
            console.log('🔄 got assistant response', streamId);

            // read from SSE stream
            eventSource = new EventSource(`/api/v1/stream-response/${streamId}`);

            eventSource.addEventListener("message", (event) => {
                if (ignore) {
                    return;
                }

                try {
                    const data = JSON.parse(event.data);
                    const msg = AgenticAPIChatMessage.parse(data);
                    const parsedMsg = convertFromAgenticAPIChatMessages([msg])[0];
                    console.log('🔄 got assistant response chunk', parsedMsg);
                    msgs.push(parsedMsg);
                    setOptimisticMessages(prev => [...prev, parsedMsg]);
                } catch (err) {
                    console.error('Failed to parse SSE message:', err);
                    setFetchResponseError(`Failed to parse SSE message: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    setOptimisticMessages(messages);
                }
            });

            eventSource.addEventListener('done', (event) => {
                if (eventSource) {
                    eventSource.close();
                }

                console.log('🔄 got assistant response done', event.data);
                const parsed: {state: unknown} = JSON.parse(event.data);
                setAgenticState(parsed.state);
                setMessages([...messages, ...msgs]);
                setLoadingAssistantResponse(false);
            });

            eventSource.onerror = (error) => {
                console.error('SSE Error:', error);
                if (!ignore) {
                    setLoadingAssistantResponse(false);
                    setFetchResponseError('Stream connection failed');
                    setOptimisticMessages(messages);
                }
            };
        }

        // if last message is not a user message, return
        if (messages.length > 0) {
            const last = messages[messages.length - 1];
            if (last.role !== 'user') {
                return;
            }
        }

        // if there is an error, return
        if (fetchResponseError) {
            return;
        }

        process();

        return () => {
            ignore = true;
            console.log('stream useEffect cleanup called');
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [
        messages,
        projectId,
        agenticState,
        workflow,
        systemMessage,
        mcpServerUrls,
        toolWebhookUrl,
        testProfile,
        fetchResponseError,
    ]);

    const handleCopyChat = () => {
        const jsonString = JSON.stringify({
            messages: [{
                role: 'system',
                content: systemMessage,
            }, ...messages],
            lastRequest: lastAgenticRequest,
            lastResponse: lastAgenticResponse,
        }, null, 2);
        navigator.clipboard.writeText(jsonString);
    }

    return <div className="relative h-full flex flex-col gap-8 pt-8 overflow-auto">
        <CopyAsJsonButton onCopy={handleCopyChat} />
        <div className="absolute top-0 left-0 flex items-center gap-1">
            <Tooltip content={"Change profile"} placement="right">
                <button
                    className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setIsProfileSelectorOpen(true)}
                >
                    {`${testProfile?.name || 'Select test profile'}`}
                </button>
            </Tooltip>
            {testProfile && <Tooltip content={"Remove profile"} placement="right">
                <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300" onClick={() => onTestProfileChange(null)}>
                    <XIcon className="w-4 h-4" />
                </button>
            </Tooltip>}
        </div>
        <ProfileSelector
            projectId={projectId}
            isOpen={isProfileSelectorOpen}
            onOpenChange={setIsProfileSelectorOpen}
            onSelect={onTestProfileChange}
        />
        <Messages
            projectId={projectId}
            messages={optimisticMessages}
            toolCallResults={toolCallResults}
            loadingAssistantResponse={loadingAssistantResponse}
            workflow={workflow}
            testProfile={testProfile}
            systemMessage={systemMessage}
            onSystemMessageChange={onSystemMessageChange}
        />
        <div className="shrink-0">
            {fetchResponseError && (
                <div className="max-w-[768px] mx-auto mb-4 p-2 bg-red-50 border border-red-200 rounded-lg flex gap-2 justify-between items-center">
                    <p className="text-red-600">{fetchResponseError}</p>
                    <Button
                        size="sm"
                        color="danger"
                        onPress={() => {
                            setFetchResponseError(null);
                        }}
                    >
                        Retry
                    </Button>
                </div>
            )}
            <div className="max-w-[768px] mx-auto">
                <ComposeBox
                    handleUserMessage={handleUserMessage}
                    messages={messages}
                />
            </div>
        </div>
    </div>;
}