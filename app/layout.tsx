import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { ToastProvider } from "@/components/Toast";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Privilee Bet",
  description: "Predict matches, pick the champion, climb the leaderboard.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const navUser = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: session.user.role,
      }
    : null;

  return (
    <html lang="en">
      <body>
        <Providers session={session}>
          <ToastProvider>
            <Nav user={navUser} />
            <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
