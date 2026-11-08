import type { Metadata } from "next";
import "./globals.css";

// Route misses skip the root layout and its client providers. A full layout
// render cost 14-95 ms of CPU on Workers, over the 10 ms Free plan limit.
export const metadata: Metadata = {
  title: "Page not found · Course Map",
  robots: { index: false },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "32x32" }] },
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <main style={{ maxWidth: "36rem", margin: "4rem auto", padding: "0 1rem" }}>
          <h1>Page not found</h1>
          <p>This page does not exist in the course map.</p>
          <p><a href="/">Pick a college and program</a></p>
        </main>
      </body>
    </html>
  );
}
