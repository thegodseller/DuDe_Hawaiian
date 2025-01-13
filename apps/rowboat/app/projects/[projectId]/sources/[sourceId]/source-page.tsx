'use client';
import { DataSource } from "@/app/lib/types";
import { PageSection } from "@/app/lib/components/PageSection";
import { ToggleSource } from "../toggle-source";
import { Link, Spinner } from "@nextui-org/react";
import { SourceStatus } from "../source-status";
import { DeleteSource } from "./delete";
import { Recrawl } from "./web-recrawl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getDataSource, recrawlWebDataSource } from "@/app/actions";
import { DataSourceIcon } from "@/app/lib/components/datasource-icon";
import { z } from "zod";

function UrlList({ urls }: { urls: string }) {
    return <pre className="max-w-[450px] border p-1 border-gray-300 rounded overflow-auto min-h-7 max-h-52 text-nowrap">
        {urls}
    </pre>;
}

function TableLabel({ children, className }: { children: React.ReactNode, className?: string }) {
    return <th className={`font-medium text-gray-800 text-left align-top pr-4 py-4 ${className}`}>{children}</th>;
}
function TableValue({ children, className }: { children: React.ReactNode, className?: string }) {
    return <td className={`align-top py-4 ${className}`}>{children}</td>;
}

export function SourcePage({
    sourceId,
    projectId,
}: {
    sourceId: string;
    projectId: string;
}) {
    const searchParams = useSearchParams();
    const [source, setSource] = useState<z.infer<typeof DataSource> | null>(null);

    // fetch source daat first time
    useEffect(() => {
        let ignore = false;
        async function fetchSource() {
            const source = await getDataSource(projectId, sourceId);
            if (!ignore) {
                setSource(source);
            }
        }
        fetchSource();
        return () => {
            ignore = true;
        };
    }, [projectId, sourceId]);

    // refresh source data every 15 seconds
    // under certain conditions
    useEffect(() => {
        let ignore = false;
        let timeout: NodeJS.Timeout | null = null;

        if (!source) {
            return;
        }
        if (source.status !== 'processing' && source.status !== 'new') {
            return;
        }

        async function refresh() {
            if (timeout) {
                clearTimeout(timeout);
            }
            const updatedSource = await getDataSource(projectId, sourceId);
            if (!ignore) {
                setSource(updatedSource);
                timeout = setTimeout(refresh, 15 * 1000);
            }
        }
        timeout = setTimeout(refresh, 15 * 1000);

        return () => {
            ignore = true;
            if (timeout) {
                clearTimeout(timeout);
            }
        };
    }, [source, projectId, sourceId]);

    async function handleRefresh() {
        await recrawlWebDataSource(projectId, sourceId);
        const updatedSource = await getDataSource(projectId, sourceId);
        setSource(updatedSource);
    }

    if (!source) {
        return <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <div>Loading...</div>
        </div>
    }

    return <div className="flex flex-col h-full">
        <div className="shrink-0 flex justify-between items-center pb-4 border-b border-b-gray-100">
            <div className="flex flex-col">
                <h1 className="text-lg">{source.name}</h1>
            </div>
        </div>
        <div className="grow overflow-auto py-4">
            <div className="max-w-[768px] mx-auto">
                <PageSection title="Details">
                    <table className="table-auto">
                        <tbody>
                            <tr>
                                <TableLabel>Toggle:</TableLabel>
                                <TableValue>
                                    <ToggleSource projectId={projectId} sourceId={sourceId} active={source.active} />
                                </TableValue>
                            </tr>
                            <tr>
                                <TableLabel>Type:</TableLabel>
                                <TableValue>
                                    {source.data.type === 'crawl' && <div className="flex gap-1 items-center">
                                        <DataSourceIcon type="crawl" />
                                        <div>Crawl URLs</div>
                                    </div>}
                                    {source.data.type === 'urls' && <div className="flex gap-1 items-center">
                                        <DataSourceIcon type="urls" />
                                        <div>Specify URLs</div>
                                    </div>}
                                </TableValue>
                            </tr>
                            <tr>
                                <TableLabel>Source:</TableLabel>
                                <TableValue>
                                    <SourceStatus status={source.status} projectId={projectId} />
                                </TableValue>
                            </tr>
                            {source.data.type === 'urls' && source.data.missingUrls && <tr>
                                <TableLabel className="text-red-500">Errors:</TableLabel>
                                <TableValue>
                                    <div>Some URLs could not be scraped. See the list below.</div>
                                </TableValue>
                            </tr>}
                        </tbody>
                    </table>
                </PageSection>
                {source.data.type === 'crawl' && <PageSection title="Crawl details">
                    <table className="table-auto">
                        <tbody>
                            <tr>
                                <TableLabel>Starting URL:</TableLabel>
                                <TableValue>
                                    <Link
                                        href={source.data.startUrl}
                                        target="_blank"
                                        showAnchorIcon
                                        color="foreground"
                                        underline="always"
                                    >
                                        {source.data.startUrl}
                                    </Link>
                                </TableValue>
                            </tr>
                            <tr>
                                <TableLabel>Limit:</TableLabel>
                                <TableValue>
                                    {source.data.limit} pages
                                </TableValue>
                            </tr>
                            {source.data.crawledUrls && <tr>
                                <TableLabel>Crawled URLs:</TableLabel>
                                <TableValue>
                                    <UrlList urls={source.data.crawledUrls} />
                                </TableValue>
                            </tr>}
                        </tbody>
                    </table>
                </PageSection>}
                {source.data.type === 'urls' && <PageSection title="Index details">
                    <table className="table-auto">
                        <tbody>
                            <tr>
                                <TableLabel>Input URLs:</TableLabel>
                                <TableValue>
                                    <UrlList urls={source.data.urls.join('\n')} />
                                </TableValue>
                            </tr>
                            {source.data.scrapedUrls && <tr>
                                <TableLabel>Scraped URLs:</TableLabel>
                                <TableValue>
                                    <UrlList urls={source.data.scrapedUrls} />
                                </TableValue>
                            </tr>}
                            {source.data.missingUrls && <tr>
                                <TableLabel className="text-red-500">The following URLs could not be scraped:</TableLabel>
                                <TableValue>
                                    <UrlList urls={source.data.missingUrls} />
                                </TableValue>
                            </tr>}
                        </tbody>
                    </table>
                </PageSection>}
                {(source.status === 'completed' || source.status === 'error') && (source.data.type === 'crawl' || source.data.type === 'urls') && <PageSection title="Refresh">
                    <div className="flex flex-col gap-2 items-start">
                        <p>{source.data.type === 'crawl' ? 'Crawl' : 'Scrape'} the URLs again to fetch updated content:</p>
                        <Recrawl projectId={projectId} sourceId={sourceId} handleRefresh={handleRefresh} />
                    </div>
                </PageSection>}
                <PageSection title="Danger zone">
                    <div className="flex flex-col gap-2 items-start">
                        <p>Delete this data source:</p>
                        <DeleteSource projectId={projectId} sourceId={sourceId} />
                    </div>
                </PageSection>
            </div>
        </div>
    </div>;
}