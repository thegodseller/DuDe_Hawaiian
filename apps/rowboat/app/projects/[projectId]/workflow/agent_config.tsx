"use client";
import { WithStringId } from "../../../lib/types/types";
import { AgenticAPITool } from "../../../lib/types/agents_api_types";
import { WorkflowPrompt, WorkflowAgent, Workflow } from "../../../lib/types/workflow_types";
import { DataSource } from "../../../lib/types/datasource_types";
import { Button, Divider, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Radio, RadioGroup, Select, SelectItem } from "@nextui-org/react";
import { z } from "zod";
import { DataSourceIcon } from "../../../lib/components/datasource-icon";
import { ActionButton, StructuredPanel } from "../../../lib/components/structured-panel";
import { EditableField } from "../../../lib/components/editable-field";
import { Label } from "../../../lib/components/label";
import { PlusIcon, SparklesIcon } from "lucide-react";
import { List } from "./config_list";
import { useState, useEffect, useRef } from "react";
import { usePreviewModal } from "./preview-modal";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@nextui-org/react";
import { Textarea } from "@nextui-org/react";
import { PreviewModalProvider } from "./preview-modal";
import { CopilotMessage } from "@/app/lib/types/copilot_types";
import { getCopilotAgentInstructions } from "@/app/actions/copilot_actions";

export function AgentConfig({
    projectId,
    workflow,
    agent,
    usedAgentNames,
    agents,
    tools,
    prompts,
    dataSources,
    handleUpdate,
    handleClose,
}: {
    projectId: string,
    workflow: z.infer<typeof Workflow>,
    agent: z.infer<typeof WorkflowAgent>,
    usedAgentNames: Set<string>,
    agents: z.infer<typeof WorkflowAgent>[],
    tools: z.infer<typeof AgenticAPITool>[],
    prompts: z.infer<typeof WorkflowPrompt>[],
    dataSources: WithStringId<z.infer<typeof DataSource>>[],
    handleUpdate: (agent: z.infer<typeof WorkflowAgent>) => void,
    handleClose: () => void,
}) {
    const atMentions = [];
    for (const a of agents) {
        if (a.disabled || a.name === agent.name) {
            continue;
        }
        const id = `agent:${a.name}`;
        atMentions.push({
            id,
            value: id,
        });
    }
    for (const prompt of prompts) {
        const id = `prompt:${prompt.name}`;
        atMentions.push({
            id,
            value: id,
        });
    }
    for (const tool of tools) {
        const id = `tool:${tool.name}`;
        atMentions.push({
            id,
            value: id,
        });
    }

    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const { showPreview } = usePreviewModal();

    return <StructuredPanel title={agent.name} actions={[
        <ActionButton
            key="close"
            onClick={handleClose}
            icon={<svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M6 18 17.94 6M18 18 6.06 6" />
            </svg>}
        >
            Close
        </ActionButton>
    ]}>
        <div className="flex flex-col gap-4">
            {!agent.locked && <>
                <EditableField
                    key="name"
                    label="Name"
                    value={agent.name}
                    onChange={(value) => {
                        handleUpdate({
                            ...agent,
                            name: value
                        });
                    }}
                    placeholder="Enter agent name"
                    validate={(value) => {
                        if (value.length === 0) {
                            return { valid: false, errorMessage: "Name cannot be empty" };
                        }
                        if (usedAgentNames.has(value)) {
                            return { valid: false, errorMessage: "This name is already taken" };
                        }
                        // validate against this regex: ^[a-zA-Z0-9_-]+$
                        if (!/^[a-zA-Z0-9_-\s]+$/.test(value)) {
                            return { valid: false, errorMessage: "Name must contain only letters, numbers, underscores, hyphens, and spaces" };
                        }
                        return { valid: true };
                    }}
                />
                <Divider />
            </>}

            <EditableField
                key="description"
                label="Description"
                value={agent.description || ""}
                onChange={(value) => {
                    handleUpdate({
                        ...agent,
                        description: value
                    });
                }}
                placeholder="Enter a description for this agent"
            />

            <Divider />

            <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                    <Label label="Instructions" />
                    <Button
                        variant="light"
                        size="sm"
                        startContent={<SparklesIcon size={16} />}
                        onPress={() => setShowGenerateModal(true)}
                    >
                        Generate
                    </Button>
                </div>
                <div className="w-full flex flex-col">
                    <EditableField
                        key="instructions"
                        value={agent.instructions}
                        onChange={(value) => {
                            handleUpdate({
                                ...agent,
                                instructions: value
                            });
                        }}
                        markdown
                        multiline
                        mentions
                        mentionsAtValues={atMentions}
                    />
                </div>
            </div>

            <Divider />

            <div className="w-full flex flex-col">
                <EditableField
                    key="examples"
                    value={agent.examples || ""}
                    onChange={(value) => {
                        handleUpdate({
                            ...agent,
                            examples: value
                        });
                    }}
                    placeholder="Enter examples for this agent"
                    markdown
                    label="Examples"
                    multiline
                    mentions
                    mentionsAtValues={atMentions}
                />
            </div>

            <Divider />

            <div className="flex flex-col gap-4 items-start">
                <Label label="RAG (beta)" />
                <List
                    items={agent.ragDataSources?.map((source) => ({
                        id: source,
                        node: <div className="flex items-center gap-1">
                            <DataSourceIcon type={dataSources.find((ds) => ds._id === source)?.data.type} />
                            <div>{dataSources.find((ds) => ds._id === source)?.name || "Unknown"}</div>
                        </div>
                    })) || []}
                    onRemove={(id) => {
                        const newSources = agent.ragDataSources?.filter((s) => s !== id);
                        handleUpdate({
                            ...agent,
                            ragDataSources: newSources
                        });
                    }}
                />
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            variant="light"
                            size="sm"
                            startContent={<PlusIcon size={16} />}
                        >
                            Add data source
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu onAction={(key) => handleUpdate({
                        ...agent,
                        ragDataSources: [...(agent.ragDataSources || []), key as string]
                    })}>
                        {dataSources.filter((ds) => !(agent.ragDataSources || []).includes(ds._id)).map((ds) => (
                            <DropdownItem
                                key={ds._id}
                                startContent={<DataSourceIcon type={ds.data.type} />}
                            >
                                {ds.name}
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            </div>

            <Divider />

            {agent.ragDataSources !== undefined && agent.ragDataSources.length > 0 && <>
                <Label label="Advanced RAG configuration" />
                <div className="ml-4 flex flex-col gap-4">
                    <Label label="Return type" />
                    <RadioGroup
                        size="sm"
                        orientation="horizontal"
                        value={agent.ragReturnType}
                        onValueChange={(value) => handleUpdate({
                            ...agent,
                            ragReturnType: value as z.infer<typeof WorkflowAgent>['ragReturnType']
                        })}
                    >
                        <Radio value="chunks">Chunks</Radio>
                        <Radio value="content">Content</Radio>
                    </RadioGroup>
                    <Label label="No. of matches" />
                    <Input
                        variant="bordered"
                        size="sm"
                        className="w-20"
                        value={agent.ragK.toString()}
                        onValueChange={(value) => handleUpdate({
                            ...agent,
                            ragK: parseInt(value)
                        })}
                        type="number"
                    />
                </div>
                <Divider />
            </>}

            <Divider />
            <div className="flex flex-col gap-2 items-start">
                <Label label="Model" />
                <Select
                    variant="bordered"
                    selectedKeys={[agent.model]}
                    size="sm"
                    onSelectionChange={(keys) => handleUpdate({
                        ...agent,
                        model: keys.currentKey! as z.infer<typeof WorkflowAgent>['model']
                    })}
                    className="w-40"
                >
                    {WorkflowAgent.shape.model.options.map((model) => (
                        <SelectItem key={model.value} value={model.value}>{model.value}</SelectItem>
                    ))}
                </Select>
            </div>

            <Divider />

            <div className="flex flex-col gap-2 items-start">
                <Label label="Conversation control after turn" />
                <Select
                    variant="bordered"
                    selectedKeys={[agent.controlType]}
                    size="sm"
                    onSelectionChange={(keys) => handleUpdate({
                        ...agent,
                        controlType: keys.currentKey! as z.infer<typeof WorkflowAgent>['controlType']
                    })}
                    className="w-60"
                >
                    <SelectItem key="retain" value="retain">Retain control</SelectItem>
                    <SelectItem key="relinquish_to_parent" value="relinquish_to_parent">Relinquish to parent</SelectItem>
                    <SelectItem key="relinquish_to_start" value="relinquish_to_start">Relinquish to &apos;start&apos; agent</SelectItem>
                </Select>
            </div>

            <Divider />

            <PreviewModalProvider>
                <GenerateInstructionsModal 
                    projectId={projectId}
                    workflow={workflow}
                    agent={agent}
                    isOpen={showGenerateModal}
                    onClose={() => setShowGenerateModal(false)}
                    currentInstructions={agent.instructions}
                    onApply={(newInstructions) => {
                        handleUpdate({
                            ...agent,
                            instructions: newInstructions
                        });
                    }}
                />
            </PreviewModalProvider>
        </div>
    </StructuredPanel>;
}

function GenerateInstructionsModal({
    projectId,
    workflow,
    agent,
    isOpen,
    onClose,
    currentInstructions,
    onApply
}: {
    projectId: string,
    workflow: z.infer<typeof Workflow>,
    agent: z.infer<typeof WorkflowAgent>,
    isOpen: boolean,
    onClose: () => void,
    currentInstructions: string,
    onApply: (newInstructions: string) => void
}) {
    const [prompt, setPrompt] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { showPreview } = usePreviewModal();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPrompt("");
            setIsLoading(false);
            setError(null);
            textareaRef.current?.focus();
        }
    }, [isOpen]);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const msgs: z.infer<typeof CopilotMessage>[] = [
                {
                    role: 'user',
                    content: prompt,
                },
            ];
            const newInstructions = await getCopilotAgentInstructions(projectId, msgs, workflow, agent.name);
            
            onClose();
            
            showPreview(
                currentInstructions,
                newInstructions,
                true, // markdown enabled
                "Generated Instructions",
                "Review the changes below:", // message before diff
                () => onApply(newInstructions) // apply callback
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (prompt.trim() && !isLoading) {
                handleGenerate();
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <ModalContent>
                <ModalHeader>Generate Instructions</ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-4">
                        {error && (
                            <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex gap-2 justify-between items-center text-sm">
                                <p className="text-red-600">{error}</p>
                                <Button
                                    size="sm"
                                    color="danger"
                                    onClick={() => {
                                        setError(null);
                                        handleGenerate();
                                    }}
                                >
                                    Retry
                                </Button>
                            </div>
                        )}
                        <Textarea
                            ref={textareaRef}
                            label="What should this agent do?"
                            placeholder="e.g., This agent should help users analyze their data and provide insights..."
                            variant="bordered"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button 
                        variant="light" 
                        onPress={onClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button 
                        color="primary"
                        onPress={handleGenerate}
                        isLoading={isLoading}
                        disabled={!prompt.trim()}
                    >
                        Generate
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
