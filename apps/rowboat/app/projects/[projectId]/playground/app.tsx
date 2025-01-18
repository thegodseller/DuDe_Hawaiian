'use client';
import { Spinner } from "@nextui-org/react";
import { useEffect, useState, useMemo } from "react";
import { z } from "zod";
import { PlaygroundChat, SimulationData, Workflow } from "@/app/lib/types";
import { SimulateScenarioOption, SimulateURLOption } from "./simulation-options";
import { Chat } from "./chat";
import { useSearchParams } from "next/navigation";
import { ActionButton, Pane } from "../workflow/pane";
import { apiV1 } from "rowboat-shared";

function SimulateLabel() {
    return <span>Simulate<sup className="pl-1">beta</sup></span>;
}

const defaultSystemMessage = '';

export function App({
    hidden = false,
    projectId,
    workflow,
    messageSubscriber,
}: {
    hidden?: boolean;
    projectId: string;
    workflow: z.infer<typeof Workflow>;
    messageSubscriber?: (messages: z.infer<typeof apiV1.ChatMessage>[]) => void;
}) {
    const searchParams = useSearchParams();
    const initialChatId = useMemo(() => searchParams.get('chatId'), [searchParams]);
    const [existingChatId, setExistingChatId] = useState<string | null>(initialChatId);
    const [loadingChat, setLoadingChat] = useState<boolean>(false);
    const [viewSimulationMenu, setViewSimulationMenu] = useState<boolean>(false);
    const [counter, setCounter] = useState<number>(0);
    const [chat, setChat] = useState<z.infer<typeof PlaygroundChat>>({
        projectId,
        createdAt: new Date().toISOString(),
        messages: [],
        simulated: false,
        systemMessage: defaultSystemMessage,
    });

    function handleSimulateButtonClick() {
        setViewSimulationMenu(true);
    }
    function handleNewChatButtonClick() {
        setExistingChatId(null);
        setViewSimulationMenu(false);
        setCounter(counter + 1);
        setChat({
            projectId,
            createdAt: new Date().toISOString(),
            messages: [],
            simulated: false,
            systemMessage: defaultSystemMessage,
        });
    }
    function beginSimulation(data: z.infer<typeof SimulationData>) {
        setExistingChatId(null);
        setViewSimulationMenu(false);
        setCounter(counter + 1);
        setChat({
            projectId,
            createdAt: new Date().toISOString(),
            messages: [],
            simulated: true,
            simulationData: data,
        });
    }

    if (hidden) {
        return <></>;
    }

    return <Pane title={viewSimulationMenu ? <SimulateLabel /> : "Chat"} actions={[
        <ActionButton
            key="new-chat"
            icon={<svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 10.5h.01m-4.01 0h.01M8 10.5h.01M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-6.6a1 1 0 0 0-.69.275l-2.866 2.723A.5.5 0 0 1 8 18.635V17a1 1 0 0 0-1-1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
            </svg>}
            onClick={handleNewChatButtonClick}
        >
            New chat
        </ActionButton>,
        !viewSimulationMenu && <ActionButton
            key="simulate"
            icon={<svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 18V6l8 6-8 6Z" />
            </svg>}
            onClick={handleSimulateButtonClick}
        >
            Simulate
        </ActionButton>,
    ]}>
        <div className="h-full overflow-auto">
            {!viewSimulationMenu && loadingChat && <div className="flex justify-center items-center h-full">
                <Spinner />
            </div>}
            {!viewSimulationMenu && !loadingChat && <Chat
                key={existingChatId || 'chat-' + counter}
                chat={chat}
                initialChatId={existingChatId || null}
                projectId={projectId}
                workflow={workflow}
                messageSubscriber={messageSubscriber}
            />}
            {viewSimulationMenu && <SimulateScenarioOption beginSimulation={beginSimulation} projectId={projectId} />}
        </div>
    </Pane>;
}
