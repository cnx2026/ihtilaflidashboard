import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "İhtilaflı Data KPI Dashboard",
  icons: {
    icon: "https://appexchange.salesforce.com/image_host/0f3dad29-4a38-468b-8fb9-cbabe4acb8f1.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          rel="stylesheet"
        />
      </head>
      <body className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">{children}</body>
    </html>
  );
}
