import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/contributions", label: "Contributions" },
  { href: "/snapshots", label: "Snapshots" },
  { href: "/annual-returns", label: "Annual Returns" },
  { href: "/charts", label: "Charts" }
];

export const metadata: Metadata = {
  title: "Net Worth",
  description: "Private net worth dashboard",
  applicationName: "Net Worth",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#f7f6f1",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <aside className="sidebar" aria-label="Primary navigation">
            <Link href="/" className="brand" aria-label="Net Worth dashboard">
              <span className="brand-mark">NW</span>
              <span>
                <strong>Net Worth</strong>
                <small>Private ledger</small>
              </span>
            </Link>
            <nav className="nav-list">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
