import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Class AI — AI-Powered Classroom Monitoring",
  description:
    "Class AI uses artificial intelligence to monitor and enhance classroom experiences with real-time insights and analytics.",
  keywords: ["AI", "classroom", "monitoring", "education", "analytics"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="preload" href="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_packed_assets.data" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_wasm_bin.wasm" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js" as="script" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
