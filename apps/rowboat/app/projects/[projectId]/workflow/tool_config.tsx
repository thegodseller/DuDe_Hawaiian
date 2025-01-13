"use client";
import { WorkflowTool } from "@/app/lib/types";
import { Button, Select, SelectItem, Switch } from "@nextui-org/react";
import { z } from "zod";
import { ActionButton, Pane } from "./pane";
import { EditableField } from "@/app/lib/components/editable-field";

export function ToolConfig({
    tool,
    usedToolNames,
    handleUpdate,
    handleClose
}: {
    tool: z.infer<typeof WorkflowTool>,
    usedToolNames: Set<string>,
    handleUpdate: (tool: z.infer<typeof WorkflowTool>) => void,
    handleClose: () => void
}) {
    return (
        <Pane title={tool.name} actions={[
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
                <EditableField
                    label="Name"
                    value={tool.name}
                    onChange={(value) => handleUpdate({
                        ...tool,
                        name: value
                    })}
                    validate={(value) => {
                        if (value.length === 0) {
                            return { valid: false, errorMessage: "Name cannot be empty" };
                        }
                        if (usedToolNames.has(value)) {
                            return { valid: false, errorMessage: "Tool name already exists" };
                        }
                        return { valid: true };
                    }}
                />

                <EditableField
                    label="Description"
                    value={tool.description}
                    onChange={(value) => handleUpdate({
                        ...tool,
                        description: value
                    })}
                    placeholder="Describe what this tool does..."
                />

                <div className="flex items-center gap-2">
                    <Switch
                        size="sm"
                        isSelected={tool.mockInPlayground ?? false}
                        onValueChange={(value) => handleUpdate({
                            ...tool,
                            mockInPlayground: value
                        })}
                    />
                    <span>Mock tool in Playground</span>
                </div>

                <div className="flex flex-col gap-4 w-full">
                    <div className="text-sm">Parameters:</div>

                    {Object.entries(tool.parameters?.properties || {}).map(([paramName, param], index) => (
                        <div key={index} className="border border-gray-300 rounded p-4">
                            <div className="flex flex-col gap-4">
                                <EditableField
                                    label="Parameter Name"
                                    value={paramName}
                                    onChange={(newName) => {
                                        if (newName && newName !== paramName) {
                                            const newProperties = { ...tool.parameters!.properties };
                                            newProperties[newName] = newProperties[paramName];
                                            delete newProperties[paramName];
                                            
                                            handleUpdate({
                                                ...tool,
                                                parameters: {
                                                    ...tool.parameters!,
                                                    properties: newProperties,
                                                    required: tool.parameters!.required?.map(
                                                        name => name === paramName ? newName : name
                                                    ) || []
                                                }
                                            });
                                        }
                                    }}
                                />

                                <Select
                                    label="Type"
                                    labelPlacement="outside"
                                    variant="bordered"
                                    selectedKeys={new Set([param.type])}
                                    onSelectionChange={(keys) => {
                                        const newProperties = { ...tool.parameters!.properties };
                                        newProperties[paramName] = {
                                            ...newProperties[paramName],
                                            type: Array.from(keys)[0] as string
                                        };
                                        
                                        handleUpdate({
                                            ...tool,
                                            parameters: {
                                                ...tool.parameters!,
                                                properties: newProperties
                                            }
                                        });
                                    }}
                                >
                                    {['string', 'number', 'boolean', 'array', 'object'].map(type => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                                </Select>

                                <EditableField
                                    label="Description"
                                    value={param.description}
                                    onChange={(desc) => {
                                        const newProperties = { ...tool.parameters!.properties };
                                        newProperties[paramName] = {
                                            ...newProperties[paramName],
                                            description: desc
                                        };
                                        
                                        handleUpdate({
                                            ...tool,
                                            parameters: {
                                                ...tool.parameters!,
                                                properties: newProperties
                                            }
                                        });
                                    }}
                                />

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            size="sm"
                                            isSelected={tool.parameters?.required?.includes(paramName)}
                                            onValueChange={() => {
                                                const required = [...(tool.parameters?.required || [])];
                                                const index = required.indexOf(paramName);
                                                if (index === -1) {
                                                    required.push(paramName);
                                                } else {
                                                    required.splice(index, 1);
                                                }
                                                
                                                handleUpdate({
                                                    ...tool,
                                                    parameters: {
                                                        ...tool.parameters!,
                                                        required
                                                    }
                                                });
                                            }}
                                        />
                                        <span>Required</span>
                                    </div>

                                    <Button
                                        variant="bordered"
                                        isIconOnly
                                        onClick={() => {
                                            const newProperties = { ...tool.parameters!.properties };
                                            delete newProperties[paramName];
                                            
                                            handleUpdate({
                                                ...tool,
                                                parameters: {
                                                    ...tool.parameters!,
                                                    properties: newProperties,
                                                    required: tool.parameters!.required?.filter(
                                                        name => name !== paramName
                                                    ) || []
                                                }
                                            });
                                        }}
                                    >
                                        <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z" />
                                        </svg>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-end items-center">
                        <Button
                            variant="bordered"
                            startContent={<svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14m-7 7V5" />
                            </svg>}
                            onClick={() => {
                                const newParamName = `param${Object.keys(tool.parameters?.properties || {}).length + 1}`;
                                const newProperties = {
                                    ...(tool.parameters?.properties || {}),
                                    [newParamName]: {
                                        type: 'string',
                                        description: ''
                                    }
                                };
                                
                                handleUpdate({
                                    ...tool,
                                    parameters: {
                                        type: 'object',
                                        properties: newProperties,
                                        required: [...(tool.parameters?.required || []), newParamName]
                                    }
                                });
                            }}
                        >
                            Add Parameter
                        </Button>
                    </div>
                </div>
            </div>
        </Pane>
    );
}