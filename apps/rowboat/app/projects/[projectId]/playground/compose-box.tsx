'use client';

import { Button, Spinner, Textarea } from "@nextui-org/react";
import { useRef, useState, useEffect } from "react";
import { apiV1 } from "rowboat-shared";
import { z } from "zod";

export function ComposeBox({
    minRows=3,
    disabled=false,
    loading=false,
    handleUserMessage,
    messages,
}: {
    minRows?: number;
    disabled?: boolean;
    loading?: boolean;
    handleUserMessage: (prompt: string) => void;
    messages: z.infer<typeof apiV1.ChatMessage>[];
}) {
    const [input, setInput] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    function handleInput() {
        const prompt = input.trim();
        if (!prompt) {
            return;
        }
        setInput('');

        handleUserMessage(prompt);
    }

    function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleInput();
        }
    }
    // focus on the input field
    useEffect(() => {
        inputRef.current?.focus();
    }, [messages]);

    return <Textarea
        required
        ref={inputRef}
        variant="bordered"
        placeholder="Enter message..."
        minRows={minRows}
        maxRows={5}
        value={input}
        onValueChange={setInput}
        onKeyDown={handleInputKeyDown}
        disabled={disabled}
        className="w-full"
        endContent={<Button
            isIconOnly
            disabled={disabled}
            onClick={handleInput}
            className="bg-gray-100"
        >
            {!loading && <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 6v13m0-13 4 4m-4-4-4 4" />
            </svg>}
            {loading && <Spinner size="sm" />}
        </Button>}
    />;
}