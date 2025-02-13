import { Metadata } from "next";
import SimulationApp from "./app";

export const metadata: Metadata = {
    title: "Project simulation",
};

export default function SimulationPage() {
    return <SimulationApp />;
}