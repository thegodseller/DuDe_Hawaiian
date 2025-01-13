'use client';

import { Metadata } from "next";
import { Secret } from "./secret";
import { Divider, Spinner } from "@nextui-org/react";
import { useEffect, useState } from "react";
import { Project } from "@/app/lib/types";
import { getProjectConfig } from "@/app/actions";
import { EmbedCode } from "./embed";
import { WebhookUrl } from "./webhook-url";
import { z } from 'zod';

export const metadata: Metadata = {
    title: "Project config",
};

export default function App({
    projectId,
}: {
    projectId: string;
}) {
    const [isLoading, setIsLoading] = useState(true);
    const [project, setProject] = useState<z.infer<typeof Project> | null>(null);

    useEffect(() => {
        let ignore = false;

        async function fetchProjectConfig() {
            setIsLoading(true);
            const project = await getProjectConfig(projectId);
            if (!ignore) {
                setProject(project);
                setIsLoading(false);
            }
        }
        fetchProjectConfig();

        return () => {
            ignore = true;
        };
    }, [projectId]);

    const standardEmbedCode = `<!-- RowBoat Chat Widget -->
<script>
    window.ROWBOAT_CONFIG = {
        clientId: '${project?.chatClientId}'
    };
    (function(d) {
        var s = d.createElement('script');
        s.src = 'https://chat.rowboatlabs.com/bootstrap.js';
        s.async = true;
        d.getElementsByTagName('head')[0].appendChild(s);
    })(document);
</script>`;

    const nextJsEmbedCode = `// Add this to your Next.js page or layout
import Script from 'next/script'

export default function YourComponent() {
  return (
    <>
      <Script id="rowboat-config">
        {\`window.ROWBOAT_CONFIG = {
          clientId: '${project?.chatClientId}'
        };\`}
      </Script>
      <Script
        src="https://chat.rowboatlabs.com/bootstrap.js"
        strategy="lazyOnload"
      />
    </>
  )
}`

    return <div className="flex flex-col h-full">
        <div className="shrink-0 flex justify-between items-center pb-4 border-b border-b-gray-100">
            <div className="flex flex-col">
                <h1 className="text-lg">Project config</h1>
            </div>
        </div>
        <div className="grow overflow-auto py-4">
            <div className="max-w-[768px] mx-auto">
                {isLoading && <div className="flex items-center gap-1">
                    <Spinner size="sm" />
                    <div>Loading project config...</div>
                </div>}
                {!isLoading && project && <div className="flex flex-col gap-4">
                    <h2 className="font-semibold">Credentials</h2>
                    <Secret
                        initialSecret={project.secret}
                        projectId={projectId}
                    />

                    <Divider />

                    <div className="flex flex-col gap-4">
                        <h2 className="text-xl font-semibold">Add the chat widget to your website</h2>
                        <p className="text-gray-600">Copy and paste this code snippet just before the closing &lt;/body&gt; tag of your website:</p>
                        <EmbedCode key="standard-embed-code" embedCode={standardEmbedCode} />
                    </div>

                    <div className="flex flex-col gap-4">
                        <h2 className="text-lg font-medium">Using Next.js?</h2>
                        <p className="text-gray-600">If you&apos;re using Next.js, use this code instead:</p>
                        <EmbedCode key="nextjs-embed-code" embedCode={nextJsEmbedCode} />
                    </div>

                    <Divider />

                    <div>
                        <h2 className="text-xl font-semibold">Webhook settings</h2>
                        <p className="mb-4">
                            You can configure a webhook that will respond to tool calls.
                        </p>
                        <WebhookUrl
                            initialUrl={project?.webhookUrl}
                            projectId={projectId}
                        />
                    </div>
                </div>}
            </div>
        </div>
    </div>;
}