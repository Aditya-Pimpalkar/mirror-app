import { Playfair_Display, Lora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", weight: ["400", "500", "600"] });

export const metadata = {
  title: "Mirror — See Yourself Clearly",
  description: "Everyone has googled you. Now you can hear what they found.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfair.variable} ${lora.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
