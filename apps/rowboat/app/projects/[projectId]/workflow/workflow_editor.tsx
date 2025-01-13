"use client";
import { DataSource, Workflow, WorkflowAgent, WorkflowPrompt, WorkflowTool, WithStringId } from "@/app/lib/types";
import { useReducer, Reducer, useState, useCallback, useEffect, useRef } from "react";
import { produce, applyPatches, enablePatches, produceWithPatches, Patch } from 'immer';
import { AgentConfig } from "./agent_config";
import { ToolConfig } from "./tool_config";
import { App as ChatApp } from "../playground/app";
import { z } from "zod";
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger, Spinner } from "@nextui-org/react";
import { PromptConfig } from "./prompt_config";
import { AgentsList } from "./agents_list";
import { PromptsList } from "./prompts_list";
import { ToolsList } from "./tools_list";
import { EditableField } from "@/app/lib/components/editable-field";
import { RelativeTime } from "@primer/react";

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Copilot } from "./copilot";
import { apiV1 } from "rowboat-shared";
import { publishWorkflow, renameWorkflow, saveWorkflow } from "@/app/actions";
import { PublishedBadge } from "./published_badge";
import { BackIcon, HamburgerIcon, WorkflowIcon } from "@/app/lib/components/icons";
import { ClipboardIcon, Layers2Icon, RadioIcon } from "lucide-react";

enablePatches();

interface StateItem {
    workflow: WithStringId<z.infer<typeof Workflow>>;
    publishedWorkflowId: string | null;
    publishing: boolean;
    selection: {
        type: "agent" | "tool" | "prompt";
        name: string;
    } | null;
    saving: boolean;
    publishError: string | null;
    publishSuccess: boolean;
    pendingChanges: boolean;
    chatKey: number;
}

interface State {
    present: StateItem;
    patches: Patch[][];
    inversePatches: Patch[][];
    currentIndex: number;
}

export type Action = {
    type: "update_workflow_name";
    name: string;
} | {
    type: "set_publishing";
    publishing: boolean;
} | {
    type: "set_published_workflow_id";
    workflowId: string;
} | {
    type: "add_agent";
    agent: Partial<z.infer<typeof WorkflowAgent>>;
} | {
    type: "add_tool";
    tool: Partial<z.infer<typeof WorkflowTool>>;
} | {
    type: "add_prompt";
    prompt: Partial<z.infer<typeof WorkflowPrompt>>;
} | {
    type: "select_agent";
    name: string;
} | {
    type: "select_tool";
    name: string;
} | {
    type: "delete_agent";
    name: string;
} | {
    type: "delete_tool";
    name: string;
} | {
    type: "update_agent";
    name: string;
    agent: Partial<z.infer<typeof WorkflowAgent>>;
} | {
    type: "update_tool";
    name: string;
    tool: Partial<z.infer<typeof WorkflowTool>>;
} | {
    type: "set_saving";
    saving: boolean;
} | {
    type: "unselect_agent";
} | {
    type: "unselect_tool";
} | {
    type: "undo";
} | {
    type: "redo";
} | {
    type: "select_prompt";
    name: string;
} | {
    type: "unselect_prompt";
} | {
    type: "delete_prompt";
    name: string;
} | {
    type: "update_prompt";
    name: string;
    prompt: Partial<z.infer<typeof WorkflowPrompt>>;
} | {
    type: "toggle_agent";
    name: string;
} | {
    type: "set_main_agent";
    name: string;
} | {
    type: "set_publish_error";
    error: string | null;
} | {
    type: "set_publish_success";
    success: boolean;
} | {
    type: "restore_state";
    state: StateItem;
};

function reducer(state: State, action: Action): State {
    console.log('running reducer', action);
    let newState: State;

    if (action.type === "restore_state") {
        return {
            present: action.state,
            patches: [],
            inversePatches: [],
            currentIndex: 0
        };
    }

    const isLive = state.present.workflow._id == state.present.publishedWorkflowId;

    switch (action.type) {
        case "undo": {
            if (state.currentIndex <= 0) return state;
            newState = produce(state, draft => {
                const inverse = state.inversePatches[state.currentIndex - 1];
                draft.present = applyPatches(state.present, inverse);
                draft.currentIndex--;
            });
            break;
        }
        case "redo": {
            if (state.currentIndex >= state.patches.length) return state;
            newState = produce(state, draft => {
                const patch = state.patches[state.currentIndex];
                draft.present = applyPatches(state.present, patch);
                draft.currentIndex++;
            });
            break;
        }
        case "update_workflow_name": {
            newState = produce(state, draft => {
                draft.present.workflow.name = action.name;
            });
            break;
        }
        case "set_publishing": {
            newState = produce(state, draft => {
                draft.present.publishing = action.publishing;
            });
            break;
        }
        case "set_published_workflow_id": {
            newState = produce(state, draft => {
                draft.present.publishedWorkflowId = action.workflowId;
            });
            break;
        }
        case "set_publish_error": {
            newState = produce(state, draft => {
                draft.present.publishError = action.error;
            });
            break;
        }
        case "set_publish_success": {
            newState = produce(state, draft => {
                draft.present.publishSuccess = action.success;
            });
            break;
        }
        case "set_saving": {
            newState = produce(state, draft => {
                draft.present.saving = action.saving;
                draft.present.pendingChanges = action.saving;
                draft.present.workflow.lastUpdatedAt = !action.saving ? new Date().toISOString() : state.present.workflow.lastUpdatedAt;
            });
            break;
        }
        default: {
            const [nextState, patches, inversePatches] = produceWithPatches(
                state.present,
                (draft) => {
                    switch (action.type) {
                        case "select_agent":
                            draft.selection = {
                                type: "agent",
                                name: action.name
                            };
                            break;
                        case "select_tool":
                            draft.selection = {
                                type: "tool",
                                name: action.name
                            };
                            break;
                        case "select_prompt":
                            draft.selection = {
                                type: "prompt",
                                name: action.name
                            };
                            break;
                        case "unselect_agent":
                        case "unselect_tool":
                        case "unselect_prompt":
                            draft.selection = null;
                            break;
                        case "add_agent": {
                            if (isLive) {
                                break;
                            }
                            let newAgentName = "New agent";
                            if (draft.workflow?.agents.some((agent) => agent.name === newAgentName)) {
                                newAgentName = `New agent ${draft.workflow.agents.filter((agent) =>
                                    agent.name.startsWith("New agent")).length + 1}`;
                            }
                            draft.workflow?.agents.push({
                                name: newAgentName,
                                type: "conversation",
                                description: "",
                                disabled: false,
                                instructions: "",
                                prompts: [],
                                tools: [],
                                model: "gpt-4o-mini",
                                locked: false,
                                toggleAble: true,
                                ragReturnType: "chunks",
                                ragK: 3,
                                connectedAgents: [],
                                controlType: "retain",
                                ...action.agent
                            });
                            draft.selection = {
                                type: "agent",
                                name: action.agent.name || newAgentName
                            };
                            draft.pendingChanges = true;
                            break;
                        }
                        case "add_tool": {
                            if (isLive) {
                                break;
                            }
                            let newToolName = "New tool";
                            if (draft.workflow?.tools.some((tool) => tool.name === newToolName)) {
                                newToolName = `New tool ${draft.workflow.tools.filter((tool) =>
                                    tool.name.startsWith("New tool")).length + 1}`;
                            }
                            draft.workflow?.tools.push({
                                name: newToolName,
                                description: "",
                                parameters: undefined,
                                mockInPlayground: true,
                                ...action.tool
                            });
                            draft.selection = {
                                type: "tool",
                                name: action.tool.name || newToolName
                            };
                            draft.pendingChanges = true;
                            break;
                        }
                        case "add_prompt": {
                            if (isLive) {
                                break;
                            }
                            let newPromptName = "New prompt";
                            if (draft.workflow?.prompts.some((prompt) => prompt.name === newPromptName)) {
                                newPromptName = `New prompt ${draft.workflow?.prompts.filter((prompt) =>
                                    prompt.name.startsWith("New prompt")).length + 1}`;
                            }
                            draft.workflow?.prompts.push({
                                name: newPromptName,
                                type: "base_prompt",
                                prompt: "",
                                ...action.prompt
                            });
                            draft.selection = {
                                type: "prompt",
                                name: action.prompt.name || newPromptName
                            };
                            draft.pendingChanges = true;
                            break;
                        }
                        case "delete_agent":
                            if (isLive) {
                                break;
                            }
                            draft.workflow.agents = draft.workflow.agents.filter(
                                (agent) => agent.name !== action.name
                            );
                            draft.selection = null;
                            draft.pendingChanges = true;
                            draft.chatKey++;
                            break;
                        case "delete_tool":
                            if (isLive) {
                                break;
                            }
                            draft.workflow.tools = draft.workflow.tools.filter(
                                (tool) => tool.name !== action.name
                            );
                            draft.workflow.agents = draft.workflow.agents.map(agent => ({
                                ...agent,
                                tools: agent.tools.filter(toolName => toolName !== action.name)
                            }));
                            draft.selection = null;
                            draft.pendingChanges = true;
                            draft.chatKey++;
                            break;
                        case "delete_prompt":
                            if (isLive) {
                                break;
                            }
                            draft.workflow.prompts = draft.workflow.prompts.filter(
                                (prompt) => prompt.name !== action.name
                            );
                            draft.workflow.agents = draft.workflow.agents.map(agent => ({
                                ...agent,
                                prompts: agent.prompts.filter(promptName => promptName !== action.name)
                            }));
                            draft.selection = null;
                            draft.pendingChanges = true;
                            draft.chatKey++;
                            break;
                        case "update_agent":
                            if (isLive) {
                                break;
                            }
                            draft.workflow.agents = draft.workflow.agents.map((agent) =>
                                agent.name === action.name ? { ...agent, ...action.agent } : agent
                            );
                            if (action.agent.name && draft.workflow.startAgent === action.name) {
                                draft.workflow.startAgent = action.agent.name;
                            }
                            if (action.agent.name && action.agent.name !== action.name) {
                                draft.workflow.agents = draft.workflow.agents.map(agent => ({
                                    ...agent,
                                    connectedAgents: agent.connectedAgents.map(connectedAgent =>
                                        connectedAgent === action.name ? action.agent.name! : connectedAgent
                                    )
                                }));
                            }
                            if (action.agent.name && draft.selection?.type === "agent" && draft.selection.name === action.name) {
                                draft.selection = {
                                    type: "agent",
                                    name: action.agent.name
                                };
                            }
                            draft.selection = {
                                type: "agent",
                                name: action.agent.name || action.name,
                            };
                            draft.pendingChanges = true;
                            draft.chatKey++;
                            break;
                        case "update_tool":
                            if (isLive) {
                                break;
                            }
                            draft.workflow.tools = draft.workflow.tools.map((tool) =>
                                tool.name === action.name ? { ...tool, ...action.tool } : tool
                            );
                            if (action.tool.name && action.tool.name !== action.name) {
                                draft.workflow.agents = draft.workflow.agents.map(agent => ({
                                    ...agent,
                                    tools: agent.tools.map(toolName =>
                                        toolName === action.name ? action.tool.name! : toolName
                                    )
                                }));
                            }
                            if (action.tool.name && draft.selection?.type === "tool" && draft.selection.name === action.name) {
                                draft.selection = {
                                    type: "tool",
                                    name: action.tool.name
                                };
                            }
                            draft.selection = {
                                type: "tool",
                                name: action.tool.name || action.name,
                            };
                            draft.pendingChanges = true;
                            draft.chatKey++;
                            break;
                        case "update_prompt":
                            if (isLive) {
                                break;
                            }
                            draft.workflow.prompts = draft.workflow.prompts.map((prompt) =>
                                prompt.name === action.name ? { ...prompt, ...action.prompt } : prompt
                            );
                            draft.workflow.agents = draft.workflow.agents.map(agent => ({
                                ...agent,
                                prompts: agent.prompts.map(promptName =>
                                    promptName === action.name ? action.prompt.name! : promptName
                                )
                            }));
                            if (action.prompt.name && draft.selection?.type === "prompt" && draft.selection.name === action.name) {
                                draft.selection = {
                                    type: "prompt",
                                    name: action.prompt.name
                                };
                            }
                            draft.selection = {
                                type: "prompt",
                                name: action.prompt.name || action.name,
                            };
                            draft.pendingChanges = true;
                            draft.chatKey++;
                            break;
                        case "toggle_agent":
                            if (isLive) {
                                break;
                            }
                            draft.workflow.agents = draft.workflow.agents.map(agent =>
                                agent.name === action.name ? { ...agent, disabled: !agent.disabled } : agent
                            );
                            draft.chatKey++;
                            break;
                        case "set_main_agent":
                            if (isLive) {
                                break;
                            }
                            draft.workflow.startAgent = action.name;
                            draft.chatKey++;
                            break;
                    }
                }
            );

            newState = produce(state, draft => {
                draft.patches.splice(state.currentIndex);
                draft.inversePatches.splice(state.currentIndex);
                draft.patches.push(patches);
                draft.inversePatches.push(inversePatches);
                draft.currentIndex++;
                draft.present = nextState;
            });

        }
    }

    return newState;
}

export function WorkflowEditor({
    dataSources,
    workflow,
    publishedWorkflowId,
    handleShowSelector,
    handleCloneVersion,
}: {
    dataSources: WithStringId<z.infer<typeof DataSource>>[];
    workflow: WithStringId<z.infer<typeof Workflow>>;
    publishedWorkflowId: string | null;
    handleShowSelector: () => void;
    handleCloneVersion: (workflowId: string) => void;
}) {
    const [state, dispatch] = useReducer<Reducer<State, Action>>(reducer, {
        patches: [],
        inversePatches: [],
        currentIndex: 0,
        present: {
            publishing: false,
            selection: null,
            workflow: workflow,
            publishedWorkflowId: publishedWorkflowId,
            saving: false,
            publishError: null,
            publishSuccess: false,
            pendingChanges: false,
            chatKey: 0,
        }
    });
    const [chatMessages, setChatMessages] = useState<z.infer<typeof apiV1.ChatMessage>[]>([]);
    const updateChatMessages = useCallback((messages: z.infer<typeof apiV1.ChatMessage>[]) => {
        setChatMessages(messages);
    }, []);
    const saveQueue = useRef<z.infer<typeof Workflow>[]>([]);
    const saving = useRef(false);
    const isLive = state.present.workflow._id == state.present.publishedWorkflowId;
    const [showCopySuccess, setShowCopySuccess] = useState(false);

    console.log(`workflow editor chat key: ${state.present.chatKey}`);

    function handleSelectAgent(name: string) {
        dispatch({ type: "select_agent", name });
    }

    function handleSelectTool(name: string) {
        dispatch({ type: "select_tool", name });
    }

    function handleSelectPrompt(name: string) {
        dispatch({ type: "select_prompt", name });
    }

    function handleUnselectAgent() {
        dispatch({ type: "unselect_agent" });
    }

    function handleUnselectTool() {
        dispatch({ type: "unselect_tool" });
    }

    function handleUnselectPrompt() {
        dispatch({ type: "unselect_prompt" });
    }

    function handleAddAgent(agent: Partial<z.infer<typeof WorkflowAgent>> = {}) {
        dispatch({ type: "add_agent", agent });
    }

    function handleAddTool(tool: Partial<z.infer<typeof WorkflowTool>> = {}) {
        dispatch({ type: "add_tool", tool });
    }

    function handleAddPrompt(prompt: Partial<z.infer<typeof WorkflowPrompt>> = {}) {
        dispatch({ type: "add_prompt", prompt });
    }

    function handleUpdateAgent(name: string, agent: Partial<z.infer<typeof WorkflowAgent>>) {
        dispatch({ type: "update_agent", name, agent });
    }

    function handleDeleteAgent(name: string) {
        if (window.confirm(`Are you sure you want to delete the agent "${name}"?`)) {
            dispatch({ type: "delete_agent", name });
        }
    }

    function handleUpdateTool(name: string, tool: Partial<z.infer<typeof WorkflowTool>>) {
        dispatch({ type: "update_tool", name, tool });
    }

    function handleDeleteTool(name: string) {
        if (window.confirm(`Are you sure you want to delete the tool "${name}"?`)) {
            dispatch({ type: "delete_tool", name });
        }
    }

    function handleUpdatePrompt(name: string, prompt: Partial<z.infer<typeof WorkflowPrompt>>) {
        dispatch({ type: "update_prompt", name, prompt });
    }

    function handleDeletePrompt(name: string) {
        if (window.confirm(`Are you sure you want to delete the prompt "${name}"?`)) {
            dispatch({ type: "delete_prompt", name });
        }
    }

    function handleToggleAgent(name: string) {
        dispatch({ type: "toggle_agent", name });
    }

    function handleSetMainAgent(name: string) {
        dispatch({ type: "set_main_agent", name });
    }

    async function handleRenameWorkflow(name: string) {
        await renameWorkflow(state.present.workflow.projectId, state.present.workflow._id, name);
        dispatch({ type: "update_workflow_name", name });
    }

    async function handlePublishWorkflow() {
        dispatch({ type: "set_publishing", publishing: true });
        await publishWorkflow(state.present.workflow.projectId, state.present.workflow._id);
        dispatch({ type: "set_publishing", publishing: false });
        dispatch({ type: "set_published_workflow_id", workflowId: state.present.workflow._id });
    }

    function handleCopyJSON() {
        const { _id, projectId, ...workflow } = state.present.workflow;
        const json = JSON.stringify(workflow, null, 2);
        navigator.clipboard.writeText(json);
        setShowCopySuccess(true);
        setTimeout(() => {
            setShowCopySuccess(false);
        }, 1500);
    }

    const processQueue = useCallback(async (state: State, dispatch: React.Dispatch<Action>) => {
        if (saving.current || saveQueue.current.length === 0) return;

        saving.current = true;
        const workflowToSave = saveQueue.current[saveQueue.current.length - 1];
        saveQueue.current = [];

        try {
            if (isLive) {
                return;
            } else {
                await saveWorkflow(state.present.workflow.projectId, state.present.workflow._id, workflowToSave);
            }
        } finally {
            saving.current = false;
            if (saveQueue.current.length > 0) {
                processQueue(state, dispatch);
            } else {
                dispatch({ type: "set_saving", saving: false });
            }
        }
    }, [isLive]);

    useEffect(() => {
        if (state.present.pendingChanges && state.present.workflow) {
            saveQueue.current.push(state.present.workflow);
            const timeoutId = setTimeout(() => {
                dispatch({ type: "set_saving", saving: true });
                processQueue(state, dispatch);
            }, 2000);

            return () => clearTimeout(timeoutId);
        }
    }, [state.present.workflow, state.present.pendingChanges, processQueue, state]);

    return <div className="flex flex-col h-full relative">
        <div className="shrink-0 flex justify-between items-center pb-2">
            <div className="flex items-center gap-2">
                <div className="font-semibold">Workflow</div>
                <div className="flex items-center gap-1">
                    <WorkflowIcon />
                    <div className="font-semibold">
                        <EditableField
                            key={state.present.workflow._id}
                            value={state.present.workflow?.name || ''}
                            onChange={handleRenameWorkflow}
                            placeholder="Name this version"
                        />
                    </div>
                    {state.present.publishing && <Spinner size="sm" />}
                    {isLive && <PublishedBadge />}
                </div>
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            isIconOnly
                            variant="bordered"
                            size="sm"
                        >
                            <HamburgerIcon size={16} />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        disabledKeys={[
                            ...(state.present.pendingChanges ? ['switch', 'clone'] : []),
                            ...(isLive ? ['publish'] : []),
                        ]}
                        onAction={(key) => {
                            if (key === 'switch') {
                                handleShowSelector();
                            }
                            if (key === 'clone') {
                                handleCloneVersion(state.present.workflow._id);
                            }
                            if (key === 'publish') {
                                handlePublishWorkflow();
                            }
                            if (key === 'clipboard') {
                                handleCopyJSON();
                            }
                        }}
                    >
                        <DropdownItem
                            key="switch"
                            startContent={<BackIcon size={16} />}
                        >
                            Switch version
                        </DropdownItem>
                        <DropdownItem
                            key="clone"
                            startContent={<Layers2Icon size={16} />}
                        >
                            Clone this version
                        </DropdownItem>
                        <DropdownItem
                            key="publish"
                            color="danger"
                            startContent={<RadioIcon size={16} />}
                        >
                            Deploy to Production
                        </DropdownItem>
                        <DropdownItem
                            key="clipboard"
                            startContent={<ClipboardIcon size={16} />}
                        >
                            Copy as JSON
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>
            {showCopySuccess && <div className="flex items-center gap-2">
                <div className="text-green-500">Copied to clipboard</div>
            </div>}
            <div className="flex items-center gap-2">
                {isLive && <div className="flex items-center gap-2">
                    <div className="bg-yellow-50 text-yellow-500 px-2 py-1 rounded-md text-sm">
                        This version is locked. You cannot make changes.
                    </div>
                    <Button
                        variant="bordered"
                        size="sm"
                        onClick={() => handleCloneVersion(state.present.workflow._id)}
                    >
                        Clone this version
                    </Button>
                </div>}
                {!isLive && <>
                    {state.present.saving && <div className="flex items-center gap-2">
                        <Spinner size="sm" />
                        <div className="text-sm text-gray-500">Saving...</div>
                    </div>}
                    {!state.present.saving && state.present.workflow && <div className="text-sm text-gray-500">
                        Updated <RelativeTime date={new Date(state.present.workflow.lastUpdatedAt)} />
                    </div>}
                </>}
                {!isLive && <>
                    <Button
                        isIconOnly
                        variant="bordered"
                        title="Undo"
                        size="sm"
                        disabled={state.currentIndex <= 0}
                        onClick={() => dispatch({ type: "undo" })}
                    >
                        <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M3 9h13a5 5 0 0 1 0 10H7M3 9l4-4M3 9l4 4" />
                        </svg>
                    </Button>
                    <Button
                        isIconOnly
                        variant="bordered"
                        title="Redo"
                        size="sm"
                        disabled={state.currentIndex >= state.patches.length}
                        onClick={() => dispatch({ type: "redo" })}
                    >
                        <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M21 9H8a5 5 0 0 0 0 10h9m4-10-4-4m4 4-4 4" />
                        </svg>
                    </Button>
                </>}
            </div>
        </div>
        <ResizablePanelGroup direction="horizontal" className="grow flex overflow-auto gap-1">
            <ResizablePanel minSize={10} defaultSize={20}>
                <ResizablePanelGroup direction="vertical" className="flex flex-col gap-1">
                    <ResizablePanel minSize={10} defaultSize={50}>
                        <AgentsList
                            agents={state.present.workflow.agents}
                            handleSelectAgent={handleSelectAgent}
                            handleAddAgent={handleAddAgent}
                            selectedAgent={state.present.selection?.type === "agent" ? state.present.selection.name : null}
                            handleToggleAgent={handleToggleAgent}
                            handleSetMainAgent={handleSetMainAgent}
                            handleDeleteAgent={handleDeleteAgent}
                            startAgentName={state.present.workflow.startAgent}
                        />
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel minSize={10} defaultSize={30}>
                        <ToolsList
                            tools={state.present.workflow.tools}
                            handleSelectTool={handleSelectTool}
                            handleAddTool={handleAddTool}
                            selectedTool={state.present.selection?.type === "tool" ? state.present.selection.name : null}
                            handleDeleteTool={handleDeleteTool}
                        />
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel minSize={10} defaultSize={20}>
                        <PromptsList
                            prompts={state.present.workflow.prompts}
                            handleSelectPrompt={handleSelectPrompt}
                            handleAddPrompt={handleAddPrompt}
                            selectedPrompt={state.present.selection?.type === "prompt" ? state.present.selection.name : null}
                            handleDeletePrompt={handleDeletePrompt}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel minSize={20} defaultSize={50} className="overflow-auto">
                <ChatApp
                    key={'' + state.present.chatKey}
                    hidden={state.present.selection !== null}
                    projectId={state.present.workflow.projectId}
                    workflow={state.present.workflow}
                    messageSubscriber={updateChatMessages}
                />
                {state.present.selection?.type === "agent" && <AgentConfig
                    key={state.present.selection.name}
                    agent={state.present.workflow.agents.find((agent) => agent.name === state.present.selection!.name)!}
                    usedAgentNames={new Set(state.present.workflow.agents.filter((agent) => agent.name !== state.present.selection!.name).map((agent) => agent.name))}
                    agents={state.present.workflow.agents}
                    tools={state.present.workflow.tools}
                    prompts={state.present.workflow.prompts}
                    dataSources={dataSources}
                    handleUpdate={handleUpdateAgent.bind(null, state.present.selection.name)}
                    handleClose={handleUnselectAgent}
                />}
                {state.present.selection?.type === "tool" && <ToolConfig
                    key={state.present.selection.name}
                    tool={state.present.workflow.tools.find((tool) => tool.name === state.present.selection!.name)!}
                    usedToolNames={new Set(state.present.workflow.tools.filter((tool) => tool.name !== state.present.selection!.name).map((tool) => tool.name))}
                    handleUpdate={handleUpdateTool.bind(null, state.present.selection.name)}
                    handleClose={handleUnselectTool}
                />}
                {state.present.selection?.type === "prompt" && <PromptConfig
                    key={state.present.selection.name}
                    prompt={state.present.workflow.prompts.find((prompt) => prompt.name === state.present.selection!.name)!}
                    usedPromptNames={new Set(state.present.workflow.prompts.filter((prompt) => prompt.name !== state.present.selection!.name).map((prompt) => prompt.name))}
                    handleUpdate={handleUpdatePrompt.bind(null, state.present.selection.name)}
                    handleClose={handleUnselectPrompt}
                />}
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel minSize={10} defaultSize={30}>
                <Copilot
                    projectId={state.present.workflow.projectId}
                    workflow={state.present.workflow}
                    dispatch={dispatch}
                    chatContext={
                        state.present.selection ? {
                            type: state.present.selection.type,
                            name: state.present.selection.name
                        } : chatMessages.length > 0 ? {
                            type: 'chat',
                            messages: chatMessages
                        } : undefined
                    }
                />
            </ResizablePanel>
        </ResizablePanelGroup>
    </div>;
}
