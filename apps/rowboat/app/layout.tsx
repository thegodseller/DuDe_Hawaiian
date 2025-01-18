import "./globals.css";
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "RowBoat labs",
    template: "%s | RowBoat Labs",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <html lang="en" className="h-dvh">
    <UserProvider>
      <body className={`${inter.className} h-full text-base [scrollbar-width:thin] bg-gray-100`}>
        <Providers className='h-full flex flex-col'>
          {children}
        </Providers>
      </body>
    </UserProvider>
  </html>;
}
