'use client';
import { Spinner } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import z from "zod";
import { Workflow } from "@/app/lib/types/workflow_types";
import { WorkflowTool } from "@/app/lib/types/workflow_types";
import MarkdownContent from "@/app/lib/components/markdown-content";
import { apiV1 } from "rowboat-shared";
import { MessageSquareIcon, EllipsisIcon, CircleCheckIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon, XIcon, PlusIcon } from "lucide-react";
import { TestProfile } from "@/app/lib/types/testing_types";
import { ProfileContextBox } from "./profile-context-box";

function UserMessage({ content }: { content: string }) {
    return (
        <div className="self-end flex flex-col items-end gap-1 mt-5 mb-8">
            <div className="text-gray-500 dark:text-gray-400 text-xs">
                User
            </div>
            <div className="max-w-[85%] inline-block">
                <div className="bg-blue-100 dark:bg-blue-900/40 px-4 py-2.5 
                    rounded-2xl rounded-br-lg text-sm leading-relaxed
                    text-gray-800 dark:text-blue-100 
                    border-none shadow-sm animate-slideUpAndFade">
                    <div className="text-left">
                        <MarkdownContent content={content} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function InternalAssistantMessage({ content, sender, latency, delta }: { content: string, sender: string | null | undefined, latency: number, delta: number }) {
    const [expanded, setExpanded] = useState(false);

    // Show plus icon and duration
    const deltaDisplay = (
        <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <PlusIcon size={12} />
            {Math.round(delta / 1000)}s
        </span>
    );

    return (
        <div className="self-start flex flex-col gap-1 my-5">
            <div className="text-gray-500 dark:text-gray-400 text-xs pl-1">
                {sender ?? 'Assistant'}
            </div>
            <div className={expanded ? 'max-w-[85%] inline-block' : 'inline-block'}>
                <div className={expanded
                  ? 'bg-gray-50 dark:bg-zinc-800 px-4 py-2.5 rounded-2xl rounded-bl-lg text-sm leading-relaxed text-gray-700 dark:text-gray-200 border-none shadow-sm animate-slideUpAndFade flex flex-col items-stretch'
                  : 'bg-gray-50 dark:bg-zinc-800 px-4 py-0.5 rounded-2xl rounded-bl-lg text-sm leading-relaxed text-gray-700 dark:text-gray-200 border-none shadow-sm animate-slideUpAndFade w-fit'}>
                    {!expanded ? (
                        <div className="flex justify-between items-center gap-6 mt-2">
                            <button className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 hover:underline self-start" onClick={() => setExpanded(true)}>
                                <ChevronDownIcon size={16} />
                                Show internal message
                            </button>
                            <div className="text-right text-xs">
                                {deltaDisplay}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-left mb-2">
                                <MarkdownContent content={content} />
                            </div>
                            <div className="flex justify-between items-center gap-6 mt-2">
                                <button className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 hover:underline self-start" onClick={() => setExpanded(false)}>
                                    <ChevronUpIcon size={16} />
                                    Hide internal message
                                </button>
                                <div className="text-right text-xs">
                                    {deltaDisplay}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function AssistantMessage({ content, sender, latency }: { content: string, sender: string | null | undefined, latency: number }) {
    return (
        <div className="self-start flex flex-col gap-1 my-5">
            <div className="text-gray-500 dark:text-gray-400 text-xs pl-1">
                {sender ?? 'Assistant'}
            </div>
            <div className="max-w-[85%] inline-block">
                <div className="bg-purple-50 dark:bg-purple-900/30 px-4 py-2.5 
                    rounded-2xl rounded-bl-lg text-sm leading-relaxed
                    text-gray-800 dark:text-purple-100 
                    border-none shadow-sm animate-slideUpAndFade">
                    <div className="flex flex-col gap-1">
                        <div className="text-left">
                            <MarkdownContent content={content} />
                        </div>
                        {latency > 0 && <div className="text-right text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {Math.round(latency / 1000)}s
                        </div>}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AssistantMessageLoading() {
    return (
        <div className="self-start flex flex-col gap-1 my-5">
            <div className="max-w-[85%] inline-block">
                <div className="bg-purple-50 dark:bg-purple-900/30 px-4 py-2.5 
                    rounded-2xl rounded-bl-lg
                    border-none shadow-sm animate-slideUpAndFade min-h-[2.5rem] flex items-center">
                    <Spinner size="sm" className="ml-2" />
                </div>
            </div>
        </div>
    );
}

function ToolCalls({
    toolCalls,
    results,
    projectId,
    messages,
    sender,
    workflow,
    testProfile = null,
    systemMessage,
    delta
}: {
    toolCalls: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'];
    results: Record<string, z.infer<typeof apiV1.ToolMessage>>;
    projectId: string;
    messages: z.infer<typeof apiV1.ChatMessage>[];
    sender: string | null | undefined;
    workflow: z.infer<typeof Workflow>;
    testProfile: z.infer<typeof TestProfile> | null;
    systemMessage: string | undefined;
    delta: number;
}) {
    return <div className="flex flex-col gap-4">
        {toolCalls.map(toolCall => {
            return <ToolCall
                key={toolCall.id}
                toolCall={toolCall}
                result={results[toolCall.id]}
                sender={sender}
                workflow={workflow}
                delta={delta}
            />
        })}
    </div>;
}

function ToolCall({
    toolCall,
    result,
    sender,
    workflow,
    delta
}: {
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number];
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    sender: string | null | undefined;
    workflow: z.infer<typeof Workflow>;
    delta: number;
}) {
    let matchingWorkflowTool: z.infer<typeof WorkflowTool> | undefined;
    for (const tool of workflow.tools) {
        if (tool.name === toolCall.function.name) {
            matchingWorkflowTool = tool;
            break;
        }
    }

    if (toolCall.function.name.startsWith('transfer_to_')) {
        return <TransferToAgentToolCall
            result={result}
            sender={sender ?? ''}
            delta={delta}
        />;
    }
    return <ClientToolCall
        toolCall={toolCall}
        result={result}
        sender={sender ?? ''}
        workflow={workflow}
        delta={delta}
    />;
}

function TransferToAgentToolCall({
    result: availableResult,
    sender,
    delta
}: {
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    sender: string | null | undefined;
    delta: number;
}) {
    const typedResult = availableResult ? JSON.parse(availableResult.content) as { assistant: string } : undefined;
    if (!typedResult) {
        return <></>;
    }
    const deltaDisplay = (
        <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <PlusIcon size={12} />
            {Math.round(delta / 1000)}s
        </span>
    );
    return (
        <div className="flex justify-center mb-2">
            <div className="flex items-center gap-2 px-4 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 shadow-sm text-xs">
                <span className="text-gray-700 dark:text-gray-200">{sender}</span>
                <ChevronRightIcon size={14} className="text-gray-400 dark:text-gray-300" />
                <span className="text-gray-700 dark:text-gray-200">{typedResult.assistant}</span>
                <span className="ml-2">{deltaDisplay}</span>
            </div>
        </div>
    );
}

function ClientToolCall({
    toolCall,
    result: availableResult,
    sender,
    workflow,
    delta
}: {
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number];
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    sender: string | null | undefined;
    workflow: z.infer<typeof Workflow>;
    delta: number;
}) {
    return (
        <div className="self-start flex flex-col gap-1">
            {sender && (
                <div className="text-gray-500 dark:text-gray-400 text-xs pl-1">
                    {sender}
                </div>
            )}
            <div className="min-w-[85%] inline-block">
                <div className="border border-gray-200 dark:border-gray-700 p-3
                    rounded-2xl rounded-bl-lg flex flex-col gap-2
                    bg-gray-50 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/20">
                    <div className="flex flex-col gap-1">
                        <div className="shrink-0 flex gap-2 items-center">
                            {!availableResult && <Spinner size="sm" />}
                            {availableResult && <CircleCheckIcon size={16} />}
                            <div className="font-semibold text-sm">
                                Function Call: <code className="bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded font-mono">
                                    {toolCall.function.name}
                                </code>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <ExpandableContent label="Params" content={toolCall.function.arguments} expanded={false} />
                        {availableResult && <ExpandableContent label="Result" content={availableResult.content} expanded={false} />}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ExpandableContent({
    label,
    content,
    expanded = false
}: {
    label: string,
    content: string | object | undefined,
    expanded?: boolean
}) {
    const [isExpanded, setIsExpanded] = useState(expanded);

    const formattedContent = useMemo(() => {
        if (typeof content === 'string') {
            try {
                const parsed = JSON.parse(content);
                return JSON.stringify(parsed, null, 2);
            } catch (e) {
                // If it's not JSON, return the string as-is
                return content;
            }
        }
        if (typeof content === 'object') {
            return JSON.stringify(content, null, 2);
        }
        return 'undefined';
    }, [content]);

    function toggleExpanded() {
        setIsExpanded(!isExpanded);
    }

    const isMarkdown = label === 'Result' && typeof content === 'string' && !content.startsWith('{');

    return <div className='flex flex-col gap-2'>
        <div className='flex gap-1 items-start cursor-pointer text-gray-500 dark:text-gray-400' onClick={toggleExpanded}>
            {!isExpanded && <ChevronRightIcon size={16} />}
            {isExpanded && <ChevronDownIcon size={16} />}
            <div className='text-left break-all text-xs'>{label}</div>
        </div>
        {isExpanded && (
            isMarkdown ? (
                <div className='text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded text-gray-900 dark:text-gray-100'>
                    <MarkdownContent content={content as string} />
                </div>
            ) : (
                <pre className='text-sm font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded break-all whitespace-pre-wrap overflow-x-auto text-gray-900 dark:text-gray-100'>
                    {formattedContent}
                </pre>
            )
        )}
    </div>;
}

export function Messages({
    projectId,
    messages,
    toolCallResults,
    loadingAssistantResponse,
    workflow,
    testProfile = null,
    systemMessage,
    onSystemMessageChange,
    showSystemMessage,
}: {
    projectId: string;
    messages: z.infer<typeof apiV1.ChatMessage>[];
    toolCallResults: Record<string, z.infer<typeof apiV1.ToolMessage>>;
    loadingAssistantResponse: boolean;
    workflow: z.infer<typeof Workflow>;
    testProfile: z.infer<typeof TestProfile> | null;
    systemMessage: string | undefined;
    onSystemMessageChange: (message: string) => void;
    showSystemMessage: boolean;
}) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    let lastUserMessageTimestamp = 0;
    let userMessageSeen = false;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loadingAssistantResponse]);

    const renderMessage = (message: z.infer<typeof apiV1.ChatMessage>, index: number) => {
        const isConsecutive = index > 0 && messages[index - 1].role === message.role;

        if (message.role === 'assistant') {
            let latency = new Date(message.createdAt).getTime() - lastUserMessageTimestamp;
            if (!userMessageSeen) {
                latency = 0;
            }
            // Helper: is this message a transfer pill or internal message?
            const isTransferPill = 'tool_calls' in message && message.tool_calls.some(tc => tc.function.name.startsWith('transfer_to_'));
            const isInternal = message.agenticResponseType === 'internal';
            if (isTransferPill || isInternal) {
                // Find previous message that is either a transfer pill or internal message
                let delta = latency;
                for (let i = index - 1; i >= 0; i--) {
                    const prev = messages[i];
                    const prevIsTransferPill = prev.role === 'assistant' && 'tool_calls' in prev && prev.tool_calls.some(tc => tc.function.name.startsWith('transfer_to_'));
                    const prevIsInternal = prev.role === 'assistant' && prev.agenticResponseType === 'internal';
                    if (prevIsTransferPill || prevIsInternal) {
                        delta = new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime();
                        break;
                    }
                    if (prev.role === 'user') {
                        break;
                    }
                }
                if (isTransferPill) {
                    return (
                        <ToolCalls
                            toolCalls={message.tool_calls}
                            results={toolCallResults}
                            projectId={projectId}
                            messages={messages}
                            sender={message.agenticSender ?? ''}
                            workflow={workflow}
                            testProfile={testProfile}
                            systemMessage={systemMessage}
                            delta={delta}
                        />
                    );
                } else {
                    return (
                        <InternalAssistantMessage
                            content={message.content ?? ''}
                            sender={message.agenticSender ?? ''}
                            latency={latency}
                            delta={delta}
                        />
                    );
                }
            }
            return (
                <AssistantMessage
                    content={message.content ?? ''}
                    sender={message.agenticSender ?? ''}
                    latency={latency}
                />
            );
        }

        if (message.role === 'user' && typeof message.content === 'string') {
            lastUserMessageTimestamp = new Date(message.createdAt).getTime();
            userMessageSeen = true;
            return <UserMessage content={message.content} />;
        }

        return null;
    };

    const isAgentTransition = (message: z.infer<typeof apiV1.ChatMessage>) => {
        return message.role === 'assistant' && 'tool_calls' in message && Array.isArray(message.tool_calls) && message.tool_calls.some(tc => tc.function.name.startsWith('transfer_to_'));
    };

    const isAssistantMessage = (message: z.infer<typeof apiV1.ChatMessage>) => {
        return message.role === 'assistant' && (!('tool_calls' in message) || !Array.isArray(message.tool_calls) || !message.tool_calls.some(tc => tc.function.name.startsWith('transfer_to_')));
    };

    if (showSystemMessage) {
        return (
            <ProfileContextBox
                content={testProfile?.context || systemMessage || ''}
                onChange={onSystemMessageChange}
                locked={testProfile !== null}
            />
        );
    }

    return (
        <div className="max-w-[768px] mx-auto">
            <div className="flex flex-col">
                {messages.map((message, index) => (
                    <div key={index}>
                        {renderMessage(message, index)}
                    </div>
                ))}
                {loadingAssistantResponse && <AssistantMessageLoading />}
            </div>
            <div ref={messagesEndRef} />
        </div>
    );
}