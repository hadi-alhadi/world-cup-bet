import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Providers } from "@/components/providers";
import { ToastProvider } from "@/components/Toast";
import { Nav } from "@/components/Nav";
import { WinnerPickBanner } from "@/components/WinnerPickBanner";

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

  // Surface the user's champion pick (if any) in the nav, beside their avatar.
  const winnerPick = session?.user?.id
    ? await prisma.winnerPick.findUnique({
        where: { userId: session.user.id },
        include: { team: true },
      })
    : null;

  const navUser = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: session.user.role,
        pickedTeam: winnerPick
          ? { name: winnerPick.team.name, logoUrl: winnerPick.team.logoUrl }
          : null,
      }
    : null;

  return (
    <html lang="en">
      <body>
        <Providers session={session}>
          <ToastProvider>
            {navUser && <WinnerPickBanner />}
            <Nav user={navUser} />
            <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
