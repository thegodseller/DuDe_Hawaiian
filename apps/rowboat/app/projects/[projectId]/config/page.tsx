import { Metadata } from "next";
import App from "./app";
export const metadata: Metadata = {
    title: "Project config",
};

export default function Page({
    params,
}: {
    params: {
        projectId: string;
    };
}) {
    return <App
        projectId={params.projectId}
        chatWidgetHost={process.env.CHAT_WIDGET_HOST || 'https://chat.rowboatlabs.com'}
    />;
}