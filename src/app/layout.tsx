import type { Metadata, Viewport } from "next";
import { Assistant, Varela_Round } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const DESCRIPTION =
  "נהלו זיכויי חנות ושוברי קנייה בישראל — צילום, אישור פרטים ומעקב יתרה.";

function metadataBase(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      /* fall through to the production host */
    }
  }
  return new URL("https://justrefundme.netlify.app");
}

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const varelaRound = Varela_Round({
  variable: "--font-varela",
  subsets: ["hebrew", "latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: APP_NAME,
  description: DESCRIPTION,
  applicationName: APP_NAME,
  openGraph: {
    title: APP_NAME,
    description: DESCRIPTION,
    locale: "he_IL",
    type: "website",
    siteName: APP_NAME,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: APP_NAME,
    description: DESCRIPTION,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f1e4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${assistant.variable} ${varelaRound.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
