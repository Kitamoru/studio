import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PixelDungeon Dash',
  description: 'A 16-bit D&D themed infinite runner',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </head>
      <body className="font-body antialiased bg-[#25202D] text-white">{children}</body>
    </html>
  );
}
