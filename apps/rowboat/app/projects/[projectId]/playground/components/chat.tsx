'use client';
import { useEffect, useRef, useState, useCallback } from "react";
import { getAssistantResponseStreamId } from "@/app/actions/actions";
import { Messages } from "./messages";
import z from "zod";
import { MCPServer, Message, PlaygroundChat, ToolMessage } from "@/app/lib/types/types";
import { Workflow, WorkflowTool } from "@/app/lib/types/workflow_types";
import { ComposeBoxPlayground } from "@/components/common/compose-box-playground";
import { Button } from "@heroui/react";
import { WithStringId } from "@/app/lib/types/types";
import { ProfileContextBox } from "./profile-context-box";
import { BillingUpgradeModal } from "@/components/common/billing-upgrade-modal";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { FeedbackModal } from "./feedback-modal";
import { FIX_WORKFLOW_PROMPT, FIX_WORKFLOW_PROMPT_WITH_FEEDBACK } from "../copilot-prompts";

export function Chat({
    chat,
    projectId,
    workflow,
    messageSubscriber,
    systemMessage,
    onSystemMessageChange,
    mcpServerUrls,
    toolWebhookUrl,
    onCopyClick,
    showDebugMessages = true,
    showJsonMode = false,
    projectTools,
    triggerCopilotChat,
}: {
    chat: z.infer<typeof PlaygroundChat>;
    projectId: string;
    workflow: z.infer<typeof Workflow>;
    messageSubscriber?: (messages: z.infer<typeof Message>[]) => void;
    systemMessage: string;
    onSystemMessageChange: (message: string) => void;
    mcpServerUrls: Array<z.infer<typeof MCPServer>>;
    toolWebhookUrl: string;
    onCopyClick: (fn: () => string) => void;
    showDebugMessages?: boolean;
    showJsonMode?: boolean;
    projectTools: z.infer<typeof WorkflowTool>[];
    triggerCopilotChat?: (message: string) => void;
}) {
    const [messages, setMessages] = useState<z.infer<typeof Message>[]>(chat.messages);
    const [loadingAssistantResponse, setLoadingAssistantResponse] = useState<boolean>(false);
    const [fetchResponseError, setFetchResponseError] = useState<string | null>(null);
    const [billingError, setBillingError] = useState<string | null>(null);
    const [lastAgenticRequest, setLastAgenticRequest] = useState<unknown | null>(null);
    const [lastAgenticResponse, setLastAgenticResponse] = useState<unknown | null>(null);
    const [optimisticMessages, setOptimisticMessages] = useState<z.infer<typeof Message>[]>(chat.messages);
    const [isLastInteracted, setIsLastInteracted] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [pendingFixMessage, setPendingFixMessage] = useState<string | null>(null);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    // --- Scroll/auto-scroll/unread bubble logic ---
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [showUnreadBubble, setShowUnreadBubble] = useState(false);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const atBottom = scrollHeight - scrollTop - clientHeight < 20;
        setAutoScroll(atBottom);
        if (atBottom) setShowUnreadBubble(false);
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        if (autoScroll) {
            container.scrollTop = container.scrollHeight;
            setShowUnreadBubble(false);
        } else {
            setShowUnreadBubble(true);
        }
    }, [optimisticMessages, loadingAssistantResponse, autoScroll]);
    // --- End scroll/auto-scroll logic ---

    const getCopyContent = useCallback(() => {
        return JSON.stringify({
            messages: [{
                role: 'system',
                content: systemMessage,
            }, ...messages],
            lastRequest: lastAgenticRequest,
            lastResponse: lastAgenticResponse,
        }, null, 2);
    }, [messages, systemMessage, lastAgenticRequest, lastAgenticResponse]);

    // Expose copy function to parent
    useEffect(() => {
        onCopyClick(getCopyContent);
    }, [getCopyContent, onCopyClick]);

    // reset optimistic messages when messages change
    useEffect(() => {
        setOptimisticMessages(messages);
    }, [messages]);

    // Handle fix functionality
    const handleFix = useCallback((message: string) => {
        setPendingFixMessage(message);
        setShowFeedbackModal(true);
    }, []);

    const handleFeedbackSubmit = useCallback((feedback: string) => {
        if (!pendingFixMessage) return;

        // Create the copilot prompt
        const prompt = feedback.trim() 
            ? FIX_WORKFLOW_PROMPT_WITH_FEEDBACK
                .replace('{chat_turn}', pendingFixMessage)
                .replace('{feedback}', feedback)
            : FIX_WORKFLOW_PROMPT
                .replace('{chat_turn}', pendingFixMessage);

        // Use the triggerCopilotChat function if available, otherwise fall back to localStorage
        if (triggerCopilotChat) {
            triggerCopilotChat(prompt);
            // Show a subtle success indication
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 3000);
        } else {
            // Fallback for standalone playground
            localStorage.setItem(`project_prompt_${projectId}`, prompt);
            alert('Fix request submitted! Redirecting to workflow editor...');
            window.location.href = `/projects/${projectId}/workflow`;
        }
    }, [pendingFixMessage, projectId, triggerCopilotChat]);

    // collect published tool call results
    const toolCallResults: Record<string, z.infer<typeof ToolMessage>> = {};
    optimisticMessages
        .filter((message) => message.role == 'tool')
        .forEach((message) => {
            toolCallResults[message.toolCallId] = message;
        });

    function handleUserMessage(prompt: string) {
        const updatedMessages: z.infer<typeof Message>[] = [...messages, {
            role: 'user',
            content: prompt,
        }];
        setMessages(updatedMessages);
        setFetchResponseError(null);
        setIsLastInteracted(true);
    }

    // reset state when workflow changes
    useEffect(() => {
        setMessages([]);
    }, [workflow]);

    // publish messages to subscriber
    useEffect(() => {
        if (messageSubscriber) {
            messageSubscriber(messages);
        }
    }, [messages, messageSubscriber]);

    // get assistant response
    useEffect(() => {
        let ignore = false;
        let eventSource: EventSource | null = null;
        let msgs: z.infer<typeof Message>[] = [];

        async function process() {
            setLoadingAssistantResponse(true);
            setFetchResponseError(null);

            // Reset request/response state before making new request
            setLastAgenticRequest(null);
            setLastAgenticResponse(null);
            
            let streamId: string | null = null;
            try {
                const response = await getAssistantResponseStreamId(
                    projectId,
                    workflow,
                    projectTools,
                    [
                        {
                            role: 'system',
                            content: systemMessage || '',
                        },
                        ...messages,
                    ],
                );
                if (ignore) {
                    return;
                }
                if ('billingError' in response) {
                    setBillingError(response.billingError);
                    setFetchResponseError(response.billingError);
                    setLoadingAssistantResponse(false);
                    console.log('returning from getAssistantResponseStreamId due to billing error'); 
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
                return;
            }

            console.log(`chat.tsx: got streamid: ${streamId}`);
            eventSource = new EventSource(`/api/stream-response/${streamId}`);

            eventSource.addEventListener("message", (event) => {
                console.log(`chat.tsx: got message: ${event.data}`);
                if (ignore) {
                    return;
                }

                try {
                    const data = JSON.parse(event.data);
                    const parsedMsg = Message.parse(data);
                    msgs.push(parsedMsg);
                    setOptimisticMessages(prev => [...prev, parsedMsg]);
                } catch (err) {
                    console.error('Failed to parse SSE message:', err);
                    setFetchResponseError(`Failed to parse SSE message: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    setOptimisticMessages(messages);
                }
            });

            eventSource.addEventListener('done', (event) => {
                console.log(`chat.tsx: got done event: ${event.data}`);
                if (eventSource) {
                    eventSource.close();
                }

                const parsed = JSON.parse(event.data);

                // Combine state and collected messages in the response
                setLastAgenticResponse({
                    ...parsed,
                    messages: msgs
                });

                setMessages([...messages, ...msgs]);
                setLoadingAssistantResponse(false);
            });

            eventSource.addEventListener('stream_error', (event) => {
                console.log(`chat.tsx: got stream_error event: ${event.data}`);
                if (eventSource) {
                    eventSource.close();
                }

                console.error('SSE Error:', event);
                if (!ignore) {
                    setLoadingAssistantResponse(false);
                    setFetchResponseError('Error: ' + JSON.parse(event.data).error);
                    setOptimisticMessages(messages);
                }
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

        console.log(`executing response process: fetchresponseerr: ${fetchResponseError}`);
        process();

        return () => {
            ignore = true;
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [
        messages,
        projectId,
        workflow,
        systemMessage,
        mcpServerUrls,
        toolWebhookUrl,
        fetchResponseError,
        projectTools,
    ]);

    return <div className="w-11/12 max-w-6xl mx-auto h-full flex flex-col relative">
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 pt-4 pb-4">
        </div>

        <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto pr-4 relative playground-scrollbar"
            style={{ scrollBehavior: 'smooth' }}
        >
            <Messages
                projectId={projectId}
                messages={optimisticMessages}
                toolCallResults={toolCallResults}
                loadingAssistantResponse={loadingAssistantResponse}
                workflow={workflow}
                systemMessage={systemMessage}
                onSystemMessageChange={onSystemMessageChange}
                showSystemMessage={false}
                showDebugMessages={showDebugMessages}
                showJsonMode={showJsonMode}
                onFix={handleFix}
            />
            {showUnreadBubble && (
                <button
                    className="absolute bottom-4 right-4 z-20 bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-200 transition-colors animate-pulse"
                    onClick={() => {
                        const container = scrollContainerRef.current;
                        if (container) {
                            container.scrollTop = container.scrollHeight;
                        }
                        setAutoScroll(true);
                        setShowUnreadBubble(false);
                    }}
                    aria-label="Scroll to latest message"
                >
                    <ChevronDownIcon className="w-5 h-5" strokeWidth={2.2} />
                </button>
            )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-zinc-900 pt-4 pb-2">
            {showSuccessMessage && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 
                              rounded-lg flex gap-2 justify-between items-center">
                    <p className="text-green-600 dark:text-green-400 text-sm">Skipper will suggest fixes for you now.</p>
                    <Button
                        size="sm"
                        color="success"
                        onPress={() => setShowSuccessMessage(false)}
                    >
                        Dismiss
                    </Button>
                </div>
            )}
            {fetchResponseError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                              rounded-lg flex gap-2 justify-between items-center">
                    <p className="text-red-600 dark:text-red-400 text-sm">{fetchResponseError}</p>
                    <Button
                        size="sm"
                        color="danger"
                        onPress={() => {
                            setFetchResponseError(null);
                            setBillingError(null);
                        }}
                    >
                        Retry
                    </Button>
                </div>
            )}

            <ComposeBoxPlayground
                handleUserMessage={handleUserMessage}
                messages={messages.filter(msg => msg.content !== undefined) as any}
                loading={loadingAssistantResponse}
                shouldAutoFocus={isLastInteracted}
                onFocus={() => setIsLastInteracted(true)}
            />
        </div>


        <BillingUpgradeModal
            isOpen={!!billingError}
            onClose={() => setBillingError(null)}
            errorMessage={billingError || ''}
        />
        <FeedbackModal
            isOpen={showFeedbackModal}
            onClose={() => setShowFeedbackModal(false)}
            onSubmit={handleFeedbackSubmit}
            title="Fix Assistant"
        />
    </div>;
}