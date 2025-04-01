"use client";
import { PageSection } from "../../../../lib/components/page-section";
import { WithStringId } from "../../../../lib/types/types";
import { DataSource } from "../../../../lib/types/datasource_types";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Textarea } from "@heroui/react";
import { FormStatusButton } from "../../../../lib/components/form-status-button";
import { Spinner } from "@heroui/react";
import { addDocsToDataSource, deleteDocsFromDataSource, listDocsInDataSource } from "../../../../actions/datasource_actions";

export function TextSource({
    projectId,
    dataSource,
    handleReload,
}: {
    projectId: string,
    dataSource: WithStringId<z.infer<typeof DataSource>>,
    handleReload: () => void;
}) {
    const [content, setContent] = useState("");
    const [docId, setDocId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let ignore = false;

        async function fetchContent() {
            setIsLoading(true);
            try {
                const { files } = await listDocsInDataSource({
                    projectId,
                    sourceId: dataSource._id,
                    limit: 1,
                });

                console.log('got data', files);

                if (!ignore && files.length > 0) {
                    const doc = files[0];
                    if (doc.data.type === 'text') {
                        setContent(doc.data.content);
                        setDocId(doc._id);
                    }
                }
            } catch (error) {
                console.error('Error fetching content:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchContent();
        return () => {
            ignore = true;
        };
    }, [projectId, dataSource._id]);

    async function handleSubmit(formData: FormData) {
        setIsSaving(true);
        try {
            const newContent = formData.get('content') as string;

            // Delete existing doc if it exists
            if (docId) {
                await deleteDocsFromDataSource({
                    projectId,
                    sourceId: dataSource._id,
                    docIds: [docId],
                });
            }

            // Add new doc
            await addDocsToDataSource({
                projectId,
                sourceId: dataSource._id,
                docData: [{
                    name: 'text',
                    data: {
                        type: 'text',
                        content: newContent,
                    },
                }],
            });

            handleReload();
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return (
            <PageSection title="Content">
                <div className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    <p>Loading content...</p>
                </div>
            </PageSection>
        );
    }

    return (
        <PageSection title="Content">
            <form action={handleSubmit} className="flex flex-col gap-4">
                <Textarea
                    name="content"
                    label="Text content"
                    labelPlacement="outside"
                    value={content}
                    onValueChange={setContent}
                    minRows={10}
                    maxRows={20}
                    variant="bordered"
                />
                <FormStatusButton
                    props={{
                        type: "submit",
                        children: "Update content",
                        className: "self-start",
                        isLoading: isSaving,
                    }}
                />
            </form>
        </PageSection>
    );
}
