import "./globals.css";
export const metadata = { title: "NDC Batch 28 — Notre Dame College, Dhaka", description: "The private portal of Batch 28, Notre Dame College, Dhaka. Love the light of wisdom.",
  icons: { icon: "/logondc28.svg" },   // browser-tab icon only; the on-page logo stays /logo.svg
  openGraph: { title: "NDC Batch 28", description: "Diligite Lumen Sapientiae", type: "website" } };
export default function Root({ children }) {
  return (<html lang="en"><head>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=Manrope:wght@300;400;600&display=swap" rel="stylesheet" />
  </head><body>{children}</body></html>);
}
