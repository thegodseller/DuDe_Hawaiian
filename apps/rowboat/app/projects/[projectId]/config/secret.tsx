'use client';

import { Button, Input } from "@nextui-org/react";
import { useState } from "react";
import { rotateSecret } from "@/app/actions";
import { CheckIcon, ClipboardIcon } from "lucide-react";

export function Secret({
    initialSecret,
    projectId
}: {
    initialSecret: string,
    projectId: string
}) {
    const getMaskedSecret = (secret: string) => {
        if (!secret) return '';
        if (secret.length <= 8) return secret;
        return `${secret.slice(0, 4)}${'•'.repeat(16)}${secret.slice(-4)}`;
    };

    const [maskedSecret, setMaskedSecret] = useState(getMaskedSecret(initialSecret));
    const [showNewSecret, setShowNewSecret] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showCopySuccess, setShowCopySuccess] = useState(false);

    const handleRegenerate = async () => {
        if (!window.confirm('Are you sure you want to regenerate the webhook secret? This will invalidate the current secret key immediately.')) {
            return;
        }
        try {
            setIsLoading(true);
            const newSecret = await rotateSecret(projectId);
            setShowNewSecret(newSecret);
            setMaskedSecret(getMaskedSecret(newSecret));
        } catch (error) {
            console.error('Failed to regenerate webhook secret:', error);
            // You might want to add a toast or error message here
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (showNewSecret) {
            await navigator.clipboard.writeText(showNewSecret);
            setShowCopySuccess(true);
            setTimeout(() => {
                setShowCopySuccess(false);
            }, 1500);
        }
    };

    return (
        <div className="mt-4">
            <div className="text-sm text-gray-600 mb-2">Project Secret</div>
            <div className="flex gap-2 items-center">
                <Input
                    value={showNewSecret || maskedSecret}
                    readOnly
                    variant="bordered"
                    className="font-mono"
                    endContent={
                        showNewSecret ? (
                            <Button
                                isIconOnly
                                variant="light"
                                onClick={handleCopy}
                            >
                                {showCopySuccess ? (
                                    <CheckIcon size={16} />
                                ) : (
                                    <ClipboardIcon size={16} />
                                )}
                            </Button>
                        ) : null
                    }
                />
                <Button
                    color="primary"
                    variant="flat"
                    onClick={handleRegenerate}
                    isLoading={isLoading}
                >
                    Regenerate
                </Button>
            </div>
            {showNewSecret && (
                <div className="text-sm text-red-600 mt-2">
                    Make sure to copy your new secret key. It won&apos;t be shown again!
                </div>
            )}
        </div>
    );
} 