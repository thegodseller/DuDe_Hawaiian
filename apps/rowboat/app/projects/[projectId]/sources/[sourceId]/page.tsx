import { notFound } from "next/navigation";
import { dataSourcesCollection } from "@/app/lib/mongodb";
import { ObjectId } from "mongodb";
import { Metadata } from "next";
import { SourcePage } from "./source-page";
import { getDataSource } from "@/app/actions";

export default async function Page({
    params,
}: {
    params: {
        projectId: string,
        sourceId: string
    }
}) {
    return <SourcePage projectId={params.projectId} sourceId={params.sourceId} />;
}