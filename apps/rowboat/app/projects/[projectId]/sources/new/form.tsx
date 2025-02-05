'use client';
import { Input, Select, SelectItem, Textarea } from "@nextui-org/react"
import { useState } from "react";
import { createCrawlDataSource, createUrlsDataSource } from "@/app/actions";
import { FormStatusButton } from "@/app/lib/components/FormStatusButton";
import { DataSourceIcon } from "@/app/lib/components/datasource-icon";

export function Form({
    projectId
}: {
    projectId: string;
}) {
    const [sourceType, setSourceType] = useState("");

    // const createCrawlDataSourceWithProjectId = createCrawlDataSource.bind(null, projectId);
    const createUrlsDataSourceWithProjectId = createUrlsDataSource.bind(null, projectId);

    function handleSourceTypeChange(event: React.ChangeEvent<HTMLSelectElement>) {
        setSourceType(event.target.value);
    }

    return <div className="grow overflow-auto py-4">
        <div className="max-w-[768px] mx-auto flex flex-col gap-4">
            <Select
                label="Select type"
                selectedKeys={[sourceType]}
                onChange={handleSourceTypeChange}
            >
                {/* <SelectItem
                    key="crawl"
                    value="crawl"
                    startContent={<DataSourceIcon type="crawl" />}
                >
                    Crawl URLs
                </SelectItem> */}
                <SelectItem
                    key="urls"
                    value="urls"
                    startContent={<DataSourceIcon type="urls" />}
                >
                    Scrape URLs
                </SelectItem>
            </Select>

            {/* {sourceType === "crawl" && <form
                action={createCrawlDataSourceWithProjectId}
                className="flex flex-col gap-4"
            >
                <Input
                    required
                    type="text"
                    name="url"
                    label="Specify starting URL to crawl"
                    labelPlacement="outside"
                    placeholder="https://example.com"
                    variant="bordered"
                />
                <div className="self-start w-[200px]">
                    <Input
                        required
                        type="number"
                        min={1}
                        max={5000}
                        name="limit"
                        label="Maximum pages to crawl"
                        labelPlacement="outside"
                        placeholder="100"
                        defaultValue={"100"}
                        variant="bordered"
                    />
                </div>
                <div className="self-start">
                    <Input
                        required
                        type="text"
                        name="name"
                        label="Name this data source"
                        labelPlacement="outside"
                        placeholder="e.g. Help articles"
                        variant="bordered"
                    />
                </div>
                <div className="text-sm">
                    <p>Note:</p>
                    <ul className="list-disc ml-4">
                        <li>Expect about 5-10 minutes to crawl 100 pages</li>
                    </ul>
                </div>
                <FormStatusButton
                    props={{
                        type: "submit",
                        children: "Add data source",
                        className: "self-start",
                        startContent: <svg className="w-[24px] h-[24px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14m-7 7V5" />
                        </svg>,
                    }}
                />
            </form>} */}

            {sourceType === "urls" && <form
                action={createUrlsDataSourceWithProjectId}
                className="flex flex-col gap-4"
            >
                <Textarea
                    required
                    type="text"
                    name="urls"
                    label="Specify URLs (one per line)"
                    minRows={5}
                    maxRows={10}
                    labelPlacement="outside"
                    placeholder="https://example.com"
                    variant="bordered"
                />
                <div className="self-start">
                    <Input
                        required
                        type="text"
                        name="name"
                        label="Name this data source"
                        labelPlacement="outside"
                        placeholder="e.g. Help articles"
                        variant="bordered"
                    />
                </div>
                <div className="text-sm">
                    <p>Note:</p>
                    <ul className="list-disc ml-4">
                        <li>Expect about 5-10 minutes to scrape 100 pages</li>
                        <li>Only the first 100 (valid) URLs will be scraped</li>
                    </ul>
                </div>
                <FormStatusButton
                    props={{
                        type: "submit",
                        children: "Add data source",
                        className: "self-start",
                        startContent: <svg className="w-[24px] h-[24px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14m-7 7V5" />
                        </svg>,
                    }}
                />
            </form>}
        </div>
    </div>;
}