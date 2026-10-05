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

// กำหนด Title, รายละเอียด และ Icon ให้แสดงครบทั้ง Browser Bar, iPhone และอุปกรณ์ความละเอียดสูง
export const metadata: Metadata = {
  title: "A.X.O.N. Improviso | Intelligent Music Practice Node",
  description: "ระบบวิเคราะห์การซ้อมดนตรีอัจฉริยะ ตรวจจับ Onset Precision และ Tempo Stability",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

// จุดสำคัญ: ต้องมี export default function ที่รับ children เสมอ
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#080d1a] text-white">
        {children}
      </body>
    </html>
  );
}