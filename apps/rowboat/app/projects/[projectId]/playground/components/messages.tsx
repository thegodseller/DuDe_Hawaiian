'use client';
import { Spinner } from "@heroui/react";
import { useMemo, useState } from "react";
import z from "zod";
import { Workflow } from "@/app/lib/types/workflow_types";
import { WorkflowTool } from "@/app/lib/types/workflow_types";
import MarkdownContent from "@/app/lib/components/markdown-content";
import { ChevronRightIcon, ChevronDownIcon, ChevronUpIcon, CodeIcon, CheckCircleIcon, FileTextIcon, EyeIcon, EyeOffIcon, WrapTextIcon, ArrowRightFromLineIcon, BracesIcon, TextIcon } from "lucide-react";
import { TestProfile } from "@/app/lib/types/testing_types";
import { ProfileContextBox } from "./profile-context-box";
import { Message, ToolMessage, AssistantMessageWithToolCalls } from "@/app/lib/types/types";

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

function InternalAssistantMessage({ content, sender, latency, delta, showJsonMode = false }: { content: string, sender: string | null | undefined, latency: number, delta: number, showJsonMode?: boolean }) {
    const [expanded, setExpanded] = useState(true);
    const isJsonContent = useMemo(() => {
        try {
            JSON.parse(content);
            return true;
        } catch {
            return false;
        }
    }, [content]);
    const [jsonMode, setJsonMode] = useState(isJsonContent);
    const [wrapText, setWrapText] = useState(true);

    // Show plus icon and duration
    const deltaDisplay = (
        <span className="inline-flex items-center text-gray-400 dark:text-gray-500">
            +{Math.round(delta / 1000)}s
        </span>
    );

    // Get first line preview
    const firstLine = content.split('\n')[0].trim();
    const preview = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;

    // Format JSON content
    const formattedJson = useMemo(() => {
        if (!isJsonContent) return content;
        try {
            return JSON.stringify(JSON.parse(content), null, 2);
        } catch {
            return content;
        }
    }, [content, isJsonContent]);

    return (
        <div className="self-start flex flex-col gap-1 my-5">
            <div className="text-gray-500 dark:text-gray-400 text-xs pl-1">
                {sender ?? 'Assistant'}
            </div>
            <div className={expanded ? 'max-w-[85%] inline-block' : 'inline-block'}>
                <div className={expanded
                  ? 'bg-gray-50 dark:bg-zinc-800 px-4 py-2.5 rounded-2xl rounded-bl-lg text-sm leading-relaxed text-gray-700 dark:text-gray-200 border-none shadow-sm animate-slideUpAndFade flex flex-col items-stretch'
                  : 'bg-gray-50 dark:bg-zinc-800 px-4 py-2.5 rounded-2xl rounded-bl-lg text-sm leading-relaxed text-gray-700 dark:text-gray-200 border-none shadow-sm animate-slideUpAndFade w-fit'}>
                    {!expanded ? (
                        <div className="flex flex-col gap-2">
                            <div className="text-gray-700 dark:text-gray-200">
                                {preview}
                            </div>
                            <div className="flex justify-between items-center gap-6">
                                <button className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 hover:underline self-start" onClick={() => setExpanded(true)}>
                                    <ChevronDownIcon size={16} />
                                    Show
                                </button>
                                <div className="text-right text-xs">
                                    {deltaDisplay}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-left mb-2">
                                {isJsonContent && (
                                    <div className="mb-2 flex gap-4">
                                        <button 
                                            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline self-start" 
                                            onClick={() => setJsonMode(!jsonMode)}
                                        >
                                            {jsonMode ? <TextIcon size={16} /> : <BracesIcon size={16} />}
                                            {jsonMode ? 'View in text mode' : 'View in JSON mode'}
                                        </button>
                                        {jsonMode && (
                                            <button 
                                                className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline self-start" 
                                                onClick={() => setWrapText(!wrapText)}
                                            >
                                                {wrapText ? <ArrowRightFromLineIcon size={16} /> : <WrapTextIcon size={16} />}
                                                {wrapText ? 'Overflow' : 'Wrap'}
                                            </button>
                                        )}
                                    </div>
                                )}
                                {isJsonContent && jsonMode ? (
                                    <pre
                                        className={`text-xs leading-snug bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-lg px-2 py-1 font-mono shadow-sm border border-zinc-100 dark:border-zinc-700 ${
                                            wrapText ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto whitespace-pre'
                                        } w-full`}
                                        style={{ fontFamily: "'JetBrains Mono', 'Fira Mono', 'Menlo', 'Consolas', 'Liberation Mono', monospace" }}
                                    >
                                        {formattedJson}
                                    </pre>
                                ) : (
                                    <MarkdownContent content={content} />
                                )}
                            </div>
                            <div className="flex justify-between items-center gap-6 mt-2">
                                <button className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 hover:underline self-start" onClick={() => setExpanded(false)}>
                                    <ChevronUpIcon size={16} />
                                    Hide
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
    toolCalls: z.infer<typeof AssistantMessageWithToolCalls>['toolCalls'];
    results: Record<string, z.infer<typeof ToolMessage>>;
    projectId: string;
    messages: z.infer<typeof Message>[];
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
    toolCall: z.infer<typeof AssistantMessageWithToolCalls>['toolCalls'][number];
    result: z.infer<typeof ToolMessage> | undefined;
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
    result: z.infer<typeof ToolMessage> | undefined;
    sender: string | null | undefined;
    delta: number;
}) {
    const typedResult = availableResult ? JSON.parse(availableResult.content) as { assistant: string } : undefined;
    if (!typedResult) {
        return <></>;
    }
    const deltaDisplay = (
        <span className="inline-flex items-center text-gray-400 dark:text-gray-500">
            +{Math.round(delta / 1000)}s
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
    toolCall: z.infer<typeof AssistantMessageWithToolCalls>['toolCalls'][number];
    result: z.infer<typeof ToolMessage> | undefined;
    sender: string | null | undefined;
    workflow: z.infer<typeof Workflow>;
    delta: number;
}) {
    const [wrapText, setWrapText] = useState(true);
    const [paramsExpanded, setParamsExpanded] = useState(false);
    const [resultsExpanded, setResultsExpanded] = useState(false);
    const hasExpandedContent = paramsExpanded || resultsExpanded;
    const isCompressed = !paramsExpanded && !resultsExpanded;

    // Compressed state: stretch header, no wrapping
    if (isCompressed) {
        return (
            <div className="self-start flex flex-col gap-1 my-5">
                {sender && (
                    <div className="text-gray-500 dark:text-gray-400 text-xs pl-1">
                        {sender}
                    </div>
                )}
                <div className="min-w-[85%]">
                    <div className="border border-gray-200 dark:border-gray-700 p-3
                        rounded-2xl rounded-bl-lg flex flex-col gap-2
                        bg-gray-50 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/20">
                        <div className="flex flex-col gap-1 min-w-0">
                            <div className="shrink-0 flex gap-2 items-center flex-nowrap">
                                {!availableResult && <Spinner size="sm" />}
                                {availableResult && <CheckCircleIcon size={16} className="text-green-500" />}
                                <div className="flex items-center font-medium text-xs gap-2 min-w-0 flex-nowrap">
                                    <span>Invoked Tool:</span>
                                    <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 dark:bg-purple-900/30 dark:text-purple-100 text-xs align-middle whitespace-nowrap">
                                        {toolCall.function.name}
                                    </span>
                                </div>
                            </div>
                            {hasExpandedContent && (
                                <div className="flex justify-start mt-2">
                                    <button 
                                        className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline" 
                                        onClick={() => setWrapText(!wrapText)}
                                    >
                                        {wrapText ? <ArrowRightFromLineIcon size={16} /> : <WrapTextIcon size={16} />}
                                        {wrapText ? 'Overflow' : 'Wrap'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 min-w-0">
                            <ExpandableContent 
                                label="Params" 
                                content={toolCall.function.arguments} 
                                expanded={false} 
                                icon={<CodeIcon size={14} />}
                                wrapText={wrapText}
                                onExpandedChange={setParamsExpanded}
                            />
                            {availableResult && (
                                <div className={(paramsExpanded ? 'mt-4 ' : '') + 'flex flex-col gap-2 min-w-0'}>
                                    <ExpandableContent 
                                        label="Result" 
                                        content={availableResult.content} 
                                        expanded={false} 
                                        icon={<FileTextIcon size={14} className="text-blue-500" />}
                                        wrapText={wrapText}
                                        onExpandedChange={setResultsExpanded}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Expanded state: respect 85% max width, prevent overshoot
    return (
        <div className="self-start flex flex-col gap-1 my-5">
            {sender && (
                <div className="text-gray-500 dark:text-gray-400 text-xs pl-1">
                    {sender}
                </div>
            )}
            <div className="w-full">
                <div className="border border-gray-200 dark:border-gray-700 p-3
                    rounded-2xl rounded-bl-lg flex flex-col gap-2
                    bg-gray-50 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/20 w-full">
                    <div className="flex flex-col gap-1 w-full">
                        <div className="shrink-0 flex gap-2 items-center w-full flex-nowrap">
                            {!availableResult && <Spinner size="sm" />}
                            {availableResult && <CheckCircleIcon size={16} className="text-green-500" />}
                            <div className="flex items-center font-medium text-xs gap-2 w-full min-w-0 flex-nowrap">
                                <span>Invoked Tool:</span>
                                <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 dark:bg-purple-900/30 dark:text-purple-100 text-xs align-middle truncate min-w-0 max-w-full">
                                    {toolCall.function.name}
                                </span>
                            </div>
                        </div>
                        {hasExpandedContent && (
                            <div className="flex justify-start mt-2">
                                <button 
                                    className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline" 
                                    onClick={() => setWrapText(!wrapText)}
                                >
                                    {wrapText ? <ArrowRightFromLineIcon size={16} /> : <WrapTextIcon size={16} />}
                                    {wrapText ? 'Overflow' : 'Wrap'}
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                        <ExpandableContent 
                            label="Params" 
                            content={toolCall.function.arguments} 
                            expanded={paramsExpanded} 
                            icon={<CodeIcon size={14} />}
                            wrapText={wrapText}
                            onExpandedChange={setParamsExpanded}
                        />
                        {availableResult && (
                            <div className={(paramsExpanded ? 'mt-4 ' : '') + 'flex flex-col gap-2 w-full'}>
                                <ExpandableContent 
                                    label="Result" 
                                    content={availableResult.content} 
                                    expanded={resultsExpanded} 
                                    icon={<FileTextIcon size={14} className="text-blue-500" />}
                                    wrapText={wrapText}
                                    onExpandedChange={setResultsExpanded}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ExpandableContent({
    label,
    content,
    expanded = false,
    icon,
    wrapText = false,
    onExpandedChange,
    rightButton
}: {
    label: string,
    content: string | object | undefined,
    expanded?: boolean,
    icon?: React.ReactNode,
    wrapText?: boolean,
    onExpandedChange?: (expanded: boolean) => void,
    rightButton?: React.ReactNode
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
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);
        onExpandedChange?.(newExpanded);
    }

    const isMarkdown = label === 'Result' && typeof content === 'string' && !content.startsWith('{');

    return <div className='flex flex-col gap-2 min-w-0'>
        <div className='flex gap-1 items-start cursor-pointer text-gray-500 dark:text-gray-400 min-w-0' onClick={toggleExpanded}>
            {!isExpanded && <ChevronRightIcon size={16} />}
            {isExpanded && <ChevronDownIcon size={16} />}
            {icon && <span className="mr-1">{icon}</span>}
            <div className='text-left break-all text-xs'>{label}</div>
            {rightButton && <span className="ml-2">{rightButton}</span>}
        </div>
        {isExpanded && (
            isMarkdown ? (
                <div className='text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded text-gray-900 dark:text-gray-100 min-w-0'>
                    <MarkdownContent content={content as string} />
                </div>
            ) : (
                <pre
                  className={`text-xs leading-snug bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-lg px-2 py-1 font-mono shadow-sm border border-zinc-100 dark:border-zinc-700 ${
                      wrapText ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto whitespace-pre'
                  } min-w-0 max-w-full`}
                  style={{ fontFamily: "'JetBrains Mono', 'Fira Mono', 'Menlo', 'Consolas', 'Liberation Mono', monospace" }}
                >
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
    showDebugMessages = true,
    showJsonMode = false,
}: {
    projectId: string;
    messages: z.infer<typeof Message>[];
    toolCallResults: Record<string, z.infer<typeof ToolMessage>>;
    loadingAssistantResponse: boolean;
    workflow: z.infer<typeof Workflow>;
    testProfile: z.infer<typeof TestProfile> | null;
    systemMessage: string | undefined;
    onSystemMessageChange: (message: string) => void;
    showSystemMessage: boolean;
    showDebugMessages?: boolean;
    showJsonMode?: boolean;
}) {
    // Remove scroll/auto-scroll state and logic
    // const scrollContainerRef = useRef<HTMLDivElement>(null);
    // const [autoScroll, setAutoScroll] = useState(true);
    // const [showUnreadBubble, setShowUnreadBubble] = useState(false);
    // Remove handleScroll and useEffect for scroll

    const renderMessage = (message: z.infer<typeof Message>, index: number) => {
        if (message.role === 'assistant') {
            // TODO: add latency support
            // let latency = new Date(message.createdAt).getTime() - lastUserMessageTimestamp;
            // if (!userMessageSeen) {
            //     latency = 0;
            // }
            let latency = 0;

            // First check for tool calls
            if ('toolCalls' in message) {
                // Skip tool calls if debug mode is off
                if (!showDebugMessages) {
                    return null;
                }
                return (
                    <ToolCalls
                        toolCalls={message.toolCalls}
                        results={toolCallResults}
                        projectId={projectId}
                        messages={messages}
                        sender={message.agentName ?? ''}
                        workflow={workflow}
                        testProfile={testProfile}
                        systemMessage={systemMessage}
                        delta={latency}
                    />
                );
            }

            // Then check for internal messages
            if (message.content && message.responseType === 'internal') {
                // Skip internal messages if debug mode is off
                if (!showDebugMessages) {
                    return null;
                }
                return (
                    <InternalAssistantMessage
                        content={message.content ?? ''}
                        sender={message.agentName ?? ''}
                        latency={latency}
                        delta={latency}
                        showJsonMode={showJsonMode}
                    />
                );
            }

            // Finally, regular assistant messages
            return (
                <AssistantMessage
                    content={message.content ?? ''}
                    sender={message.agentName ?? ''}
                    latency={latency}
                />
            );
        }

        if (message.role === 'user') {
            // TODO: add latency support
            // lastUserMessageTimestamp = new Date(message.createdAt).getTime();
            // userMessageSeen = true;
            return <UserMessage content={message.content} />;
        }

        return null;
    };

    const isAgentTransition = (message: z.infer<typeof Message>) => {
        return message.role === 'assistant' && 'toolCalls' in message && Array.isArray(message.toolCalls) && message.toolCalls.some(tc => tc.function.name.startsWith('transfer_to_'));
    };

    const isAssistantMessage = (message: z.infer<typeof Message>) => {
        return message.role === 'assistant' && (!('toolCalls' in message) || !Array.isArray(message.toolCalls) || !message.toolCalls.some(tc => tc.function.name.startsWith('transfer_to_')));
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

    // Just render the messages, no scroll container or unread bubble
    return (
        <div className="max-w-7xl mx-auto px-2 sm:px-8 relative">
            {messages.map((message, index) => {
                const renderedMessage = renderMessage(message, index);
                if (renderedMessage) {
                    return (
                        <div key={index}>
                            {renderedMessage}
                        </div>
                    );
                }
                return null;
            })}
            {loadingAssistantResponse && <AssistantMessageLoading />}
        </div>
    );
}