'use client';
import { TypewriterEffect } from "./lib/components/typewriter";
import Image from 'next/image';
import logo from "@/public/rowboat-logo.png";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import { Spinner } from "@nextui-org/react";

export function App() {
    const router = useRouter();
    const { user, error, isLoading } = useUser();

    if (user) {
        router.push("/projects");
    }

    return <div className="flex h-full justify-center lg:justify-between">
        <div className="hidden h-full grow md:justify-start bg-gray-50 bg-[url('/landing-bg.jpg')] bg-cover bg-center p-10 md:flex md:flex-col md:gap-20">
            <div className="flex flex-col items-start gap-48">
                <Image
                    src={logo}
                    alt="RowBoat Logo"
                    height={30}
                />
                <div className="flex flex-col items-start gap-3">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold inline-block bg-white bg-opacity-75 rounded-lg px-4 py-4">
                        AI agents for human-like customer assistance
                    </h1>
                    <h2 className="text-md md:text-lg lg:text-xl text-gray-600 inline-block bg-white bg-opacity-75 rounded-lg px-4 py-3">
                        Set up a personalized agent for your app or website in minutes.
                    </h2>
                </div>
            </div>
            <TypewriterEffect />
        </div>
        <div className="flex flex-col items-center gap-20 px-28 py-2 justify-center">
            <Image
                className="md:hidden"
                src={logo}
                alt="RowBoat Logo"
                height={30}
            />
            {isLoading && <Spinner size="sm" />}
            {error && <div className="text-red-500">{error.message}</div>}
            {!isLoading && !error && !user && (
                <a
                    className="bg-blue-500 text-white px-4 py-2 rounded-md"
                    href="/api/auth/login"
                >
                    Sign in to get started
                </a>
            )}
            {user && <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <div className="text-sm text-gray-400">Welcome, {user.name}</div>
            </div>}
            <div className="flex flex-col justify-center items-center px-4 py-2 gap-2">
                <div className="text-sm text-gray-400">&copy; 2024 RowBoat Labs</div>
                <a className="text-sm text-gray-400 hover:underline" href="https://www.rowboatlabs.com/terms-and-conditions" target="_blank" rel="noopener noreferrer">Terms and Conditions</a>
                <a className="text-sm text-gray-400 hover:underline" href="https://www.rowboatlabs.com/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            </div>
        </div>
    </div>;
}
