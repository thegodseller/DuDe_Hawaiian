'use client';
import { Spinner } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Workflow } from "@/app/lib/types/workflow_types";
import MarkdownContent from "@/app/lib/components/markdown-content";
import { MessageSquareIcon, EllipsisIcon, XIcon } from "lucide-react";
import { CopilotMessage, CopilotAssistantMessage } from "@/app/lib/types/copilot_types";
import { Action } from './actions';

function UserMessage({ content }: { content: string }) {
    return (
        <div className="w-full">
            <div className="bg-blue-50 dark:bg-[#1e2023] px-4 py-2.5 
                rounded-lg text-sm leading-relaxed
                text-gray-700 dark:text-gray-200 
                border border-blue-100 dark:border-[#2a2d31]
                shadow-sm animate-slideUpAndFade">
                <div className="text-left">
                    <MarkdownContent content={content} />
                </div>
            </div>
        </div>
    );
}

function InternalAssistantMessage({ content }: { content: string }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="w-full">
            {!expanded ? (
                <button className="flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 gap-1 group" 
                    onClick={() => setExpanded(true)}>
                    <MessageSquareIcon size={16} />
                    <EllipsisIcon size={16} />
                    <span className="text-xs">Show debug message</span>
                </button>
            ) : (
                <div className="w-full">
                    <div className="border border-gray-200 dark:border-gray-700 border-dashed 
                        px-4 py-2.5 rounded-lg text-sm
                        text-gray-700 dark:text-gray-200 shadow-sm">
                        <div className="flex justify-end mb-2">
                            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" 
                                onClick={() => setExpanded(false)}>
                                <XIcon size={16} />
                            </button>
                        </div>
                        <pre className="whitespace-pre-wrap">{content}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}

function AssistantMessage({ 
    content, 
    workflow, 
    handleApplyChange, 
    appliedChanges,
    messageIndex
}: { 
    content: z.infer<typeof CopilotAssistantMessage>['content'], 
    workflow: z.infer<typeof Workflow>,
    handleApplyChange: (messageIndex: number, actionIndex: number, field?: string) => void,
    appliedChanges: Record<string, boolean>,
    messageIndex: number
}) {
    return (
        <div className="w-full">
            <div className="px-4 py-2.5 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                <div className="flex flex-col gap-4">
                    <div className="text-left flex flex-col gap-4">
                        {content.response.map((part, actionIndex) => {
                            if (part.type === "text") {
                                return <MarkdownContent key={actionIndex} content={part.content} />;
                            } else if (part.type === "action") {
                                return <Action
                                    key={actionIndex}
                                    msgIndex={messageIndex}
                                    actionIndex={actionIndex}
                                    action={part.content}
                                    workflow={workflow}
                                    handleApplyChange={handleApplyChange}
                                    appliedChanges={appliedChanges}
                                    stale={false}
                                />;
                            }
                            return null;
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AssistantMessageLoading() {
    return (
        <div className="w-full">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2.5 
                rounded-lg
                border border-gray-200 dark:border-gray-700
                shadow-sm dark:shadow-gray-950/20 animate-pulse min-h-[2.5rem] flex items-center">
                <Spinner size="sm" className="ml-2" />
            </div>
        </div>
    );
}

export function Messages({
    messages,
    loadingResponse,
    workflow,
    handleApplyChange,
    appliedChanges
}: {
    messages: z.infer<typeof CopilotMessage>[];
    loadingResponse: boolean;
    workflow: z.infer<typeof Workflow>;
    handleApplyChange: (messageIndex: number, actionIndex: number, field?: string) => void;
    appliedChanges: Record<string, boolean>;
}) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loadingResponse]);

    const renderMessage = (message: z.infer<typeof CopilotMessage>, messageIndex: number) => {
        if (message.role === 'assistant') {
            return (
                <AssistantMessage
                    key={messageIndex}
                    content={message.content}
                    workflow={workflow}
                    handleApplyChange={handleApplyChange}
                    appliedChanges={appliedChanges}
                    messageIndex={messageIndex}
                />
            );
        }
        
        if (message.role === 'user' && typeof message.content === 'string') {
            return <UserMessage key={messageIndex} content={message.content} />;
        }
        
        return null;
    };

    return (
        <div className="h-full">
            <div className="flex flex-col [&>*]:mb-4">
                {messages.map((message, index) => (
                    <div key={index} className="mb-4">
                        {renderMessage(message, index)}
                    </div>
                ))}
                {loadingResponse && (
                    <div className="animate-pulse">
                        <AssistantMessageLoading />
                    </div>
                )}
            </div>
            <div ref={messagesEndRef} />
        </div>
    );
}