"use client";
import { AgenticAPITool, DataSource, WithStringId, WorkflowAgent, WorkflowPrompt } from "@/app/lib/types";
import { Accordion, AccordionItem, Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Radio, RadioGroup, Select, SelectItem, Textarea } from "@nextui-org/react";
import { z } from "zod";
import { DataSourceIcon } from "@/app/lib/components/datasource-icon";
import { ActionButton, Pane } from "./pane";
import { EditableField } from "@/app/lib/components/editable-field";
import MarkdownContent from "@/app/lib/components/markdown-content";

export function AgentConfig({
    agent,
    usedAgentNames,
    agents,
    tools,
    prompts,
    dataSources,
    handleUpdate,
    handleClose,
}: {
    agent: z.infer<typeof WorkflowAgent>,
    usedAgentNames: Set<string>,
    agents: z.infer<typeof WorkflowAgent>[],
    tools: z.infer<typeof AgenticAPITool>[],
    prompts: z.infer<typeof WorkflowPrompt>[],
    dataSources: WithStringId<z.infer<typeof DataSource>>[],
    handleUpdate: (agent: z.infer<typeof WorkflowAgent>) => void,
    handleClose: () => void,
}) {
    return <Pane title={agent.name} actions={[
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
            {!agent.locked && (
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
                        return { valid: true };
                    }}
                />
            )}

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
                    label="Instructions"
                    multiline
                />
            </div>
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
                />
            </div>

            <div className="flex flex-col gap-2 items-start">
                <div className="text-sm">Attach prompts:</div>
                <div className="flex gap-4 flex-wrap">
                    {agent.prompts.map((prompt) => (
                        <div key={prompt} className="bg-gray-100 border-1 border-gray-200 shadow-sm rounded-lg px-2 py-1 flex items-center gap-2">
                            <div>{prompt}</div>
                            <button
                                onClick={() => {
                                    const newPrompts = agent.prompts.filter((p) => p !== prompt);
                                    handleUpdate({
                                        ...agent,
                                        prompts: newPrompts
                                    });
                                }}
                                className="bg-white rounded-md text-gray-500 hover:text-gray-800"
                            >
                                <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M6 18 17.94 6M18 18 6.06 6" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            variant="bordered"
                            size="sm"
                            startContent={<svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14m-7 7V5" />
                            </svg>}
                        >
                            Add prompt
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu onAction={(key) => handleUpdate({
                        ...agent,
                        prompts: [...agent.prompts, key as string]
                    })}>
                        {prompts.filter((prompt) => !agent.prompts.includes(prompt.name)).map((prompt) => (
                            <DropdownItem key={prompt.name}>
                                {prompt.name}
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            </div>
            <div className="flex flex-col gap-2 items-start">
                <div className="text-sm">RAG:</div>
                <div className="flex gap-4 flex-wrap">
                    {agent.ragDataSources?.map((source) => (
                        <div key={source} className="bg-gray-100 border-1 border-gray-200 shadow-sm rounded-lg px-2 py-1 flex items-center gap-2">
                            <div className="flex items-center gap-1">
                                <DataSourceIcon type={dataSources.find((ds) => ds._id === source)?.data.type} />
                                <div>{dataSources.find((ds) => ds._id === source)?.name || "Unknown"}</div>
                            </div>
                            <button
                                onClick={() => {
                                    const newSources = agent.ragDataSources?.filter((s) => s !== source);
                                    handleUpdate({
                                        ...agent,
                                        ragDataSources: newSources
                                    });
                                }}
                                className="bg-white rounded-md text-gray-500 hover:text-gray-800"
                            >
                                <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M6 18 17.94 6M18 18 6.06 6" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            variant="bordered"
                            size="sm"
                            startContent={<svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14m-7 7V5" />
                            </svg>}
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
                {agent.ragDataSources !== undefined && agent.ragDataSources.length > 0 && <Accordion>
                    <AccordionItem
                        key="rag"
                        isCompact
                        aria-label="Advanced RAG configuration"
                        title="Advanced RAG configuration"
                    >
                        <div className="flex flex-col gap-4">
                            <RadioGroup
                                label="Return type:"
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
                            <Input
                                label="No. of matches:"
                                labelPlacement="outside"
                                variant="bordered"
                                value={agent.ragK.toString()}
                                onValueChange={(value) => handleUpdate({
                                    ...agent,
                                    ragK: parseInt(value)
                                })}
                                type="number"
                            />
                        </div>
                    </AccordionItem>
                </Accordion>}
            </div>
            <div className="flex flex-col gap-2 items-start">
                <div className="text-sm">Tools:</div>
                <div className="flex gap-4 flex-wrap">
                    {agent.tools.map((tool) => (
                        <div key={tool} className="bg-gray-100 border-1 border-gray-200 shadow-sm rounded-lg px-2 py-1 flex items-center gap-2">
                            <div className="font-mono">{tool}</div>
                            <button
                                onClick={() => {
                                    const newTools = agent.tools.filter((t) => t !== tool);
                                    handleUpdate({
                                        ...agent,
                                        tools: newTools
                                    });
                                }}
                                className="bg-white rounded-md text-gray-500 hover:text-gray-800"
                            >
                                <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M6 18 17.94 6M18 18 6.06 6" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            variant="bordered"
                            size="sm"
                            startContent={<svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14m-7 7V5" />
                            </svg>}
                        >
                            Add tool
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu onAction={(key) => handleUpdate({
                        ...agent,
                        tools: [...(agent.tools || []), key as string]
                    })}>
                        {tools.filter((tool) => !(agent.tools || []).includes(tool.name)).map((tool) => (
                            <DropdownItem key={tool.name}>
                                <div className="font-mono">{tool.name}</div>
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            </div>
            <div className="flex flex-col gap-2 items-start">
                <div className="text-sm">Connected agents:</div>
                <div className="flex gap-4 flex-wrap">
                    {agent.connectedAgents?.map((connectedAgentName) => (
                        <div key={connectedAgentName} className="bg-gray-100 border-1 border-gray-200 shadow-sm rounded-lg px-2 py-1 flex items-center gap-2">
                            <div>{connectedAgentName}</div>
                            <button
                                onClick={() => {
                                    const newAgents = (agent.connectedAgents || []).filter((a) => a !== connectedAgentName);
                                    handleUpdate({
                                        ...agent,
                                        connectedAgents: newAgents
                                    });
                                }}
                                className="bg-white rounded-md text-gray-500 hover:text-gray-800"
                            >
                                <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M6 18 17.94 6M18 18 6.06 6" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            variant="bordered"
                            size="sm"
                            startContent={<svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14m-7 7V5" />
                            </svg>}
                        >
                            Connect agent
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu onAction={(key) => handleUpdate({
                        ...agent,
                        connectedAgents: [...(agent.connectedAgents || []), key as string]
                    })}>
                        {agents.filter((a) =>
                            a.name !== agent.name &&
                            !(agent.connectedAgents || []).includes(a.name) &&
                            !a.global
                        ).map((a) => (
                            <DropdownItem key={a.name}>
                                <div>{a.name}</div>
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            </div>
            <div className="flex flex-col gap-2 items-start">
                <EditableField
                    label="Model:"
                    value={agent.model}
                    onChange={(value) => {
                        handleUpdate({
                            ...agent,
                            model: value
                        });
                    }}
                    validate={(value) => {
                        if (value.length === 0) {
                            return { valid: false, errorMessage: "Model cannot be empty" };
                        }
                        return { valid: true };
                    }}
                    className="w-40"
                />
            </div>
            <div className="flex flex-col gap-2 items-start">
                <div className="text-sm">Conversation control after turn:</div>
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
        </div>
    </Pane>;
}
