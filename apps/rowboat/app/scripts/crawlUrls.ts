import '../lib/loadenv';
import FirecrawlApp, { CrawlStatusResponse, ErrorResponse, FirecrawlDocument } from '@mendable/firecrawl-js';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { z } from 'zod';
import { Document } from '@langchain/core/documents';
import * as fs from 'fs/promises';
import { dataSourcesCollection, embeddingsCollection, webpagesCollection } from '../lib/mongodb';
import { DataSource, EmbeddingDoc } from '../lib/types';
import { WithId } from 'mongodb';
import assert from 'assert';
import { embedMany, generateText } from 'ai';
import { embeddingModel } from '../lib/embedding';
import { openai } from '@ai-sdk/openai';
import { WriteStream } from 'fs';
import * as cheerio from 'cheerio';
import { ObjectId } from 'mongodb';
import path from 'path';
const oxylabsUsername = process.env.OXYLABS_USERNAME;
const oxylabsPassword = process.env.OXYLABS_PASSWORD;
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

const oxylabsHttpAuth = {
    'Authorization': 'Basic ' + Buffer.from(`${oxylabsUsername}:${oxylabsPassword}`).toString('base64'),
}
const firecrawlHttpAuth = {
    'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
}

type Webpage = {
    title: string,
    url: string,
    markdown: string,
    html: string,
}

const splitter = new RecursiveCharacterTextSplitter({
    separators: ['\n\n', '\n', '. ', '.', ''],
    chunkSize: 1024,
    chunkOverlap: 20,
});

type OxylabsDocument = {
    url: string,
    content: string,
}

const second = 1000;
const minute = 60 * second;
const hour = 60 * minute;
const day = 24 * hour;

const firecrawlStatusPollInterval = 60 * second;
const oxylabsStatusPollInterval = 60 * second;


// create a PrefixLogger class that wraps console.log with a prefix
// and allows chaining with a parent logger
class PrefixLogger {
    private prefix: string;
    private parent: PrefixLogger | null;

    constructor(prefix: string, parent: PrefixLogger | null = null) {
        this.prefix = prefix;
        this.parent = parent;
    }

    log(...args: any[]) {
        const timestamp = new Date().toISOString();
        const prefix = '[' + this.prefix + ']';

        if (this.parent) {
            this.parent.log(prefix, ...args);
        } else {
            console.log(timestamp, prefix, ...args);
        }
    }

    child(childPrefix: string): PrefixLogger {
        return new PrefixLogger(childPrefix, this);
    }
}

/*
const source: z.infer<typeof SourceSchema> = {
  _id: new ObjectId(),
  url: "https://www.example.com",
  type: "web",
  status: 'processing',
  createdAt: new Date().toISOString(),
};
*/

async function retryable<T>(fn: () => Promise<T>, maxAttempts: number = 3): Promise<T> {
    let attempts = 0;
    while (true) {
        try {
            return await fn();
        } catch (e) {
            attempts++;
            if (attempts >= maxAttempts) {
                throw e;
            }
        }
    }
}

async function batchMode<InputType, OutputType>(opts: {
    batchSize: number,
} & ({
    outputFilePath: string,
    processBatch: (batch: InputType[]) => Promise<OutputType[]>
} | {
    processBatch: (batch: InputType[]) => Promise<void>
}) & ({
    input: InputType[],
} | {
    inputFilePath: string,
})) {
    let inFile: fs.FileHandle | null = null;
    let outFile: fs.FileHandle | null = null;
    let ws: WriteStream | null = null;
    if ('inputFilePath' in opts) {
        inFile = await fs.open(opts.inputFilePath || '', 'r');
    }
    if ('outputFilePath' in opts) {
        outFile = await fs.open(opts.outputFilePath, 'w');
        ws = outFile.createWriteStream();
    }

    let batch: InputType[] = [];

    async function process() {
        const processed = await opts.processBatch(batch);
        if (ws && processed?.length) {
            for (const doc of processed) {
                ws.write(JSON.stringify(doc) + '\n');
            }
        }
        batch = [];
    }

    try {
        if ('input' in opts) {
            for (const doc of opts.input) {
                batch.push(doc);
                if (batch.length < opts.batchSize) {
                    continue;
                }
                await process();
            }
        } else {
            assert(inFile);
            for await (const line of inFile.readLines()) {
                const parsed: InputType = JSON.parse(line);
                batch.push(parsed);
                if (batch.length < opts.batchSize) {
                    continue;
                }
                await process();
            }
        }
        // if there are any leftover documents
        if (batch.length > 0) {
            await process();
        }
    } catch (e) {
        throw e;
    } finally {
        if (ws) {
            ws.close();
        }
        if (outFile) {
            await outFile.close();
        }
        if (inFile) {
            await inFile.close();
        }
    }
}

async function scrapeUsingOxylabs(_logger: PrefixLogger, job: WithId<z.infer<typeof DataSource> & { data: { type: 'urls' } }>) {
    const logger = _logger.child('scrapeUsingOxylabs');

    // disable this for now
    throw new Error("OxyLabs scraping is disabled for now");

    await batchMode({
        input: job.data.urls,
        outputFilePath: 'crawled-oxylabs.jsonl',
        batchSize: 5,
        processBatch: async (batch: string[]) => {
            const results = await Promise.all(batch.map(async (url) => {
                try {
                    logger.log("Scraping URL", url);
                    const response = await retryable(async () => {
                        const res = await fetch('https://realtime.oxylabs.io/v1/queries', {
                            method: 'POST',
                            body: JSON.stringify({
                                'source': 'universal',
                                'url': url,
                                'context': [
                                    { 'key': 'follow_redirects', 'value': true }
                                ]
                            }),
                            headers: {
                                'Content-Type': 'application/json',
                                ...oxylabsHttpAuth,
                            }
                        });
                        if (!res.ok) {
                            throw new Error(`Unable to scrape URL: ${url} with status: ${res.status} and text: ${res.statusText}, body: ${await res.text()}`);
                        }
                        return res;
                    }, 3); // Retry up to 3 times
                    const parsed: {
                        "results": {
                            "url": string,
                            "content": string,
                            "status_code": number,
                        }[],
                    } = await response.json();
                    const result = parsed.results[0];
                    if (!result) {
                        throw new Error("No results found for URL: " + url);
                    }
                    if (result.status_code !== 200) {
                        throw new Error("Non-200 status code for URL: " + url);
                    }
                    return result;
                } catch (e) {
                    logger.log("Error scraping URL: " + url, e);
                    return null;
                }
            }));
            return results.filter(r => r !== null);
        }
    });
}

async function scrapeUsingFirecrawl(_logger: PrefixLogger, job: WithId<z.infer<typeof DataSource> & { data: { type: 'urls' } }>) {
    const logger = _logger.child('scrapeUsingFirecrawl');

    await batchMode({
        input: job.data.urls,
        outputFilePath: 'crawled-firecrawl.jsonl',
        batchSize: 1, // how many firecrawl requests to make at a time
        processBatch: async (batch: string[]): Promise<FirecrawlDocument[]> => {
            const results = await Promise.all(batch.map(async (url) => {
                try {
                    logger.log("Scraping URL", url);
                    const result = await retryable(async () => {
                        const scrapeResult = await firecrawl.scrapeUrl(url, {
                            formats: ['html', 'markdown'],
                            onlyMainContent: true,
                            excludeTags: ['script', 'style', 'noscript', 'img',]
                        });
                        if (!scrapeResult.success) {
                            throw new Error("Unable to scrape URL: " + url);
                        }
                        return scrapeResult;
                    }, 3); // Retry up to 3 times
                    return result;
                } catch (e) {
                    logger.log("Error scraping URL: " + url, e);
                    return null;
                }
            }));
            return results.filter(r => r !== null);
        }
    });
}

async function crawlUsingFirecrawl(_logger: PrefixLogger, job: WithId<z.infer<typeof DataSource>> & { data: { type: 'crawl' } }) {
    const logger = _logger.child('crawlUsingFirecrawl');

    // empty the output file before starting
    await fs.writeFile('crawled-firecrawl.jsonl', '');

    // check if we have an existing firecrawl ID
    // if not, start a new crawl job
    let firecrawlId = job.data.firecrawlId;
    if (!firecrawlId) {
        logger.log('Starting firecrawl crawl...');
        // start crawl
        const result = await retryable(async () => {
            const response = await fetch('https://api.firecrawl.dev/v1/crawl', {
                method: 'POST',
                signal: AbortSignal.timeout(1 * minute),
                headers: {
                    'Content-Type': 'application/json',
                    ...firecrawlHttpAuth,
                },
                body: JSON.stringify({
                    url: job.data.startUrl,
                    limit: job.data.limit,
                    maxDepth: 2,
                    scrapeOptions: {
                        formats: ['html', 'markdown'],
                        onlyMainContent: true,
                    }
                }),
            });
            if (!response.ok) {
                throw new Error("Unable to call /crawl API: " + response.statusText);
            }
            return response;
        }, 3);
        const parsed = await result.json();
        if (!parsed.success) {
            throw new Error("Unable to start crawl: parsed.succes = false");
        }
        const crawlId = parsed.id;
        logger.log("Firecrawl job started with ID", crawlId);
        firecrawlId = crawlId;
        await dataSourcesCollection.updateOne({
            _id: job._id,
        }, {
            $set: {
                'data.firecrawlId': firecrawlId,
            }
        });
    } else {
        logger.log("Using existing firecrawl job with ID", firecrawlId);
    }

    // wait for crawl job to complete
    let counter = 0;
    let resp: CrawlStatusResponse;
    while (true) {
        // wait for 60s
        await new Promise(resolve => setTimeout(resolve, firecrawlStatusPollInterval));

        // check status
        resp = await retryable(async (): Promise<CrawlStatusResponse> => {
            logger.log("Polling firecrawl status...")
            const result = await fetch(`https://api.firecrawl.dev/v1/crawl/${firecrawlId}`, {
                signal: AbortSignal.timeout(1 * minute),
                headers: {
                    ...firecrawlHttpAuth,
                }
            });
            if (!result.ok) {
                throw new Error("Unable to fetch crawl status: " + result.statusText);
            }
            const parsed = await result.json();
            if (!parsed.success) {
                throw new Error("Unable to fetch crawl status: " + parsed.error);
            }
            return parsed;
        }, 3);

        if (resp.status !== 'completed') {
            continue;
        }

        break;
    }

    // open a file and append data line by line
    logger.log("First page collected from firecrawl: ", resp.data.length);
    counter += resp.data.length;
    const file = await fs.open('crawled-firecrawl.jsonl', 'w');
    const ws = file.createWriteStream();
    try {
        for (const doc of resp.data) {
            if (doc && doc.metadata?.statusCode === 200) {
                ws.write(JSON.stringify(doc) + '\n');
            }
        }

        let nextUrl = resp.next;
        while (nextUrl) {
            const parsed = await retryable(async () => {
                // fetch next page from firecrawl and pass on the firecrawl api key
                // as a bearer token
                assert(nextUrl);
                const result = await fetch(nextUrl, {
                    signal: AbortSignal.timeout(1 * minute),
                    headers: {
                        Authorization: `Bearer ${process.env["FIRECRAWL_API_KEY"]}`,
                    }
                });
                if (!result.ok) {
                    throw new Error("Unable to fetch next page from firecrawl: " + result.statusText);
                }
                return await result.json();
            }, 3);
            logger.log("Next page collected from firecrawl: ", parsed.data.length);
            counter += parsed.data.length;
            for (const doc of parsed.data) {
                if (doc && doc.metadata?.statusCode === 200) {
                    ws.write(JSON.stringify(doc) + '\n');
                }
            }
            nextUrl = parsed.next;
        }
    } catch (e) {
        throw e;
    } finally {
        ws.close();
        await file.close();
    }
}

async function crawlUsingOxylabs(_logger: PrefixLogger, job: WithId<z.infer<typeof DataSource>> & { data: { type: 'crawl' } }) {
    const logger = _logger.child('crawlUsingOxyLabs');

    // empty the output file before starting
    await fs.writeFile('crawled-oxylabs.jsonl', '');

    // disable this for now
    throw new Error("OxyLabs crawling is disabled for now");

    // check if we have an existing oxylabs ID
    // if not, start a new crawl job
    let oxylabsId = job.data.oxylabsId;
    if (!oxylabsId) {
        oxylabsId = await retryable(async () => {
            // if url ends with a slash, remove it
            let url = job.data.startUrl;
            if (job.data.startUrl.endsWith('/')) {
                url = url.slice(0, -1);
            }

            // create a regex for the starting url
            // that matches any subpath
            const baseRegex = (new RegExp(url)).toString().slice(1, -1);
            const subpathRegex = (new RegExp(`${url}/.*`)).toString().slice(1, -1);
            /*
            const escapedOrigin = url.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedPathname = url.pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/$/, '');
            const regex = new RegExp(`${escapedOrigin}${escapedPathname}(/.*)?`);
            */

            logger.log(`Starting crawl for ${url}`);
            // Initiate a new Web Crawler job
            const response = await fetch('https://ect.oxylabs.io/v1/jobs', {
                method: 'POST',
                headers: {
                    ...oxylabsHttpAuth,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: url.toString(),
                    filters: {
                        crawl: [baseRegex, subpathRegex],
                        process: [baseRegex, subpathRegex],
                        max_depth: 2,
                        max_urls: job.data.limit,
                    },
                    scrape_params: {
                        source: "universal",
                        user_agent_type: "desktop",
                        render: "html",
                    },
                    output: {
                        type_: "html",  // Changed from "sitemap" to "html"
                        aggregate_chunk_size_bytes: 100 * 1024 * 1024, // 100 MB
                    },
                    context: {
                        follow_redirects: true,
                    },
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, ${response.statusText}, body: ${errorBody}`);
            }

            const jobData = await response.json();
            const jobId = jobData.id;
            logger.log(`Crawl job initiated. Job ID: ${jobId}`);
            return jobId;
        }, 3);
        await dataSourcesCollection.updateOne({
            _id: job._id,
        }, {
            $set: {
                'data.oxylabsId': oxylabsId,
            }
        });
    } else {
        logger.log("Using existing oxylabs job with ID", oxylabsId);
    }

    // Poll for job completion
    while (true) {
        await new Promise(resolve => setTimeout(resolve, oxylabsStatusPollInterval));
        logger.log(`Checking job status...`);
        const jobStatusResponse = await retryable(async () => {
            const response = await fetch(`https://ect.oxylabs.io/v1/jobs/${oxylabsId}`, {
                headers: oxylabsHttpAuth,
            });
            if (!response.ok) {
                throw new Error(`Unable to fetch job status: ${response.statusText}`);
            }
            return response;
        }, 3);
        const jobStatus = await jobStatusResponse.json();
        const jobCompleted = jobStatus.events.some((event: { event: string; status: string }) =>
            event.event === "job_results_aggregated" && event.status === "done"
        );
        if (jobCompleted) {
            break;
        }
    }
    logger.log('Crawl job completed successfully');

    // Get the list of aggregate result chunks
    logger.log('Fetching aggregate result chunks...');
    const aggregateResponse = await retryable(async () => {
        const response = await fetch(`https://ect.oxylabs.io/v1/jobs/${oxylabsId}/aggregate`, {
            headers: oxylabsHttpAuth,
        });
        if (!response.ok) {
            throw new Error(`Unable to fetch aggregate results: ${response.statusText}`);
        }
        return response;
    }, 3);
    const aggregateData = await aggregateResponse.json();
    logger.log('Aggregate chunks response:', JSON.stringify(aggregateData));

    // Download and write JSONL content to file
    const file = await fs.open('crawled-oxylabs.jsonl', 'w');
    const ws = file.createWriteStream();
    try {
        for (const chunk of aggregateData.chunk_urls) {
            logger.log("Fetching chunk", chunk.href);
            // During development, i found that oxylabs returns http URLs
            // Convert chunk href URL to https if it's http
            const secureChunkUrl = new URL(chunk.href);
            if (secureChunkUrl.protocol === 'http:') {
                secureChunkUrl.protocol = 'https:';
            }
            const chunkResponse = await retryable(async () => {
                const response = await fetch(secureChunkUrl.toString(), {
                    headers: oxylabsHttpAuth,
                });
                if (!response.ok) {
                    throw new Error(`Failed to fetch chunk: ${response.status} ${response.statusText}`);
                }
                if (!response.body) {
                    throw new Error("No body in chunk response");
                }
                return response;
            }, 3);

            const chunkContent = await chunkResponse.text();
            ws.write(chunkContent);
            if (!chunkContent.endsWith('\n')) {
                ws.write('\n');
            }
            logger.log("Wrote chunk to file", chunk.href);
        }
    } catch (e) {
        throw e;
    } finally {
        ws.close();
        await file.close();
    }
}

async function mergeFirecrawlAndOxylabs(_logger: PrefixLogger): Promise<Set<string>> {
    const logger = _logger.child('mergeFirecrawlAndOxylabs');
    const urlSet = new Set<string>();
    const outputFile = await fs.open('crawled.jsonl', 'w');
    const outputStream = outputFile.createWriteStream();

    let firecrawlCount = 0;
    let oxylabsCount = 0;

    try {
        // Read Firecrawl JSONL file
        const firecrawlFile = await fs.open('crawled-firecrawl.jsonl', 'r');
        try {
            for await (const line of firecrawlFile.readLines()) {
                // if line is empty, skip it
                if (line.trim() === '') {
                    continue;
                }
                const fcDoc: FirecrawlDocument = JSON.parse(line);
                urlSet.add(fcDoc.metadata?.sourceURL || '');
                const webpage = {
                    url: fcDoc.metadata?.sourceURL || '',
                    markdown: fcDoc.markdown || '',
                    title: fcDoc.metadata?.title || '',
                    html: fcDoc.html || '',
                } as Webpage;
                outputStream.write(JSON.stringify(webpage) + '\n');
                firecrawlCount++;
            }
        } catch (e) {
            throw e;
        } finally {
            await firecrawlFile.close();
        }

        /*
        // Read OxyLabs JSONL file
        const oxylabsFile = await fs.open('crawled-oxylabs.jsonl', 'r');
        try {
            let lineNumber = 0;
            for await (const line of oxylabsFile.readLines()) {
                lineNumber++;
                // if line is empty, skip it
                if (line.trim() === '') {
                    continue;
                }
                let oxDoc: OxylabsDocument;
                try {
                    oxDoc = JSON.parse(line);
                } catch (e) {
                    logger.log("Error parsing line number", lineNumber);
                    throw e;
                }
                if (urlSet.has(oxDoc.url)) {
                    continue;
                }
                urlSet.add(oxDoc.url);

                // parse the html using cheerio
                // and extract the title
                const $ = cheerio.load(oxDoc.content);
                const title = $('title').text();
                const webpage = {
                    url: oxDoc.url,
                    markdown: '',
                    title: title,
                    html: oxDoc.content,
                } as Webpage;
                outputStream.write(JSON.stringify(webpage) + '\n');
                oxylabsCount++;
            }
        } catch (e) {
            throw e;
        } finally {
            await oxylabsFile.close();
        }
        */
    } catch (e) {
        throw e;
    } finally {
        outputStream.end();
        await outputFile.close();
    }

    logger.log(`Merged Firecrawl and OxyLabs data. Total unique URLs: ${urlSet.size}`);
    logger.log(`URLs crawled by Firecrawl: ${firecrawlCount}`);
    logger.log(`URLs crawled by OxyLabs: ${oxylabsCount}`);
    return urlSet;
}

async function saveWebpagesToMongodb(logger: PrefixLogger, job: WithId<z.infer<typeof DataSource>>) {
    await batchMode({
        inputFilePath: 'rewritten.jsonl',
        batchSize: 100,
        processBatch: async (batch: Webpage[]) => {
            // perform a bulkwrite operation on the mongodb webpages collection
            // it is possible that the webpage already exists in the collection
            // in which case we should update the existing document, otherwise
            // we should insert a new document with _id = sourceURL
            const bulkWriteOps = [];
            for (const doc of batch) {
                bulkWriteOps.push({
                    updateOne: {
                        filter: { _id: doc.url },
                        update: {
                            $set: {
                                title: doc.title,
                                contentSimple: doc.markdown,
                                lastUpdatedAt: new Date().toISOString(),
                            }
                        },
                        upsert: true,
                    }
                });
            }
            if (bulkWriteOps.length === 0) {
                return;
            }
            await webpagesCollection.bulkWrite(bulkWriteOps);
            logger.log("Saved webpage contents to mongo", batch.length);
        }
    });
}

async function rewrite(_logger: PrefixLogger) {
    const logger = _logger.child('rewrite');

    await batchMode({
        inputFilePath: 'crawled.jsonl',
        outputFilePath: 'rewritten.jsonl',
        batchSize: 10,
        processBatch: async (batch: Webpage[]): Promise<Webpage[]> => {
            // use cheerio to strip extraneous tags and attributes
            batch.forEach((doc) => {
                const $ = cheerio.load(doc.html);
                [
                    "aside",
                    "audio",
                    "button",
                    "canvas",
                    "embed",
                    "footer",
                    "form",
                    "header",
                    "iframe",
                    "img",
                    "input",
                    "link",
                    "meta",
                    "nav",
                    "noscript",
                    "object",
                    "script",
                    "select",
                    "style",
                    "svg",
                    "textarea",
                    "video"
                ].forEach((tag) => {
                    $(tag).remove();
                });

                // Remove comments
                $('*').contents().filter(function () {
                    return this.type === 'comment';
                }).remove();

                // Remove most attributes, but keep some for semantic meaning
                $('*').each(function () {
                    const attrsToKeep = ['href', 'src', 'alt', 'title'];
                    const attrs = $(this).attr();
                    for (const attr in attrs) {
                        if (!attrsToKeep.includes(attr)) {
                            $(this).removeAttr(attr);
                        }
                    }
                });

                // Remove empty elements
                $('*').filter(function () {
                    return $(this).text().trim() === '' && $(this).children().length === 0;
                }).remove();

                doc.html = $.html();
            });

            const prompt = `
Rewrite the below html article as Markdown by removing all extra content that does not belong in the main help content for the topic. Extra content can include extraneous links, generic website text, any content about related articles, etc.

Tip: Such content will generally be placed at the start and / or at the end of the article. You can identify the topic from the article's URL and/or Title.

Strictly do not make any other changes to the article.

<START_ARTICLE_CONTENT>
Title: {{title}}
{{content}}
<END_ARTICLE_CONTENT>
`,
                rewritten = await Promise.all(batch.map(async (doc) => {
                    try {
                        // if doc already contains markdown, skip it
                        // if (doc.markdown) {
                        //     return doc;
                        // }
                        const now = Date.now();
                        const { text } = await generateText({
                            model: openai('gpt-4o'),
                            prompt: prompt
                                .replace('{{title}}', doc.title)
                                .replace('{{content}}', doc.html),
                        });
                        // log the time taken (in s) to rewrite the text
                        logger.log("\tCompleted rewrite", doc.url, (Date.now() - now) / 1000, "s");
                        return {
                            ...doc,
                            markdown: text,
                        };
                    } catch (e) {
                        return doc;
                    }
                }));
            logger.log("Rewrote batch of documents", batch.length);
            return rewritten;
        }
    });
}

async function chunk(logger: PrefixLogger, job: WithId<z.infer<typeof DataSource>>) {
    await batchMode({
        inputFilePath: 'rewritten.jsonl',
        outputFilePath: 'chunked.jsonl',
        batchSize: 1000,
        processBatch: async (batch: Webpage[]): Promise<Document[]> => {
            const results = [];
            for await (const doc of batch) {
                const splits = await splitter.createDocuments([doc.markdown]);
                splits.forEach((split) => {
                    split.metadata.sourceURL = doc.url;
                    split.metadata.title = doc.title;
                    split.metadata.sourceId = job._id.toString();
                });
                results.push(...splits);
            }
            logger.log("Chunked batch of documents", batch.length);
            return results;
        }
    });
}

async function embeddings(logger: PrefixLogger) {
    await batchMode({
        inputFilePath: 'chunked.jsonl',
        outputFilePath: 'embeddings.jsonl',
        batchSize: 200,
        processBatch: async (batch: Document[]): Promise<z.infer<typeof EmbeddingDoc>[]> => {
            const { embeddings } = await embedMany({
                model: embeddingModel,
                values: batch.map((doc) => doc.pageContent)
            });

            logger.log("Embedded batch of documents", batch.length);
            return batch.map((doc, i) => ({
                sourceId: doc.metadata.sourceId as string,
                content: doc.pageContent,
                metadata: {
                    sourceURL: doc.metadata.sourceURL as string,
                    title: doc.metadata.title as string,
                },
                embeddings: embeddings[i],
            }));
        }
    });
}

async function mongodb(logger: PrefixLogger, job: WithId<z.infer<typeof DataSource>>) {
    logger.log("Deleting old embeddings...");
    await embeddingsCollection.deleteMany({ sourceId: job._id.toString() });

    await batchMode({
        inputFilePath: 'embeddings.jsonl',
        batchSize: 100,
        processBatch: async (batch: z.infer<typeof EmbeddingDoc>[]) => {
            await embeddingsCollection.insertMany(batch);
            logger.log("Inserted batch of documents", batch.length);
        }
    });
}

// fetch next job from mongodb
(async () => {
    while (true) {
        console.log("Polling for job...")
        const now = Date.now();
        const job = await dataSourcesCollection.findOneAndUpdate(
            {
                $and: [
                    { 'data.type': { $in: ["crawl", "urls"] } },
                    {
                        $or: [
                            { status: "new" },
                            {
                                status: "error",
                                attempts: { $lt: 3 },
                            },
                            {
                                status: "error",
                                lastAttemptAt: { $lt: new Date(now - 5 * minute).toISOString() },
                            },
                            {
                                status: "processing",
                                lastAttemptAt: { $lt: new Date(now - 12 * hour).toISOString() },
                            }
                        ]
                    }
                ]
            },
            {
                $set: {
                    status: "processing",
                    lastAttemptAt: new Date().toISOString(),
                },
                $inc: {
                    attempts: 1
                },
            },
            { returnDocument: "after", sort: { createdAt: 1 } }
        );
        if (job === null) {
            // if no doc found, sleep for a bit and start again
            await new Promise(resolve => setTimeout(resolve, 5 * second));
            continue;
        }

        // pick a job as a test from db
        // const job = await dataSourcesCollection.findOne({
        //     _id: new ObjectId("6715e9218a128eae83550cc9"),
        // });
        // assert(job !== null);

        const logger = new PrefixLogger(job._id.toString());
        logger.log(`Starting job ${job._id}. Type: ${job.data.type}`);

        try {
            let firecrawlResult;
            let oxylabsResult;
            if (job.data.type === "crawl") {
                // Run the crawl using firecrawl and oxylabs in parallel
                // If both fail, throw an error; if one fails, log the error and continue
                logger.log("Starting Firecrawl and OxyLabs crawls in parallel...");
                [firecrawlResult, oxylabsResult] = await Promise.allSettled([
                    crawlUsingFirecrawl(logger, job as WithId<z.infer<typeof DataSource>> & { data: { type: 'crawl' } }),
                    crawlUsingOxylabs(logger, job as WithId<z.infer<typeof DataSource>> & { data: { type: 'crawl' } }),
                ]);
            } else if (job.data.type === "urls") {
                // scrape the urls using firecrawl and oxylabs in parallel
                logger.log("Starting Firecrawl and OxyLabs scrapes in parallel...");
                [firecrawlResult, oxylabsResult] = await Promise.allSettled([
                    scrapeUsingFirecrawl(logger, job as WithId<z.infer<typeof DataSource>> & { data: { type: 'urls' } }),
                    scrapeUsingOxylabs(logger, job as WithId<z.infer<typeof DataSource>> & { data: { type: 'urls' } }),
                ]);
            }
            assert(firecrawlResult !== undefined);
            assert(oxylabsResult !== undefined);
            if (firecrawlResult.status === 'rejected' && oxylabsResult.status === 'rejected') {
                logger.log('Both Firecrawl and OxyLabs jobs failed', {
                    firecrawlError: firecrawlResult.reason,
                    oxylabsError: oxylabsResult.reason
                });
                throw new Error('Both Firecrawl and OxyLabs jobs failed');
            }
            if (firecrawlResult.status === 'rejected') {
                logger.log('Firecrawl job failed, but OxyLabs succeeded:', {
                    error: firecrawlResult.reason
                });
            }
            if (oxylabsResult.status === 'rejected') {
                logger.log('OxyLabs job failed, but Firecrawl succeeded:', {
                    error: oxylabsResult.reason
                });
            }
            // merge the firecrawl and oxylabs results
            const crawledUrls = await mergeFirecrawlAndOxylabs(logger);
            // update the job with the crawled urls
            if (job.data.type === "crawl") {
                await dataSourcesCollection.updateOne({ _id: job._id }, { $set: { 'data.crawledUrls': Array.from(crawledUrls).join('\n') } });
            } else if (job.data.type === "urls") {
                await dataSourcesCollection.updateOne({ _id: job._id }, { $set: { 'data.scrapedUrls': Array.from(crawledUrls).join('\n') } });
            }
            // rewrite the merged results as simplified html and markdown
            await rewrite(logger);
            await saveWebpagesToMongodb(logger, job);
            await chunk(logger, job);
            await embeddings(logger);
            await mongodb(logger, job);

            // if this is a scrape urls job, compare the input urls with the scraped urls
            // if there are any urls that were not scraped, set a missingUrls field on the job
            if (job.data.type === "urls") {
                const missingUrls = job.data.urls.filter((url: string) => !crawledUrls.has(url));
                if (missingUrls.length > 0) {
                    await dataSourcesCollection.updateOne({ _id: job._id }, { $set: { 'data.missingUrls': missingUrls.join('\n') } });
                } else {
                    await dataSourcesCollection.updateOne({ _id: job._id }, { $set: { 'data.missingUrls': null } });
                }
            }
        } catch (e) {
            logger.log("Error processing job; will retry:", e);
            await dataSourcesCollection.updateOne({ _id: job._id }, { $set: { status: "error" } });
            continue;
        }

        // mark job as complete
        logger.log("Marking job as completed...");
        await dataSourcesCollection.updateOne({ _id: job._id }, { $set: { status: "completed" } });
        // break;
    }
})();

