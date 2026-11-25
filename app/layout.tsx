import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ibemhal IAS — Online Exam & CBT Portal",
  description:
    "Online CBT Exam Conductor, Question Bank, Proctoring, and Instant Rank Analytics for Ibemhal IAS.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
