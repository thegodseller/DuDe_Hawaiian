import logo from "@/public/rowboat-logo.png";
import Image from "next/image";
import Link from "next/link";
import { UserButton } from "../lib/components/user_button";

export default function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return <>
        <header className="shrink-0 flex justify-between items-center px-4 py-2 border-b border-b-gray-100">
            <div className="flex items-center gap-12">
                <Link href="/">
                <Image
                    src={logo}
                    height={24}
                    alt="RowBoat Labs Logo"
                />
                </Link>
            </div>
            <UserButton />
        </header>
        <main className="grow overflow-auto">
            {children}
        </main>
    </>;
}