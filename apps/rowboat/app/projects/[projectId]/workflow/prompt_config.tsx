"use client";
import { WorkflowPrompt } from "../../../lib/types";
import { Divider, Input, Textarea } from "@nextui-org/react";
import { z } from "zod";
import { ActionButton, Pane } from "./pane";
import { EditableField } from "../../../lib/components/editable-field";

export function PromptConfig({
    prompt,
    usedPromptNames,
    handleUpdate,
    handleClose,
}: {
    prompt: z.infer<typeof WorkflowPrompt>,
    usedPromptNames: Set<string>,
    handleUpdate: (prompt: z.infer<typeof WorkflowPrompt>) => void,
    handleClose: () => void,
}) {
    return <Pane title={prompt.name} actions={[
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
            {prompt.type === "base_prompt" && (
                <>
                    <EditableField
                        label="Name"
                        value={prompt.name}
                        onChange={(value) => {
                            handleUpdate({
                                ...prompt,
                                name: value
                            });
                        }}
                        placeholder="Enter prompt name"
                        validate={(value) => {
                            if (value.length === 0) {
                                return { valid: false, errorMessage: "Name cannot be empty" };
                            }
                            if (usedPromptNames.has(value)) {
                                return { valid: false, errorMessage: "This name is already taken" };
                            }
                            return { valid: true };
                        }}
                    />
                    <Divider />
                </>
            )}

            <div className="w-full flex flex-col">
                <EditableField
                    value={prompt.prompt}
                    onChange={(value) => {
                        handleUpdate({
                            ...prompt,
                            prompt: value
                        });
                    }}
                    placeholder="Edit prompt here..."
                    markdown
                    label="Prompt"
                    multiline
                />
            </div>
        </div>
    </Pane>;
} 