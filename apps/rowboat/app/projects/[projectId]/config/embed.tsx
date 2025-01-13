'use client';

import React from 'react';
import { Textarea, Button } from "@nextui-org/react";
import { CheckIcon, ClipboardIcon } from 'lucide-react';

interface EmbedCodeProps {
    embedCode: string;
}

export function EmbedCode({ embedCode }: EmbedCodeProps) {
    const [isCopied, setIsCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(embedCode);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1000);
    };

    return (
        <div className="relative">
            <Textarea
                labelPlacement="outside"
                variant="bordered"
                defaultValue={embedCode}
                className="max-w-full cursor-pointer"
                readOnly
                onClick={handleCopy}
            />
            <div className="absolute bottom-2 right-2">
                <Button
                    variant="flat"
                    size="sm"
                    onClick={handleCopy}
                    isIconOnly
                >
                    {isCopied ? <CheckIcon size={16} /> : <ClipboardIcon size={16} />}
                </Button>
            </div>
        </div>
    );
}