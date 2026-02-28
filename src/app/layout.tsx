import type {Metadata} from 'next';
import './globals.css';
import { TelegramProvider } from '@/context/telegram-context';
import { DndProvider } from '@/context/dnd-context';

export const metadata: Metadata = {
  title: 'PixelDungeon Dash: D&D Edition',
  description: 'Высокодетализированный бесконечный раннер с элементами D&D',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </head>
      <body className="font-body antialiased bg-[#0f0d12] text-white" suppressHydrationWarning>
        <TelegramProvider>
          <DndProvider>
            {children}
          </DndProvider>
        </TelegramProvider>
      </body>
    </html>
  );
}
