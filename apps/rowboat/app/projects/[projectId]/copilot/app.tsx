'use client';
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger, Spinner, Tooltip } from "@heroui/react";
import { useRef, useState, createContext, useContext, useCallback, forwardRef, useImperativeHandle, useEffect, Ref } from "react";
import { CopilotChatContext } from "../../../lib/types/copilot_types";
import { CopilotMessage } from "../../../lib/types/copilot_types";
import { Workflow } from "@/app/lib/types/workflow_types";
import { DataSource } from "@/app/lib/types/datasource_types";
import { z } from "zod";
import { Action as WorkflowDispatch } from "../workflow/workflow_editor";
import { Panel } from "@/components/common/panel-common";
import { ComposeBoxCopilot } from "@/components/common/compose-box-copilot";
import { Messages } from "./components/messages";
import { CopyIcon, CheckIcon, PlusIcon, XIcon, InfoIcon } from "lucide-react";
import { useCopilot } from "./use-copilot";
import { BillingUpgradeModal } from "@/components/common/billing-upgrade-modal";
import { WithStringId } from "@/app/lib/types/types";

const CopilotContext = createContext<{
    workflow: z.infer<typeof Workflow> | null;
    dispatch: (action: any) => void;
}>({ workflow: null, dispatch: () => { } });

export function getAppliedChangeKey(messageIndex: number, actionIndex: number, field: string) {
    return `${messageIndex}-${actionIndex}-${field}`;
}

interface AppProps {
    projectId: string;
    workflow: z.infer<typeof Workflow>;
    dispatch: (action: any) => void;
    chatContext?: any;
    onCopyJson?: (data: { messages: any[] }) => void;
    onMessagesChange?: (messages: z.infer<typeof CopilotMessage>[]) => void;
    isInitialState?: boolean;
    dataSources?: WithStringId<z.infer<typeof DataSource>>[];
}

const App = forwardRef<{ handleCopyChat: () => void; handleUserMessage: (message: string) => void }, AppProps>(function App({
    projectId,
    workflow,
    dispatch,
    chatContext = undefined,
    onCopyJson,
    onMessagesChange,
    isInitialState = false,
    dataSources,
}, ref) {
    const [messages, setMessages] = useState<z.infer<typeof CopilotMessage>[]>([]);
    const [discardContext, setDiscardContext] = useState(false);
    const [isLastInteracted, setIsLastInteracted] = useState(isInitialState);
    const workflowRef = useRef(workflow);
    const startRef = useRef<any>(null);
    const cancelRef = useRef<any>(null);

    // Keep workflow ref up to date
    workflowRef.current = workflow;

    // Get the effective context based on user preference
    const effectiveContext = discardContext ? null : chatContext;

    const {
        streamingResponse,
        loading: loadingResponse,
        error: responseError,
        clearError: clearResponseError,
        billingError,
        clearBillingError,
        start,
        cancel
    } = useCopilot({
        projectId,
        workflow: workflowRef.current,
        context: effectiveContext,
        dataSources: dataSources
    });

    // Store latest start/cancel functions in refs
    startRef.current = start;
    cancelRef.current = cancel;

    // Notify parent of message changes
    useEffect(() => {
        onMessagesChange?.(messages);
    }, [messages, onMessagesChange]);

    // Check for initial prompt in local storage and send it
    useEffect(() => {
        const prompt = localStorage.getItem(`project_prompt_${projectId}`);
        if (prompt && messages.length === 0) {
            localStorage.removeItem(`project_prompt_${projectId}`);
            setMessages([{
                role: 'user',
                content: prompt
            }]);
        }
    }, [projectId, messages.length]);

    // Reset discardContext when chatContext changes
    useEffect(() => {
        setDiscardContext(false);
    }, [chatContext]);

    function handleUserMessage(prompt: string) {
        setMessages(currentMessages => [...currentMessages, {
            role: 'user',
            content: prompt
        }]);
        setIsLastInteracted(true);
    }

    // Effect for getting copilot response
    useEffect(() => {
        if (!messages.length || messages.at(-1)?.role !== 'user') return;

        if (responseError) {
            return;
        }

        const currentStart = startRef.current;
        const currentCancel = cancelRef.current;

        currentStart(messages, (finalResponse: string) => {
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: finalResponse
                }
            ]);
        });

        return () => currentCancel();
    }, [messages, responseError]);

    const handleCopyChat = useCallback(() => {
        if (onCopyJson) {
            onCopyJson({
                messages,
            });
        }
    }, [messages, onCopyJson]);

    useImperativeHandle(ref, () => ({
        handleCopyChat,
        handleUserMessage
    }), [handleCopyChat]);

    return (
        <CopilotContext.Provider value={{ workflow: workflowRef.current, dispatch }}>
            <div className="h-full flex flex-col">
                <div className="flex-1 overflow-auto">
                    <Messages
                        messages={messages}
                        streamingResponse={streamingResponse}
                        loadingResponse={loadingResponse}
                        workflow={workflowRef.current}
                        dispatch={dispatch}
                    />
                </div>
                <div className="shrink-0 px-1 pb-6">
                    {responseError && (
                        <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-2 justify-between items-center text-sm">
                            <p className="text-red-600 dark:text-red-400">{responseError}</p>
                            <Button
                                size="sm"
                                color="danger"
                                onClick={() => {
                                    // remove the last assistant message, if any
                                    setMessages(prev => {
                                        const lastMessage = prev[prev.length - 1];
                                        if (lastMessage?.role === 'assistant') {
                                            return prev.slice(0, -1);
                                        }
                                        return prev;
                                    });
                                    clearResponseError();
                                }}
                            >
                                Retry
                            </Button>
                        </div>
                    )}
                    {effectiveContext && (
                        <div className="flex items-start mb-2">
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/40 shadow-sm text-sm font-medium text-zinc-700 dark:text-zinc-200 transition-all">
                                {/* Context icon (no background) */}
                                {effectiveContext.type === 'chat' && (
                                    <svg className="w-4 h-4 text-blue-500 dark:text-blue-300 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10c0 3.866-3.582 7-8 7a8.96 8.96 0 01-4.39-1.11L2 17l1.11-2.61A8.96 8.96 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" /></svg>
                                )}
                                {effectiveContext.type === 'agent' && (
                                    <svg className="w-4 h-4 text-green-500 dark:text-green-300 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 016 6c0 2.21-1.343 4.09-3.25 5.25A4.992 4.992 0 0110 18a4.992 4.992 0 01-2.75-4.75C5.343 12.09 4 10.21 4 8a6 6 0 016-6z" /></svg>
                                )}
                                {effectiveContext.type === 'tool' && (
                                    <svg className="w-4 h-4 text-yellow-500 dark:text-yellow-300 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M13.293 2.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-8.5 8.5a1 1 0 01-.293.207l-4 2a1 1 0 01-1.316-1.316l2-4a1 1 0 01.207-.293l8.5-8.5z" /></svg>
                                )}
                                {effectiveContext.type === 'prompt' && (
                                    <svg className="w-4 h-4 text-purple-500 dark:text-purple-300 mr-1" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" /></svg>
                                )}
                                {/* Context label */}
                                <span>
                                    {effectiveContext.type === 'chat' && "Chat"}
                                    {effectiveContext.type === 'agent' && `Agent: ${effectiveContext.name}`}
                                    {effectiveContext.type === 'tool' && `Tool: ${effectiveContext.name}`}
                                    {effectiveContext.type === 'prompt' && `Prompt: ${effectiveContext.name}`}
                                </span>
                                {/* Close button */}
                                <button
                                    className="ml-2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors duration-150 rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    onClick={() => setDiscardContext(true)}
                                    aria-label="Close context"
                                >
                                    <XIcon size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                    <ComposeBoxCopilot
                        handleUserMessage={handleUserMessage}
                        messages={messages}
                        loading={loadingResponse}
                        initialFocus={isInitialState}
                        shouldAutoFocus={isLastInteracted}
                        onFocus={() => setIsLastInteracted(true)}
                        onCancel={cancel}
                    />
                </div>
            </div>
            <BillingUpgradeModal
                isOpen={!!billingError}
                onClose={clearBillingError}
                errorMessage={billingError || ''}
            />
        </CopilotContext.Provider>
    );
});

App.displayName = 'App';

export const Copilot = forwardRef<{ handleUserMessage: (message: string) => void }, {
    projectId: string;
    workflow: z.infer<typeof Workflow>;
    chatContext?: z.infer<typeof CopilotChatContext>;
    dispatch: (action: WorkflowDispatch) => void;
    isInitialState?: boolean;
    dataSources?: WithStringId<z.infer<typeof DataSource>>[];
}>(({
    projectId,
    workflow,
    chatContext = undefined,
    dispatch,
    isInitialState = false,
    dataSources,
}, ref) => {
    const [copilotKey, setCopilotKey] = useState(0);
    const [showCopySuccess, setShowCopySuccess] = useState(false);
    const [messages, setMessages] = useState<z.infer<typeof CopilotMessage>[]>([]);
    const [billingError, setBillingError] = useState<string | null>(null);
    const appRef = useRef<{ handleCopyChat: () => void; handleUserMessage: (message: string) => void }>(null);

    function handleNewChat() {
        setCopilotKey(prev => prev + 1);
        setMessages([]);
    }

    function handleCopyJson(data: { messages: any[] }) {
        const jsonString = JSON.stringify(data, null, 2);
        navigator.clipboard.writeText(jsonString);
        setShowCopySuccess(true);
        setTimeout(() => {
            setShowCopySuccess(false);
        }, 2000);
    }

    // Expose handleUserMessage through ref
    useImperativeHandle(ref, () => ({
        handleUserMessage: (message: string) => {
            const app = appRef.current as any;
            if (app?.handleUserMessage) {
                app.handleUserMessage(message);
            }
        }
    }), []);

    return (
        <>
            <Panel 
                variant="copilot"
                tourTarget="copilot"
                showWelcome={messages.length === 0}
                title={
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="font-semibold text-zinc-700 dark:text-zinc-300">
                                Skipper
                            </div>
                            <Tooltip content="A copilot to help you build and modify your workflow">
                                <InfoIcon className="w-4 h-4 text-gray-400 cursor-help" />
                            </Tooltip>
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleNewChat}
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100"
                            showHoverContent={true}
                            hoverContent="New chat"
                        >
                            <PlusIcon className="w-4 h-4" />
                        </Button>
                    </div>
                }
                rightActions={
                    <div className="flex items-center gap-3">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => appRef.current?.handleCopyChat()}
                            showHoverContent={true}
                            hoverContent={showCopySuccess ? "Copied" : "Copy JSON"}
                        >
                            {showCopySuccess ? (
                                <CheckIcon className="w-4 h-4" />
                            ) : (
                                <CopyIcon className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                }
            >
                <div className="h-full overflow-auto px-3 pt-4">
                    <App
                        key={copilotKey}
                        ref={appRef}
                        projectId={projectId}
                        workflow={workflow}
                        dispatch={dispatch}
                        chatContext={chatContext}
                        onCopyJson={handleCopyJson}
                        onMessagesChange={setMessages}
                        isInitialState={isInitialState}
                        dataSources={dataSources}
                    />
                </div>
            </Panel>
        </>
    );
});

Copilot.displayName = 'Copilot';

