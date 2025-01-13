'use client';

import { Button, Input } from "@nextui-org/react";
import { useState } from "react";
import { updateWebhookUrl } from "@/app/actions";

export function WebhookUrl({ 
    initialUrl,
    projectId 
}: { 
    initialUrl?: string,
    projectId: string
}) {
    const [url, setUrl] = useState(initialUrl || '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleUpdate = async () => {
        try {
            setIsLoading(true);
            setError(null);
            setShowSuccess(false);
            
            // URL validation
            let parsedUrl;
            try {
                parsedUrl = new URL(url);
            } catch {
                setError('Please enter a valid URL');
                return;
            }

            // Ensure HTTPS scheme
            if (parsedUrl.protocol !== 'https:') {
                setError('URL must use HTTPS');
                return;
            }

            await updateWebhookUrl(projectId, url);
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
            }, 3000);
        } catch (error) {
            console.error('Failed to update webhook URL:', error);
            setError('Failed to update webhook URL');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-end">
                <Input
                    label="Webhook URL"
                    labelPlacement="outside"
                    placeholder="https://example.com/webhook"
                    value={url}
                    onChange={(e) => {
                        setUrl(e.target.value);
                        setError(null);
                        setShowSuccess(false);
                    }}
                    className="flex-grow"
                    isInvalid={!!error}
                    errorMessage={error}
                    description={showSuccess ? "Webhook URL updated successfully" : undefined}
                />
                <Button 
                    color="primary"
                    onClick={handleUpdate}
                    isLoading={isLoading}
                >
                    Update
                </Button>
            </div>
        </div>
    );
} 