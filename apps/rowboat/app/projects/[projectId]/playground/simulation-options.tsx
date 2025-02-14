'use client';
import { Input, Textarea } from "@nextui-org/react";
import { FormStatusButton } from "../../../lib/components/FormStatusButton";
import { SimulationData } from "../../../lib/types/testing_types";
import { z } from "zod";
import { scrapeWebpage } from "../../../actions/actions";
import { ScenarioList } from "./scenario-list";

export function SimulateURLOption({
    projectId,
    beginSimulation,
}: {
    projectId: string;
    beginSimulation: (data: z.infer<typeof SimulationData>) => void;
}) {
    function handleUrlSimulationSubmit(formData: FormData) {
        const url = formData.get('url') as string;
        // fetch article content and title
        scrapeWebpage(url).then((result) => {
            beginSimulation({
                articleUrl: url,
                articleContent: result.content,
                articleTitle: result.title,
            });
        });
    }
    return <form action={handleUrlSimulationSubmit} className="flex flex-col gap-2">
        <div>Use a URL / article link:</div>
        <input type="hidden" name="projectId" value={projectId} />
        <Input
            variant="bordered"
            placeholder="https://acme.com/articles/product-detiails"
            name="url"
            required
            endContent={<FormStatusButton
                props={{
                    type: "submit",
                    endContent: <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 12H5m14 0-4 4m4-4-4-4" />
                    </svg>,
                    children: "Go"
                }}
            />}
        />
    </form>;
}

export function SimulateScenarioOption({
    projectId,
    beginSimulation,
}: {
    projectId: string;
    beginSimulation: (data: z.infer<typeof SimulationData>) => void;
}) {
    return (
        <ScenarioList
            projectId={projectId}
            onPlay={(scenario) => beginSimulation({
                scenario: scenario.description,
                context: scenario.context,
            })}
        />
    );
}

export function SimulateChatContextOption({
    projectId,
    beginSimulation,
}: {
    projectId: string;
    beginSimulation: (data: z.infer<typeof SimulationData>) => void;
}) {
    function handleChatContextSimulationSubmit(formData: FormData) {
        beginSimulation({
            chatMessages: formData.get('context') as string,
        });
    }
    return <form action={handleChatContextSimulationSubmit} className="flex flex-col gap-2">
        <div>Use a previous chat context:</div>
        <input type="hidden" name="projectId" value={projectId} />
        <Textarea
            variant="bordered"
            minRows={3}
            maxRows={10}
            required
            name="context"
            placeholder={JSON.stringify([
                {
                    "role": "assistant",
                    "content": "Hello! How can I help you today?"
                },
                {
                    "role": "user",
                    "content": "Hello! I need help with..."
                }
            ], null, 2)}
            endContent={<FormStatusButton
                props={{
                    type: "submit",
                    endContent: <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 12H5m14 0-4 4m4-4-4-4" />
                    </svg>,
                    children: "Go"
                }}
            />}
        />
    </form>;
}
