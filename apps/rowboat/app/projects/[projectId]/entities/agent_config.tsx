"use client";
import { WithStringId } from "../../../lib/types/types";
import { AgenticAPITool } from "../../../lib/types/agents_api_types";
import { WorkflowPrompt, WorkflowAgent, Workflow } from "../../../lib/types/workflow_types";
import { DataSource } from "../../../lib/types/datasource_types";
import { z } from "zod";
import { PlusIcon, Sparkles, X as XIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { usePreviewModal } from "../workflow/preview-modal";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { PreviewModalProvider } from "../workflow/preview-modal";
import { CopilotMessage } from "@/app/lib/types/copilot_types";
import { getCopilotAgentInstructions } from "@/app/actions/copilot_actions";
import { Dropdown as CustomDropdown } from "../../../lib/components/dropdown";
import { createAtMentions } from "../../../lib/components/atmentions";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/common/panel-common";
import { Button as CustomButton } from "@/components/ui/button";
import clsx from "clsx";
import { EditableField } from "@/app/lib/components/editable-field";

// Common section header styles
const sectionHeaderStyles = "text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400";

// Common textarea styles
const textareaStyles = "rounded-lg p-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 focus:shadow-inner focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 placeholder:text-gray-400 dark:placeholder:text-gray-500";

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
    useRag,
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
    useRag: boolean,
}) {
    const [isAdvancedConfigOpen, setIsAdvancedConfigOpen] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const { showPreview } = usePreviewModal();
    const [localName, setLocalName] = useState(agent.name);
    const [nameError, setNameError] = useState<string | null>(null);
    
    useEffect(() => {
        setLocalName(agent.name);
    }, [agent.name]);

    const validateName = (value: string) => {
        if (value.length === 0) {
            setNameError("Name cannot be empty");
            return false;
        }
        if (value !== agent.name && usedAgentNames.has(value)) {
            setNameError("This name is already taken");
            return false;
        }
        if (!/^[a-zA-Z0-9_-\s]+$/.test(value)) {
            setNameError("Name must contain only letters, numbers, underscores, hyphens, and spaces");
            return false;
        }
        setNameError(null);
        return true;
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newName = e.target.value;
        setLocalName(newName);
        
        if (validateName(newName)) {
            handleUpdate({
                ...agent,
                name: newName
            });
        }
    };

    const atMentions = createAtMentions({
        agents,
        prompts,
        tools,
        currentAgentName: agent.name
    });

    return (
        <Panel 
            title={
                <div className="flex items-center justify-between w-full">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {agent.name}
                    </div>
                    <CustomButton
                        variant="secondary"
                        size="sm"
                        onClick={handleClose}
                        startContent={<XIcon className="w-4 h-4" />}
                        aria-label="Close agent config"
                    >
                        Close
                    </CustomButton>
                </div>
            }
        >
            <div className="flex flex-col gap-6 p-4">
                {!agent.locked && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className={sectionHeaderStyles}>
                                Name
                            </label>
                            <div className={clsx(
                                "border rounded-lg focus-within:ring-2",
                                nameError 
                                    ? "border-red-500 focus-within:ring-red-500/20" 
                                    : "border-gray-200 dark:border-gray-700 focus-within:ring-indigo-500/20 dark:focus-within:ring-indigo-400/20"
                            )}>
                                <Textarea
                                    value={agent.name}
                                    useValidation={true}
                                    updateOnBlur={true}
                                    validate={(value) => {
                                        const error = validateAgentName(value, agent.name, usedAgentNames);
                                        setNameError(error);
                                        return { valid: !error, errorMessage: error || undefined };
                                    }}
                                    onValidatedChange={(value) => {
                                        handleUpdate({
                                            ...agent,
                                            name: value
                                        });
                                    }}
                                    placeholder="Enter agent name..."
                                    className="w-full text-sm bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors px-4 py-3"
                                    autoResize
                                />
                            </div>
                            {nameError && (
                                <p className="text-sm text-red-500">{nameError}</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className={sectionHeaderStyles}>
                            Description
                        </label>
                        <Textarea
                            value={agent.description || ""}
                            onChange={(e) => {
                                handleUpdate({
                                    ...agent,
                                    description: e.target.value
                                });
                            }}
                            placeholder="Enter a description for this agent"
                            className={textareaStyles}
                            autoResize
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className={sectionHeaderStyles}>
                            Instructions
                        </label>
                        <CustomButton
                            variant="primary"
                            size="sm"
                            onClick={() => setShowGenerateModal(true)}
                            startContent={<Sparkles className="w-4 h-4" />}
                        >
                            Generate
                        </CustomButton>
                    </div>
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
                        showSaveButton={true}
                        showDiscardButton={true}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500/20 dark:focus-within:ring-indigo-400/20"
                    />
                </div>

                <div className="space-y-4">
                    <label className={sectionHeaderStyles}>
                        Examples
                    </label>
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
                        multiline
                        mentions
                        mentionsAtValues={atMentions}
                        showSaveButton={true}
                        showDiscardButton={true}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500/20 dark:focus-within:ring-indigo-400/20"
                    />
                </div>

                {useRag && (
                    <div className="space-y-4">
                        <label className={sectionHeaderStyles}>
                            RAG
                        </label>
                        <div className="flex flex-col gap-3">
                            <CustomButton
                                variant="secondary"
                                size="sm"
                                startContent={<PlusIcon className="w-4 h-4" />}
                                onClick={() => {/* existing dropdown logic */}}
                            >
                                Add data source
                            </CustomButton>
                            
                            {/* ... rest of RAG section ... */}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <label className={sectionHeaderStyles}>
                        Model
                    </label>
                    <CustomDropdown
                        value={agent.model}
                        options={WorkflowAgent.shape.model.options.map((model) => ({
                            key: model.value,
                            label: model.value
                        }))}
                        onChange={(value) => handleUpdate({
                            ...agent,
                            model: value as z.infer<typeof WorkflowAgent>['model']
                        })}
                        className="w-40"
                    />
                </div>

                <div className="space-y-4">
                    <label className={sectionHeaderStyles}>
                        Conversation control after turn
                    </label>
                    <CustomDropdown
                        value={agent.controlType}
                        options={[
                            { key: "retain", label: "Retain control" },
                            { key: "relinquish_to_parent", label: "Relinquish to parent" },
                            { key: "relinquish_to_start", label: "Relinquish to 'start' agent" }
                        ]}
                        onChange={(value) => handleUpdate({
                            ...agent,
                            controlType: value as z.infer<typeof WorkflowAgent>['controlType']
                        })}
                    />
                </div>

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
        </Panel>
    );
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
                true,
                "Generated Instructions",
                "Review the changes below:",
                () => onApply(newInstructions)
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
                                <CustomButton
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                        setError(null);
                                        handleGenerate();
                                    }}
                                >
                                    Retry
                                </CustomButton>
                            </div>
                        )}
                        <Textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            placeholder="e.g., This agent should help users analyze their data and provide insights..."
                            className={textareaStyles}
                            autoResize
                        />
                    </div>
                </ModalBody>
                <ModalFooter>
                    <CustomButton
                        variant="secondary"
                        size="sm"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </CustomButton>
                    <CustomButton
                        variant="primary"
                        size="sm"
                        onClick={handleGenerate}
                        disabled={!prompt.trim() || isLoading}
                        isLoading={isLoading}
                    >
                        Generate
                    </CustomButton>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

function validateAgentName(value: string, currentName?: string, usedNames?: Set<string>) {
    if (value.length === 0) {
        return "Name cannot be empty";
    }
    if (currentName && value !== currentName && usedNames?.has(value)) {
        return "This name is already taken";
    }
    if (!/^[a-zA-Z0-9_-\s]+$/.test(value)) {
        return "Name must contain only letters, numbers, underscores, hyphens, and spaces";
    }
    return null;
}