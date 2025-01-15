'use client';
import { Button, Spinner, Textarea } from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import z from "zod";
import { GetInformationToolResult, WebpageCrawlResponse, Workflow, WorkflowTool } from "@/app/lib/types";
import { executeClientTool, getInformationTool, scrapeWebpage, suggestToolResponse } from "@/app/actions";
import MarkdownContent from "@/app/lib/components/markdown-content";
import Link from "next/link";
import { apiV1 } from "rowboat-shared";
import { EditableField } from "@/app/lib/components/editable-field";

function UserMessage({ content }: { content: string }) {
    return <div className="self-end ml-[30%] flex flex-col">
        <div className="text-right text-gray-500 text-sm mr-3">
            User
        </div>
        <div className="bg-gray-100 px-3 py-1 rounded-lg rounded-br-none">
            <MarkdownContent content={content} />
        </div>
    </div>;
}

function InternalAssistantMessage({ content, sender, latency }: { content: string, sender: string | null | undefined, latency: number }) {
    const [expanded, setExpanded] = useState(false);

    // show a message icon with a + symbol to expand and show the content
    return <div className="self-start mr-[30%]">
        {!expanded && <button className="flex items-center text-gray-400 hover:text-gray-600 gap-1 group" onClick={() => setExpanded(true)}>
            <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 10.5h.01m-4.01 0h.01M8 10.5h.01M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-6.6a1 1 0 0 0-.69.275l-2.866 2.723A.5.5 0 0 1 8 18.635V17a1 1 0 0 0-1-1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
            </svg>
            <svg className="group-hover:hidden w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M6 12h.01m6 0h.01m5.99 0h.01" />
            </svg>
            <span className="hidden group-hover:block text-xs">Show debug message</span>
        </button>}
        {expanded && <div className="flex flex-col">
            <div className="flex gap-2 justify-between items-center">
                <div className="text-gray-500 text-sm pl-3">
                    {sender ?? 'Assistant'}
                </div>
                <button className="flex items-center gap-1 text-gray-400 hover:text-gray-600" onClick={() => setExpanded(false)}>
                    <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M6 18 17.94 6M18 18 6.06 6" />
                    </svg>
                </button>
            </div>
            <div className="border border-gray-300 border-dashed px-3 py-1 rounded-lg rounded-bl-none">
                <pre className="text-sm whitespace-pre-wrap">{content}</pre>
            </div>
        </div>}
    </div>;
}

function AssistantMessage({ content, sender, latency }: { content: string, sender: string | null | undefined, latency: number }) {
    return <div className="self-start mr-[30%] flex flex-col">
        <div className="flex gap-2 justify-between items-center">
            <div className="text-gray-500 text-sm pl-3">
                {sender ?? 'Assistant'}
            </div>
            <div className="text-gray-400 text-xs pr-3">
                {Math.round(latency / 1000)}s
            </div>
        </div>
        <div className="bg-gray-100 px-3 py-1 rounded-lg rounded-bl-none">
            <MarkdownContent content={content} />
        </div>
    </div>;
}

function AssistantMessageLoading() {
    return <div className="self-start mr-[30%] flex flex-col">
        <div className="text-gray-500 text-sm ml-3">
            Assistant
        </div>
        <div className="bg-gray-100 p-3 rounded-lg rounded-bl-none animate-pulse w-20">
            <Spinner />
        </div>
    </div>;
}

function UserMessageLoading() {
    return <div className="self-end ml-[30%] flex flex-col">
        <div className="text-right text-gray-500 text-sm mr-3">
            User
        </div>
        <div className="bg-gray-100 p-3 rounded-lg rounded-br-none animate-pulse w-20">
            <Spinner />
        </div>
    </div>;
}

function ToolCalls({
    toolCalls,
    results,
    handleResults,
    projectId,
    messages,
    sender,
    workflow,
}: {
    toolCalls: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'];
    results: Record<string, z.infer<typeof apiV1.ToolMessage>>;
    handleResults: (results: z.infer<typeof apiV1.ToolMessage>[]) => void;
    projectId: string;
    messages: z.infer<typeof apiV1.ChatMessage>[];
    sender: string | null | undefined;
    workflow: z.infer<typeof Workflow>;
}) {
    const resultsMap: Record<string, z.infer<typeof apiV1.ToolMessage>> = {};

    function handleToolCallResult(result: z.infer<typeof apiV1.ToolMessage>) {
        resultsMap[result.tool_call_id] = result;
        if (Object.keys(resultsMap).length === toolCalls.length) {
            const results = Object.values(resultsMap);
            handleResults(results);
        }
    }

    return <div className="flex flex-col gap-4">
        {toolCalls.map(toolCall => {
            return <ToolCall
                key={toolCall.id}
                toolCall={toolCall}
                result={results[toolCall.id]}
                handleResult={handleToolCallResult}
                projectId={projectId}
                messages={messages}
                sender={sender}
                workflow={workflow}
            />
        })}
    </div>;
}

function ToolCall({
    toolCall,
    result,
    handleResult,
    projectId,
    messages,
    sender,
    workflow,
}: {
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number];
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    handleResult: (result: z.infer<typeof apiV1.ToolMessage>) => void;
    projectId: string;
    messages: z.infer<typeof apiV1.ChatMessage>[];
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

    switch (toolCall.function.name) {
        case 'retrieve_url_info':
            return <RetrieveUrlInfoToolCall
                toolCall={toolCall}
                result={result}
                handleResult={handleResult}
                projectId={projectId}
                messages={messages}
                sender={sender}
            />;
        case 'getArticleInfo':
            return <GetInformationToolCall
                toolCall={toolCall}
                result={result}
                handleResult={handleResult}
                projectId={projectId}
                messages={messages}
                sender={sender}
                workflow={workflow}
            />;
        default:
            if (toolCall.function.name.startsWith('transfer_to_')) {
                return <TransferToAgentToolCall
                    toolCall={toolCall}
                    result={result}
                    handleResult={handleResult}
                    projectId={projectId}
                    messages={messages}
                    sender={sender}
                />;
            }
            if (matchingWorkflowTool && !matchingWorkflowTool.mockInPlayground) {
                return <ClientToolCall
                    toolCall={toolCall}
                    result={result}
                    handleResult={handleResult}
                    projectId={projectId}
                    messages={messages}
                    sender={sender}
                />;
            }
            return <MockToolCall
                toolCall={toolCall}
                result={result}
                handleResult={handleResult}
                projectId={projectId}
                messages={messages}
                sender={sender}
            />;
    }
}

function GetInformationToolCall({
    toolCall,
    result: availableResult,
    handleResult,
    projectId,
    messages,
    sender,
    workflow,
}: {
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number];
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    handleResult: (result: z.infer<typeof apiV1.ToolMessage>) => void;
    projectId: string;
    messages: z.infer<typeof apiV1.ChatMessage>[];
    sender: string | null | undefined;
    workflow: z.infer<typeof Workflow>;
}) {
    const [result, setResult] = useState<z.infer<typeof apiV1.ToolMessage> | undefined>(availableResult);
    const args = JSON.parse(toolCall.function.arguments) as { question: string };
    let typedResult: z.infer<typeof GetInformationToolResult> | undefined;
    if (result) {
        typedResult = JSON.parse(result.content) as z.infer<typeof GetInformationToolResult>;
    }

    useEffect(() => {
        if (result) {
            return;
        }
        let ignore = false;

        async function process() {
            const result: z.infer<typeof apiV1.ToolMessage> = {
                role: 'tool',
                tool_call_id: toolCall.id,
                tool_name: toolCall.function.name,
                content: '',
            };
            // find target agent
            const agent = workflow.agents.find(agent => agent.name == sender);
            if (!agent || !agent.ragDataSources) {
                result.content = JSON.stringify({
                    results: [],
                });
            } else {
                const matches = await getInformationTool(projectId, args.question, agent.ragDataSources, agent.ragReturnType, agent.ragK);
                if (ignore) {
                    return;
                }
                result.content = JSON.stringify(matches);
            }
            setResult(result);
            handleResult(result);
        }
        process();

        return () => {
            ignore = true;
        };
    }, [result, toolCall.id, toolCall.function.name, projectId, args.question, workflow.agents, sender, handleResult]);

    return <div className="flex flex-col gap-1">
        {sender && <div className='text-gray-500 text-sm ml-3'>{sender}</div>}
        <div className='border border-gray-300 p-2 rounded-lg rounded-bl-none flex flex-col gap-2 mr-[30%]'>
            <div className='flex gap-2 items-center'>
                {!result && <Spinner />}

                {result && <svg className="w-[16px] h-[16px] text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm13.707-1.293a1 1 0 0 0-1.414-1.414L11 12.586l-1.793-1.793a1 1 0 0 0-1.414 1.414l2.5 2.5a1 1 0 0 0 1.414 0l4-4Z" clipRule="evenodd" />
                </svg>}

                <div className='font-semibold'>
                    Function Call: <span className='bg-gray-100 px-2 py-1 rounded-lg font-mono font-medium'>{toolCall.function.name}</span>
                </div>
            </div>

            <div className='mt-1'>
                {result ? 'Fetched' : 'Fetch'} information for question: <span className='font-mono font-semibold'>{args['question']}</span>
                {result && <div className='flex flex-col gap-2 mt-2 pt-2 border-t border-t-gray-200'>
                    {typedResult && typedResult.results.length === 0 && <div>No matches found.</div>}
                    {typedResult && typedResult.results.length > 0 && <ul className="list-disc ml-6">
                        {typedResult.results.map((result, index) => {
                            return <li key={'' + index}>
                                <Link target="_blank" className="underline" href={result.url}>
                                    {result.url}
                                </Link>
                            </li>
                        })}
                    </ul>
                    }
                </div>}
            </div>
        </div>
    </div>;
}

function RetrieveUrlInfoToolCall({
    toolCall,
    result: availableResult,
    handleResult,
    projectId,
    messages,
    sender,
}: {
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number];
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    handleResult: (result: z.infer<typeof apiV1.ToolMessage>) => void;
    projectId: string;
    messages: z.infer<typeof apiV1.ChatMessage>[];
    sender: string | null | undefined;
}) {
    const [result, setResult] = useState<z.infer<typeof apiV1.ToolMessage> | undefined>(availableResult);
    const args = JSON.parse(toolCall.function.arguments) as { url: string };
    let typedResult: z.infer<typeof WebpageCrawlResponse> | undefined;
    if (result) {
        typedResult = JSON.parse(result.content) as z.infer<typeof WebpageCrawlResponse>;
    }

    useEffect(() => {
        if (result) {
            return;
        }
        let ignore = false;

        function process() {
            // parse args

            scrapeWebpage(args.url)
                .then(page => {
                    if (ignore) {
                        return;
                    }
                    const result: z.infer<typeof apiV1.ToolMessage> = {
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        tool_name: toolCall.function.name,
                        content: JSON.stringify(page),
                    };
                    setResult(result);
                    handleResult(result);
                });
        }
        process();

        return () => {
            ignore = true;
        };
    }, [result, toolCall.id, toolCall.function.name, projectId, args.url, handleResult]);

    return <div className="flex flex-col gap-1">
        {sender && <div className='text-gray-500 text-sm ml-3'>{sender}</div>}
        <div className='border border-gray-300 p-2 rounded-lg rounded-bl-none flex flex-col gap-2 mr-[30%]'>
            <div className='flex gap-2 items-center'>
                {!result && <Spinner />}

                {result && <svg className="w-[16px] h-[16px] text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm13.707-1.293a1 1 0 0 0-1.414-1.414L11 12.586l-1.793-1.793a1 1 0 0 0-1.414 1.414l2.5 2.5a1 1 0 0 0 1.414 0l4-4Z" clipRule="evenodd" />
                </svg>}

                <div className='font-semibold'>
                    Function Call: <span className='bg-gray-100 px-2 py-1 rounded-lg font-mono font-medium'>{toolCall.function.name}</span>
                </div>
            </div>

            <div className='mt-1 flex flex-col gap-2'>
                <div className="flex gap-1">
                    URL: <a className="inline-flex items-center gap-1" target="_blank" href={args.url}>
                        <span className='underline'>
                            {args.url}
                        </span>
                        <svg className="w-[16px] h-[16px] shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M18 14v4.833A1.166 1.166 0 0 1 16.833 20H5.167A1.167 1.167 0 0 1 4 18.833V7.167A1.166 1.166 0 0 1 5.167 6h4.618m4.447-2H20v5.768m-7.889 2.121 7.778-7.778" />
                        </svg>
                    </a>
                </div>
                {result && (
                    <ExpandableContent
                        label='Content'
                        content={JSON.stringify(typedResult, null, 2)}
                        expanded={false}
                    />
                )}
            </div>
        </div>
    </div>;
}

function TransferToAgentToolCall({
    toolCall,
    result: availableResult,
    handleResult,
    projectId,
    messages,
    sender,
}: {
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number];
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    handleResult: (result: z.infer<typeof apiV1.ToolMessage>) => void;
    projectId: string;
    messages: z.infer<typeof apiV1.ChatMessage>[];
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
    handleResult,
    projectId,
    messages,
    sender,
}: {
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number];
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    handleResult: (result: z.infer<typeof apiV1.ToolMessage>) => void;
    projectId: string;
    messages: z.infer<typeof apiV1.ChatMessage>[];
    sender: string | null | undefined;
}) {
    const [result, setResult] = useState<z.infer<typeof apiV1.ToolMessage> | undefined>(availableResult);

    useEffect(() => {
        if (result) {
            return;
        }
        let ignore = false;

        async function process() {
            let response;
            try {
                response = await executeClientTool(
                    toolCall,
                    projectId,
                );
            } catch (e) {
                response = {
                    error: (e as Error).message,
                };
            }
            if (ignore) {
                return;
            }

            const result: z.infer<typeof apiV1.ToolMessage> = {
                role: 'tool',
                tool_call_id: toolCall.id,
                tool_name: toolCall.function.name,
                content: JSON.stringify(response),
            };
            setResult(result);
            handleResult(result);
        }
        process();

        return () => {
            ignore = true;
        };
    }, [result, toolCall, projectId, messages, handleResult]);

    return <div className="flex flex-col gap-1">
        {sender && <div className='text-gray-500 text-sm ml-3'>{sender}</div>}
        <div className='border border-gray-300 p-2 pt-2 rounded-lg rounded-bl-none flex flex-col gap-2 mr-[30%]'>
            <div className='shrink-0 flex gap-2 items-center'>
                {!result && <Spinner />}

                {result && <svg className="w-[16px] h-[16px] text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm13.707-1.293a1 1 0 0 0-1.414-1.414L11 12.586l-1.793-1.793a1 1 0 0 0-1.414 1.414l2.5 2.5a1 1 0 0 0 1.414 0l4-4Z" clipRule="evenodd" />
                </svg>}

                <div className='font-semibold'>
                    Function Call: <span className='bg-gray-100 px-2 py-1 rounded-lg font-mono font-medium'>{toolCall.function.name}</span>
                </div>
            </div>
            <div className='flex flex-col gap-2'>
                <ExpandableContent label='Arguments' content={JSON.stringify(toolCall.function.arguments, null, 2)} expanded={Boolean(!result)} />
                {result && <ExpandableContent label='Result' content={JSON.stringify(result.content, null, 2)} expanded={true} />}
            </div>
        </div>
    </div>;
}

function MockToolCall({
    toolCall,
    result: availableResult,
    handleResult,
    projectId,
    messages,
    sender,
}: {
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number];
    result: z.infer<typeof apiV1.ToolMessage> | undefined;
    handleResult: (result: z.infer<typeof apiV1.ToolMessage>) => void;
    projectId: string;
    messages: z.infer<typeof apiV1.ChatMessage>[];
    sender: string | null | undefined;
}) {
    const [result, setResult] = useState<z.infer<typeof apiV1.ToolMessage> | undefined>(availableResult);
    const [response, setResponse] = useState('');
    const [generatingResponse, setGeneratingResponse] = useState(false);

    useEffect(() => {
        if (result) {
            return;
        }
        if (response) {
            return;
        }
        let ignore = false;

        function process() {
            setGeneratingResponse(true);

            suggestToolResponse(toolCall.id, projectId, messages)
                .then((object) => {
                    if (ignore) {
                        return;
                    }
                    setResponse(JSON.stringify(object));
                })
                .finally(() => {
                    if (ignore) {
                        return;
                    }
                    setGeneratingResponse(false);
                })
        }
        process();

        return () => {
            ignore = true;
        };
    }, [result, response, toolCall.id, projectId, messages]);

    function handleSubmit() {
        let parsed;
        try {
            parsed = JSON.parse(response);
        } catch (e) {
            alert('Invalid JSON');
            return;
        }
        const result: z.infer<typeof apiV1.ToolMessage> = {
            role: 'tool',
            tool_call_id: toolCall.id,
            tool_name: toolCall.function.name,
            content: JSON.stringify(parsed),
        };
        setResult(result);
        handleResult(result);
    }

    return <div className="flex flex-col gap-1">
        {sender && <div className='text-gray-500 text-sm ml-3'>{sender}</div>}
        <div className='border border-gray-300 p-2 pt-2 rounded-lg rounded-bl-none flex flex-col gap-2 mr-[30%]'>
            <div className='shrink-0 flex gap-2 items-center'>
                {!result && <Spinner />}

                {result && <svg className="w-[16px] h-[16px] text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm13.707-1.293a1 1 0 0 0-1.414-1.414L11 12.586l-1.793-1.793a1 1 0 0 0-1.414 1.414l2.5 2.5a1 1 0 0 0 1.414 0l4-4Z" clipRule="evenodd" />
                </svg>}

                <div className='font-semibold'>
                    Function Call: <span className='bg-gray-100 px-2 py-1 rounded-lg font-mono font-medium'>{toolCall.function.name}</span>
                </div>
            </div>
            <div className='flex flex-col gap-2'>
                <ExpandableContent label='Arguments' content={JSON.stringify(toolCall.function.arguments, null, 2)} expanded={Boolean(!result)} />
                {result && <ExpandableContent label='Result' content={JSON.stringify(result.content, null, 2)} expanded={true} />}
            </div>
            {!result && <div className='flex flex-col gap-2 mt-2'>
                <div>Response:</div>
                <Textarea
                    maxRows={10}
                    placeholder='{}'
                    variant="bordered"
                    value={response}
                    disabled={generatingResponse}
                    onValueChange={(value) => setResponse(value)}
                    className='font-mono'
                >
                </Textarea>
                <Button
                    onClick={handleSubmit}
                    disabled={generatingResponse}
                    isLoading={generatingResponse}
                >
                    Submit result
                </Button>
            </div>}
        </div>
    </div>;
}

function ExpandableContent({
    label,
    content,
    expanded = false
}: {
    label: string,
    content: string
    expanded?: boolean
}) {
    const [isExpanded, setIsExpanded] = useState(expanded);

    function toggleExpanded() {
        setIsExpanded(!isExpanded);
    }

    return <div className='flex flex-col gap-2'>
        <div className='flex gap-2 items-start cursor-pointer' onClick={toggleExpanded}>
            {!isExpanded && <svg className="mt-1 w-[16px] h-[16px] shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 7.757v8.486M7.757 12h8.486M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>}
            {isExpanded && <svg className="mt-1 w-[16px] h-[16px] shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M7.757 12h8.486M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>}
            <div className='text-left break-all'>{label}</div>
        </div>
        {isExpanded && <div className='text-sm font-mono bg-gray-100 p-2 rounded break-all'>
            {content}
        </div>}
    </div>;
}

function SystemMessage({
    content,
    onChange,
    locked
}: {
    content: string,
    onChange: (content: string) => void,
    locked: boolean
}) {
    return (
        <div className="border border-gray-300 p-2 rounded-lg flex flex-col gap-2">
            <EditableField
                light
                label="System message"
                value={content}
                onChange={onChange}
                multiline
                markdown
                locked={locked}
                placeholder={`Use this space to simulate user information provided to the assistant at start of chat. Example:
- userName: John Doe
- email: john@gmail.com 
                
This is intended for testing only.`}
            />
        </div>
    );
}

export function Messages({
    projectId,
    systemMessage,
    messages,
    toolCallResults,
    handleToolCallResults,
    loadingAssistantResponse,
    loadingUserResponse,
    workflow,
    onSystemMessageChange,
}: {
    projectId: string;
    systemMessage: string | undefined;
    messages: z.infer<typeof apiV1.ChatMessage>[];
    toolCallResults: Record<string, z.infer<typeof apiV1.ToolMessage>>;
    handleToolCallResults: (results: z.infer<typeof apiV1.ToolMessage>[]) => void;
    loadingAssistantResponse: boolean;
    loadingUserResponse: boolean;
    workflow: z.infer<typeof Workflow>;
    onSystemMessageChange: (message: string) => void;
}) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    let lastUserMessageTimestamp = 0;

    const systemMessageLocked = messages.length > 0;

    // scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, loadingAssistantResponse, loadingUserResponse]);

    return <div className="grow pt-4 overflow-auto">
        <div className="max-w-[768px] mx-auto flex flex-col gap-8">
            <SystemMessage 
                content={systemMessage || ''} 
                onChange={onSystemMessageChange}
                locked={systemMessageLocked}
            />
            {messages.map((message, index) => {
                if (message.role === 'assistant') {
                    if ('tool_calls' in message) {
                        return <ToolCalls
                            key={index}
                            toolCalls={message.tool_calls}
                            results={toolCallResults}
                            handleResults={handleToolCallResults}
                            projectId={projectId}
                            messages={messages}
                            sender={message.agenticSender}
                            workflow={workflow}
                        />;
                    } else {
                        // the assistant message createdAt is an ISO string timestamp
                        const latency = new Date(message.createdAt).getTime() - lastUserMessageTimestamp;
                        if (message.agenticResponseType === 'internal') {
                            return (
                                <InternalAssistantMessage
                                    key={index}
                                    content={message.content}
                                    sender={message.agenticSender}
                                    latency={latency}
                                />
                            );
                        } else {
                            return (
                                <AssistantMessage
                                    key={index}
                                    content={message.content}
                                    sender={message.agenticSender}
                                    latency={latency}
                                />
                            );
                        }
                    }
                }
                if (message.role === 'user' && typeof message.content === 'string') {
                    lastUserMessageTimestamp = new Date(message.createdAt).getTime();
                    return <UserMessage key={index} content={message.content} />;
                }
                return <></>;
            })}
            {loadingAssistantResponse && <AssistantMessageLoading key="assistant-loading" />}
            {loadingUserResponse && <UserMessageLoading key="user-loading" />}
            <div ref={messagesEndRef} />
        </div>
    </div>;
}