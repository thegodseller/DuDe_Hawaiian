"use client";
import { WorkflowTool } from "@/app/lib/types";
import { Accordion, AccordionItem, Button, Checkbox, Select, SelectItem, Switch } from "@nextui-org/react";
import { z } from "zod";
import { ActionButton, Pane } from "./pane";
import { EditableField } from "@/app/lib/components/editable-field";
import { Divider } from "@nextui-org/react";
import { Label } from "@/app/lib/components/label";
import { TrashIcon, XIcon } from "lucide-react";
import { useState } from "react";

export function ParameterConfig({
    param,
    handleUpdate,
    handleDelete,
    handleRename
}: {
    param: {
        name: string,
        description: string,
        type: string,
        required: boolean
    },
    handleUpdate: (name: string, data: {
        description: string,
        type: string,
        required: boolean
    }) => void,
    handleDelete: (name: string) => void,
    handleRename: (oldName: string, newName: string) => void
}) {
    return <Pane
        title={param.name}
        actions={[
            <ActionButton
                key="delete"
                onClick={() => handleDelete(param.name)}
                icon={<XIcon size={16} />}
            >
                Remove
            </ActionButton>
        ]}
    >
        <div className="flex flex-col gap-2">
            <EditableField
                label="Name"
                value={param.name}
                onChange={(newName) => {
                    if (newName && newName !== param.name) {
                        handleRename(param.name, newName);
                    }
                }}
            />

            <Divider />

            <div className="flex flex-col gap-2">
                <Label label="Type" />
                <Select
                    variant="bordered"
                    className="w-52"
                    size="sm"
                    selectedKeys={new Set([param.type])}
                    onSelectionChange={(keys) => {
                        handleUpdate(param.name, {
                            ...param,
                            type: Array.from(keys)[0] as string
                        });
                    }}
                >
                    {['string', 'number', 'boolean', 'array', 'object'].map(type => (
                        <SelectItem key={type} value={type}>
                            {type}
                        </SelectItem>
                    ))}
                </Select>
            </div>

            <Divider />

            <EditableField
                label="Description"
                value={param.description}
                onChange={(desc) => {
                    handleUpdate(param.name, {
                        ...param,
                        description: desc
                    });
                }}
            />

            <Divider />

            <Checkbox
                size="sm"
                isSelected={param.required}
                onValueChange={() => {
                    handleUpdate(param.name, {
                        ...param,
                        required: !param.required
                    });
                }}
            >
                Required
            </Checkbox>
        </div>
    </Pane>;
}

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
    const [selectedParams, setSelectedParams] = useState(new Set([]));

    function handleParamRename(oldName: string, newName: string) {
        const newProperties = { ...tool.parameters!.properties };
        newProperties[newName] = newProperties[oldName];
        delete newProperties[oldName];

        const newRequired = [...(tool.parameters?.required || [])];
        newRequired.splice(newRequired.indexOf(oldName), 1);
        newRequired.push(newName);

        handleUpdate({
            ...tool,
            parameters: { ...tool.parameters!, properties: newProperties, required: newRequired }
        });
    }

    function handleParamUpdate(name: string, data: {
        description: string,
        type: string,
        required: boolean
    }) {
        const newProperties = { ...tool.parameters!.properties };
        newProperties[name] = {
            type: data.type,
            description: data.description
        };

        const newRequired = [...(tool.parameters?.required || [])];
        if (data.required) {
            newRequired.push(name);
        } else {
            newRequired.splice(newRequired.indexOf(name), 1);
        }

        handleUpdate({
            ...tool,
            parameters: {
                ...tool.parameters!,
                properties: newProperties,
                required: newRequired,
            }
        });
    }

    function handleParamDelete(paramName: string) {
        const newProperties = { ...tool.parameters!.properties };
        delete newProperties[paramName];

        const newRequired = [...(tool.parameters?.required || [])];
        newRequired.splice(newRequired.indexOf(paramName), 1);

        handleUpdate({
            ...tool,
            parameters: {
                ...tool.parameters!,
                properties: newProperties,
                required: newRequired,
            }
        });
    }

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

                <Divider />

                <EditableField
                    label="Description"
                    value={tool.description}
                    onChange={(value) => handleUpdate({
                        ...tool,
                        description: value
                    })}
                    placeholder="Describe what this tool does..."
                />

                <Divider />

                <Checkbox
                    size="sm"
                    isSelected={tool.mockInPlayground ?? false}
                    onValueChange={(value) => handleUpdate({
                        ...tool,
                        mockInPlayground: value
                    })}
                >
                    Mock tool in Playground
                </Checkbox>

                <Divider />

                <Label label="Parameters" />

                <div className="ml-4 flex flex-col gap-2">
                    {Object.entries(tool.parameters?.properties || {}).map(([paramName, param], index) => (
                        <ParameterConfig
                            key={paramName}
                            param={{
                                name: paramName,
                                description: param.description,
                                type: param.type,
                                required: tool.parameters?.required?.includes(paramName) ?? false
                            }}
                            handleUpdate={handleParamUpdate}
                            handleDelete={handleParamDelete}
                            handleRename={handleParamRename}
                        />
                    ))}
                </div>

                <Button
                    className="self-start shrink-0"
                    variant="light"
                    size="sm"
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
        </Pane>
    );
}