import { createContext, useContext, useEffect, useState } from "react";
import clsx from "clsx";
import MarkdownContent from "../../../lib/components/markdown-content";
import React, { PureComponent } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

// Create the context type
export type PreviewModalContextType = {
    showPreview: (
        oldValue: string | undefined,
        newValue: string,
        markdown: boolean,
        title: string
    ) => void;
};

// Create the context
export const PreviewModalContext = createContext<PreviewModalContextType>({ 
    showPreview: () => {} 
});

// Export the hook for easy usage
export const usePreviewModal = () => useContext(PreviewModalContext);

// Create the provider component
export function PreviewModalProvider({ children }: { children: React.ReactNode }) {
    const [modalProps, setModalProps] = useState<{
        oldValue?: string;
        newValue: string;
        markdown: boolean;
        title: string;
        isOpen: boolean;
    }>({
        newValue: '',
        markdown: false,
        title: '',
        isOpen: false
    });

    // Handle Esc key
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setModalProps(prev => ({ ...prev, isOpen: false }));
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const showPreview = (oldValue: string | undefined, newValue: string, markdown: boolean, title: string) => {
        setModalProps({ oldValue, newValue, markdown, title, isOpen: true });
    };

    return (
        <PreviewModalContext.Provider value={{ showPreview }}>
            {children}
            {modalProps.isOpen && (
                <PreviewModal
                    {...modalProps}
                    onClose={() => setModalProps(prev => ({ ...prev, isOpen: false }))}
                />
            )}
        </PreviewModalContext.Provider>
    );
}

// The modal component
function PreviewModal({
    oldValue = undefined,
    newValue,
    markdown = false,
    title,
    onClose,
}: {
    oldValue?: string | undefined;
    newValue: string;
    markdown?: boolean;
    title: string;
    onClose: () => void;
}) {
    const buttonLabel = oldValue === undefined ? 'Preview' : 'Diff';
    const [view, setView] = useState<'preview' | 'markdown'>('preview');
    console.log(oldValue, newValue);

    return <div className="fixed left-0 top-0 w-full h-full bg-gray-500/50 backdrop-blur-sm flex justify-center items-center z-50">
        <div className="bg-gray-100 rounded-md p-2 flex flex-col w-[90%] h-[90%] max-w-7xl max-h-[800px]">
            <button className="self-end text-gray-500 hover:text-gray-700 flex items-center gap-1" 
                onClick={onClose}
            >
                <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M6 18 17.94 6M18 18 6.06 6" />
                </svg>
                <div className="text-sm">Close</div>
            </button>
            <div className="flex flex-col overflow-auto">
                <div className="flex justify-between items-center">
                    <div className="text-md font-semibold">{title}</div>
                    <div className="flex items-center">
                        <button className={clsx("text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded-t-md", {
                            'bg-white': view === 'preview',
                        })} onClick={() => setView('preview')}>{buttonLabel}</button>
                        {markdown && <button className={clsx("text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded-t-md", {
                            'bg-white': view === 'markdown',
                        })} onClick={() => setView('markdown')}>Markdown</button>}
                    </div>
                </div>
                <div className="bg-white rounded-md grow overflow-auto">
                    <div className="h-full flex flex-col overflow-auto">
                        {view === 'preview' && <div className="flex gap-1 overflow-auto text-sm">
                            {oldValue !== undefined && <ReactDiffViewer
                                oldValue={oldValue}
                                newValue={newValue}
                                splitView={true}
                                compareMethod={DiffMethod.WORDS_WITH_SPACE}
                            />}
                            {oldValue === undefined && <pre className="p-2 overflow-auto">{newValue}</pre>}
                        </div>}
                        {view === 'markdown' && <div className="flex gap-1">
                            {oldValue !== undefined && <div className="w-1/2 flex flex-col border-r-2 border-gray-200 overflow-auto">
                                <div className="text-gray-800 font-semibold italic text-sm px-2 py-1 border-b-1 border-gray-200">Old</div>
                                <div className="p-2 overflow-auto">
                                    <MarkdownContent
                                        content={oldValue}
                                    />
                                </div>
                            </div>}
                            <div className={clsx("flex flex-col", {
                                'w-1/2': oldValue !== undefined
                            })}>
                                {oldValue !== undefined && <div className="text-gray-800 font-semibold italic text-sm px-2 py-1 border-b-1 border-gray-200">New</div>}
                                <div className="p-2 overflow-auto">
                                    <MarkdownContent
                                        content={newValue}
                                    />
                                </div>
                            </div>
                        </div>}
                    </div>
                </div>
            </div>
        </div>
    </div>;
} 