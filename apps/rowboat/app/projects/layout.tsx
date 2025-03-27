import logo from "@/public/rowboat-logo.png";
import logoDark from "@/public/rowboat-logo-dark-mode.png";
import Image from "next/image";
import Link from "next/link";
import { UserButton } from "../lib/components/user_button";
import { ThemeToggle } from "../lib/components/theme-toggle";
import { USE_AUTH } from "../lib/feature_flags";

export const dynamic = 'force-dynamic';

export default function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return <>
        <header className="shrink-0 flex justify-between items-center px-4 py-2 border-b border-border bg-background">
            <div className="flex items-center gap-12">
                <Link href="/">
                    <Image
                        src={logo}
                        height={24}
                        alt="RowBoat Labs Logo"
                        className="block dark:hidden"
                    />
                    <Image
                        src={logoDark}
                        height={24}
                        alt="RowBoat Labs Logo"
                        className="hidden dark:block"
                    />
                </Link>
            </div>
            <div className="flex items-center gap-2">
                <ThemeToggle />
                {USE_AUTH && <UserButton />}
            </div>
        </header>
        <main className="grow overflow-auto">
            {children}
        </main>
    </>;
}