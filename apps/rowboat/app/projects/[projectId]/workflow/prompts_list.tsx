import { z } from "zod";
import { WorkflowPrompt } from "@/app/lib/types";
import { Dropdown, DropdownItem, DropdownTrigger, DropdownMenu } from "@nextui-org/react";
import { useRef, useEffect } from "react";
import { ActionButton, Pane } from "./pane";

export function PromptsList({
    prompts,
    handleSelectPrompt,
    handleAddPrompt,
    selectedPrompt,
    handleDeletePrompt,
}: {
    prompts: z.infer<typeof WorkflowPrompt>[];
    handleSelectPrompt: (name: string) => void;
    handleAddPrompt: (prompt: Partial<z.infer<typeof WorkflowPrompt>>) => void;
    selectedPrompt: string | null;
    handleDeletePrompt: (name: string) => void;
}) {
    const selectedPromptRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const selectedPromptIndex = prompts.findIndex(prompt => prompt.name === selectedPrompt);
        if (selectedPromptIndex !== -1 && selectedPromptRef.current) {
            selectedPromptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedPrompt, prompts]);

    return <Pane title="Prompts" actions={[
        <ActionButton
            key="add"
            icon={<svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-7 7V5" />
            </svg>}
            onClick={() => handleAddPrompt({})}
        >
            Add
        </ActionButton>
    ]}>
        <div className="overflow-auto flex flex-col justify-start">
            {prompts.map((prompt, index) => (
                <button
                    key={index}
                    ref={selectedPrompt === prompt.name ? selectedPromptRef : null}
                    onClick={() => handleSelectPrompt(prompt.name)}
                    className={`flex items-center justify-between rounded-md px-3 py-2 ${selectedPrompt === prompt.name ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                >
                    <div className="flex items-center gap-2">
                        {prompt.type === 'style_prompt' && <svg className="w-5 h-5 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeWidth="1" d="M20 6H10m0 0a2 2 0 1 0-4 0m4 0a2 2 0 1 1-4 0m0 0H4m16 6h-2m0 0a2 2 0 1 0-4 0m4 0a2 2 0 1 1-4 0m0 0H4m16 6H10m0 0a2 2 0 1 0-4 0m4 0a2 2 0 1 1-4 0m0 0H4" />
                        </svg>}
                        <div className="truncate">{prompt.name}</div>
                    </div>
                    <Dropdown key={prompt.name}>
                        <DropdownTrigger>
                            <svg className="w-6 h-6 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeWidth="3" d="M12 6h.01M12 12h.01M12 18h.01" />
                            </svg>
                        </DropdownTrigger>
                        <DropdownMenu
                            onAction={(key) => {
                                if (key === 'delete') {
                                    handleDeletePrompt(prompt.name);
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