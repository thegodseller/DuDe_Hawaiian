import { z } from "zod";
import { AgenticAPITool } from "@/app/lib/types";
import { Dropdown, DropdownItem, DropdownTrigger, DropdownMenu } from "@nextui-org/react";
import { useRef, useEffect } from "react";
import { ActionButton, Pane } from "./pane";

export function ToolsList({
    tools,
    handleSelectTool,
    handleAddTool,
    selectedTool,
    handleDeleteTool,
}: {
    tools: z.infer<typeof AgenticAPITool>[];
    handleSelectTool: (name: string) => void;
    handleAddTool: (tool: Partial<z.infer<typeof AgenticAPITool>>) => void;
    selectedTool: string | null;
    handleDeleteTool: (name: string) => void;
}) {
    const selectedToolRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const selectedToolIndex = tools.findIndex(tool => tool.name === selectedTool);
        if (selectedToolIndex !== -1 && selectedToolRef.current) {
            selectedToolRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedTool, tools]);

    return <Pane title="Tools" actions={[
        <ActionButton
            key="add"
            icon={<svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-7 7V5" />
            </svg>}
            onClick={() => handleAddTool({})}
        >
            Add
        </ActionButton>
    ]}>
        <div className="overflow-auto flex flex-col justify-start">
            {tools.map((tool, index) => (
                <button
                    key={index}
                    ref={selectedTool === tool.name ? selectedToolRef : null}
                    onClick={() => handleSelectTool(tool.name)}
                    className={`flex items-center justify-between rounded-md px-3 py-2 ${selectedTool === tool.name ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                >
                    <div className="flex items-center gap-2">
                        <div>{tool.name}</div>
                    </div>
                    <Dropdown key={tool.name}>
                        <DropdownTrigger>
                            <svg className="w-6 h-6 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeWidth="3" d="M12 6h.01M12 12h.01M12 18h.01" />
                            </svg>
                        </DropdownTrigger>
                        <DropdownMenu
                            onAction={(key) => {
                                if (key === 'delete') {
                                    handleDeleteTool(tool.name);
                                }
                            }}
                        >
                            <DropdownItem key="delete" className="text-danger">Delete</DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                </button>
            ))}
        </div>
    </Pane>;
}