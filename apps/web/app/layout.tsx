import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ConfirmSheet, ConnectionBanner, Nav } from "./components";
import { StoreProvider } from "./store";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneView",
  description: "Inbox for your local Claude Code and Codex sessions",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <Nav />
          <ConnectionBanner />
          <main>{children}</main>
          <ConfirmSheet />
        </StoreProvider>
      </body>
    </html>
  );
}
