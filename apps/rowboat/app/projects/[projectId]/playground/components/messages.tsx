'use client';
import { Spinner } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import z from "zod";
import { Workflow } from "@/app/lib/types/workflow_types";
import { WorkflowTool } from "@/app/lib/types/workflow_types";
import MarkdownContent from "@/app/lib/components/markdown-content";
import { apiV1 } from "rowboat-shared";
import { MessageSquareIcon, EllipsisIcon, CircleCheckIcon, ChevronRightIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { TestProfile } from "@/app/lib/types/testing_types";
import { ProfileContextBox } from "./profile-context-box";

function UserMessage({ content }: { content: string }) {
    return (
        <div className="self-end flex flex-col items-end gap-1">
            <div className="text-gray-500 dark:text-gray-400 text-xs">
                User
            </div>
            <div className="max-w-[85%] inline-block">
                <div className="bg-blue-50 dark:bg-[#1e2023] px-4 py-2.5 
                    rounded-2xl rounded-br-lg text-sm leading-relaxed
                    text-gray-700 dark:text-gray-200 
                    border border-blue-100 dark:border-[#2a2d31]
                    shadow-sm animate-slideUpAndFade">
                    <div className="text-left">
                        <MarkdownContent content={content} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function InternalAssistantMessage({ content, sender, latency }: { content: string, sender: string | null | undefined, latency: number }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="self-start flex flex-col gap-1">
            {!expanded ? (
                <button className="flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 gap-1 group"
                    onClick={() => setExpanded(true)}>
                    <MessageSquareIcon size={16} />
                    <EllipsisIcon size={16} />
                    <span className="text-xs">Show debug message</span>
                </button>
            ) : (
                <>
                    <div className="text-gray-500 dark:text-gray-400 text-xs pl-1 flex items-center justify-between">
                        <span>{sender ?? 'Assistant'}</span>
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            onClick={() => setExpanded(false)}>
                            <XIcon size={16} />
                        </button>
                    </div>
                    <div className="max-w-[85%] inline-block">
                        <div className="border border-gray-200 dark:border-gray-700 border-dashed 
                            px-4 py-2.5 rounded-2xl rounded-bl-lg text-sm
                            text-gray-700 dark:text-gray-200 shadow-sm">
                            <pre className="whitespace-pre-wrap">{content}</pre>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function AssistantMessage({ content, sender, latency }: { content: string, sender: string | null | undefined, latency: number }) {
    return (
        <div className="self-start flex flex-col gap-1">
            <div className="text-gray-500 dark:text-gray-400 text-xs pl-1">
                {sender ?? 'Assistant'}
            </div>
            <div className="max-w-[85%] inline-block">
                <div className="bg-gray-50 dark:bg-[#1e2023] px-4 py-2.5 
                    rounded-2xl rounded-bl-lg text-sm leading-relaxed
                    text-gray-700 dark:text-gray-200 
                    border border-gray-200 dark:border-[#2a2d31]
                    shadow-sm animate-slideUpAndFade">
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
        <div className="self-start flex flex-col gap-1">
            <div className="text-gray-500 dark:text-gray-400 text-xs pl-1">
                Assistant
            </div>
            <div className="max-w-[85%] inline-block">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2.5 
                    rounded-2xl rounded-bl-lg
                    border border-gray-200 dark:border-gray-700
                    shadow-sm dark:shadow-gray-950/20 animate-pulse min-h-[2.5rem] flex items-center">
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
}: {
    toolCalls: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'];
    results: Record<string, z.infer<typeof apiV1.ToolMessage>>;
    projectId: string;
    messages: z.infer<typeof apiV1.ChatMessage>[];
    sender: string | null | undefined;
    workflow: z.infer<typeof Workflow>;
    testProfile: z.infer<typeof TestProfile> | null;
    systemMessage: string | undefined;
}) {
    return <div className="flex flex-col gap-4">
        {toolCalls.map(toolCall => {
            return <ToolCall
                key={toolCall.id}
                toolCall={toolCall}
                result={results[toolCall.id]}
                sender={sender}
                workflow={workflow}
            />
        })}
    </div>;
}

function ToolCall({
    toolCall,
    result,
    sender,
    workflow,
}: {
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number];
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    sender: string | null | undefined;
    workflow: z.infer<typeof Workflow>;
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
            sender={sender}
        />;
    }
    return <ClientToolCall
        toolCall={toolCall}
        result={result}
        sender={sender}
    />;
}

function TransferToAgentToolCall({
    result: availableResult,
    sender,
}: {
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    sender: string | null | undefined;
}) {
    const typedResult = availableResult ? JSON.parse(availableResult.content) as { assistant: string } : undefined;
    if (!typedResult) {
        return <></>;
    }

    return <div className="flex gap-1 items-center text-gray-500 text-sm justify-center">
        <div>{sender}</div>
        <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 12H5m14 0-4 4m4-4-4-4" />
        </svg>
        <div>{typedResult.assistant}</div>
    </div>;
}

function ClientToolCall({
    toolCall,
    result: availableResult,
    sender,
}: {
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number];
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    sender: string | null | undefined;
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
            // the assistant message createdAt is an ISO string timestamp
            let latency = new Date(message.createdAt).getTime() - lastUserMessageTimestamp;
            // if this is the first message, set the latency to 0
            if (!userMessageSeen) {
                latency = 0;
            }
            if ('tool_calls' in message) {
                return (
                    <ToolCalls
                        toolCalls={message.tool_calls}
                        results={toolCallResults}
                        projectId={projectId}
                        messages={messages}
                        sender={message.agenticSender}
                        workflow={workflow}
                        testProfile={testProfile}
                        systemMessage={systemMessage}
                    />
                );
            }
            return message.agenticResponseType === 'internal' ? (
                <InternalAssistantMessage
                    content={message.content}
                    sender={message.agenticSender}
                    latency={latency}
                />
            ) : (
                <AssistantMessage
                    content={message.content}
                    sender={message.agenticSender}
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
            <div className="flex flex-col space-y-2">
                {messages.map((message, index) => (
                    <div 
                        key={index}
                        className={`${index > 0 && messages[index - 1].role === message.role ? 'mt-1' : 'mt-4'}`}
                    >
                        {renderMessage(message, index)}
                    </div>
                ))}
                {loadingAssistantResponse && <AssistantMessageLoading />}
            </div>
            <div ref={messagesEndRef} />
        </div>
    );
}