'use client';
import { createContext, useContext, useState } from "react";
import clsx from "clsx";
import { z } from "zod";
import { CopilotAssistantMessage } from "../../../lib/types/copilot_types";
import { CopilotAssistantMessageActionPart } from "../../../lib/types/copilot_types";
import { Workflow } from "../../../lib/types/workflow_types";
import { PreviewModalProvider, usePreviewModal } from './preview-modal';
import { getAppliedChangeKey } from "./copilot";
import { AlertTriangleIcon, CheckCheckIcon, CheckIcon, ChevronsDownIcon, ChevronsUpIcon, EyeIcon, PencilIcon, PlusIcon } from "lucide-react";
import { Tooltip } from "@nextui-org/react";

const ActionContext = createContext<{
    msgIndex: number;
    actionIndex: number;
    action: z.infer<typeof CopilotAssistantMessageActionPart>['content'] | null;
    workflow: z.infer<typeof Workflow> | null;
    handleApplyChange: (messageIndex: number, actionIndex: number, field?: string) => void;
    appliedFields: string[];
    stale: boolean;
}>({ msgIndex: 0, actionIndex: 0, action: null, workflow: null, handleApplyChange: () => { }, appliedFields: [], stale: false });

export function Action({
    msgIndex,
    actionIndex,
    action,
    workflow,
    handleApplyChange,
    appliedChanges,
    stale,
}: {
    msgIndex: number;
    actionIndex: number;
    action: z.infer<typeof CopilotAssistantMessageActionPart>['content'];
    workflow: z.infer<typeof Workflow>;
    handleApplyChange: (messageIndex: number, actionIndex: number, field?: string) => void;
    appliedChanges: Record<string, boolean>;
    stale: boolean;
}) {
    const [expanded, setExpanded] = useState(false);

    // determine whether all changes contained in this action are applied
    const appliedFields = Object.keys(action.config_changes).filter(key => appliedChanges[getAppliedChangeKey(msgIndex, actionIndex, key)]);
    console.log('appliedFields', appliedFields);

    // determine whether all changes contained in this action are applied
    const allApplied = Object.keys(action.config_changes).every(key => appliedFields.includes(key));

    // generate apply change function
    const applyChangeHandler = () => {
        handleApplyChange(msgIndex, actionIndex);
    }

    return <div className={clsx('flex flex-col rounded-sm border border-t-4', {
        'bg-gray-50 border-gray-400 border-t-blue-500 shadow': !stale && !allApplied && action.action == 'create_new',
        'bg-gray-50 border-gray-400 border-t-orange-500 shadow': !stale && !allApplied && action.action == 'edit',
        'bg-gray-100 border-gray-400 border-t-gray-400': stale || allApplied || action.error,
    })}>
        <ActionContext.Provider value={{ msgIndex, actionIndex, action, workflow, handleApplyChange, appliedFields, stale }}>
            <ActionHeader />
            <ActionSummary />
            {expanded && <PreviewModalProvider>
                {action.error && <div className="flex flex-col gap-1 px-1 text-xs bg-red-50 rounded-sm">
                    <div className="text-red-500 font-medium text-xs">This configuration is invalid and cannot be applied:</div>
                    <div className="text-xs font-mono">{action.error}</div>
                </div>}
                <div className="flex flex-col gap-2 px-1">
                    {Object.entries(action.config_changes).map(([key, value]) => {
                        return <ActionField key={key} field={key} />
                    })}
                </div>
            </PreviewModalProvider>}
            <div className="flex items-center">
                {action.error && <div className="grow rounded-l-sm bg-red-100 text-red-500 flex flex-col items-center justify-center h-8">
                    <div className="flex items-center gap-2 justify-center">
                        <AlertTriangleIcon size={16} />
                        <div className="font-medium text-xs">Error</div>
                    </div>
                </div>}
                {!action.error && <button
                    className="grow rounded-l-sm bg-blue-100 text-blue-500 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-300 flex flex-col items-center justify-center h-8"
                    onClick={applyChangeHandler}
                    disabled={stale || allApplied}
                >
                    <div className="flex items-center gap-2 justify-center">
                        <CheckCheckIcon size={16} />
                        <div className="font-medium text-xs">{allApplied ? 'Applied' : 'Apply'}</div>
                    </div>
                </button>}
                <button
                    className="w-10 shrink-0 flex flex-col items-center h-8 rounded-r-sm bg-gray-100 text-gray-600 hover:bg-gray-200 justify-center"
                    onClick={() => setExpanded(!expanded)}
                >
                    <div className="flex items-center gap-2 justify-center text-gray-400">
                        {expanded ? (
                            <ChevronsUpIcon size={16} />
                        ) : (
                            <ChevronsDownIcon size={16} />
                        )}
                    </div>
                </button>
            </div>
        </ActionContext.Provider>
    </div>;
}

export function ActionSummary() {
    const { msgIndex, actionIndex, action, workflow, handleApplyChange, appliedFields, stale } = useContext(ActionContext);
    if (!action || !workflow) return null;

    return <div className="px-1 my-1">
        <div className="bg-white rounded-sm p-2 text-sm">
            {action.change_description}
        </div>
    </div>;
}

export function ActionHeader() {
    const { msgIndex, actionIndex, action, workflow, handleApplyChange, appliedFields, stale } = useContext(ActionContext);
    if (!action || !workflow) return null;

    const targetType = action.config_type === 'tool' ? 'tool' : action.config_type === 'agent' ? 'agent' : 'prompt';
    const change = action.action === 'create_new' ? 'Create' : 'Edit';

    return <div className="flex gap-2 items-center py-1 px-1">
        {action.action == 'create_new' && <PlusIcon size={16} />}
        {action.action == 'edit' && <PencilIcon size={16} />}
        <div className="text-sm truncate">{`${change} ${targetType}`}: <span className="font-medium">{action.name}</span></div>
    </div>;
}

export function ActionField({
    field,
}: {
    field: string;
}) {
    const { msgIndex, actionIndex, action, workflow, handleApplyChange, appliedFields, stale } = useContext(ActionContext);
    const { showPreview } = usePreviewModal();
    if (!action || !workflow) return null;

    // determine whether this field is applied
    const applied = appliedFields.includes(field);

    const newValue = action.config_changes[field];
    // Get the old value if this is an edit action
    let oldValue = undefined;
    if (action.action === 'edit') {
        if (action.config_type === 'tool') {
            // Find the tool in the workflow
            const tool = workflow.tools.find(t => t.name === action.name);
            if (tool) {
                oldValue = tool[field as keyof typeof tool];
            }
        } else if (action.config_type === 'agent') {
            // Find the agent in the workflow
            const agent = workflow.agents.find(a => a.name === action.name);
            if (agent) {
                oldValue = agent[field as keyof typeof agent];
            }
        } else if (action.config_type === 'prompt') {
            // Find the prompt in the workflow
            const prompt = workflow.prompts.find(p => p.name === action.name);
            if (prompt) {
                oldValue = prompt[field as keyof typeof prompt];
            }
        }
    }

    // if edit type of action, preview is enabled
    const previewCondition = action.action === 'edit' ||
        (action.config_type === 'agent' && field === 'instructions');

    // enable markdown preview for some fields
    const markdownPreviewCondition = (action.config_type === 'agent' && field === 'instructions') ||
        (action.config_type === 'agent' && field === 'examples') ||
        (action.config_type === 'prompt' && field === 'prompt') ||
        (action.config_type === 'tool' && field === 'description');

    // generate preview modal function
    const previewModalHandler = () => {
        if (previewCondition) {
            showPreview(
                oldValue ? (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)) : undefined,
                (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)),
                markdownPreviewCondition,
                `${action.name} - ${field}`
            );
        }
    }

    // generate apply change function
    const applyChangeHandler = () => {
        handleApplyChange(msgIndex, actionIndex, field);
    }

    return <div className="flex flex-col bg-white rounded-sm">
        <div className="flex justify-between items-start">
            <div className="text-xs font-semibold px-2 py-1 text-gray-600">{field}</div>
            {previewCondition && <div className="flex gap-4 items-center bg-gray-50 rounded-bl-sm rounded-tr-sm px-2 py-1">
                <button
                    className="text-gray-500 hover:text-black"
                    onClick={previewModalHandler}
                >
                    <EyeIcon size={16} />
                </button>
                {action.action === 'edit' && !action.error && <button
                    className={clsx("text-gray-500 hover:text-black", {
                        'text-green-600': applied,
                        'text-gray-600': stale,
                    })}
                    onClick={applyChangeHandler}
                    disabled={stale || applied}
                >
                    <CheckIcon size={16} />
                </button>}
            </div>}
        </div>
        <div className="px-2 pb-1">
            <div className="text-sm italic truncate">
                {JSON.stringify(newValue)}
            </div>
        </div>
    </div>;
}


// function ActionToolParamsView({
//     params,
// }: {
//     params: z.infer<typeof Workflow>['tools'][number]['parameters'];
// }) {
//     const required = params?.required || [];

//     return <ActionField label="parameters">
//         <div className="flex flex-col gap-2 text-sm">
//             {Object.entries(params?.properties || {}).map(([paramName, paramConfig]) => {
//                 return <div className="flex flex-col gap-1">
//                     <div className="flex gap-1 items-center">
//                         <svg className="w-[16px] h-[16px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
//                             <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14" />
//                         </svg>
//                         <div>{paramName}{required.includes(paramName) && <sup>*</sup>}</div>
//                         <div className="text-gray-500">{paramConfig.type}</div>
//                     </div>
//                     <div className="flex gap-1 ml-4">
//                         <div className="text-gray-500 italic">{paramConfig.description}</div>
//                     </div>
//                 </div>;
//             })}
//         </div>
//     </ActionField>;
// }

// function ActionAgentToolsView({
//     action,
//     tools,
// }: {
//     action: z.infer<typeof CopilotAssistantMessage>['content']['Actions'][number];
//     tools: z.infer<typeof Workflow>['agents'][number]['tools'];
// }) {
//     const { workflow } = useContext(CopilotContext);
//     if (!workflow) {
//         return <></>;
//     }

//     // find the agent in the workflow
//     const agent = workflow.agents.find((agent) => agent.name === action.name);
//     if (!agent) {
//         return <></>;
//     }

//     // find the tools that were removed
//     const removedTools = agent.tools.filter((tool) => !tools.includes(tool));

//     return <ActionField label="tools">
//         {removedTools.length > 0 && <div className="flex flex-col gap-1 text-sm">
//             <div className="text-gray-500 italic">The following tools were removed:</div>
//             <div className="flex flex-col gap-1">
//                 {removedTools.map((tool) => {
//                     return <div className="flex gap-1 items-center">
//                         <svg className="w-[16px] h-[16px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
//                             <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14" />
//                         </svg>
//                         <div>{tool}</div>
//                     </div>;
//                 })}
//             </div>
//         </div>}
//         <div className="flex flex-col gap-1 text-sm">
//             <div className="text-gray-500 italic">The following tools were added:</div>
//             <div className="flex flex-col gap-1">
//                 {tools.map((tool) => {
//                     return <div className="flex gap-1 items-center">
//                         <svg className="w-[16px] h-[16px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
//                             <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14" />
//                         </svg>
//                         <div>{tool}</div>
//                     </div>;
//                 })}
//             </div>
//         </div>
//     </ActionField>;
// }
