import GameCanvas from '@/components/GameCanvas';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <header className="mb-8 text-center">
        <h1 className="text-2xl sm:text-4xl font-headline text-primary mb-2 drop-shadow-[0_2px_0_rgba(0,0,0,1)] uppercase">
          ПИКСЕЛЬНЫЙ ПОБЕГ
        </h1>
        <p className="text-[10px] sm:text-xs text-secondary opacity-80 uppercase tracking-widest">
          РЕТРО-ПРИКЛЮЧЕНИЕ В ПОДЗЕМЕЛЬЕ
        </p>
      </header>

      <GameCanvas />

      <footer className="mt-12 text-[10px] text-gray-500 text-center max-w-xs uppercase leading-loose opacity-60">
        Управление: Клик или Пробел для прыжка. Уклоняйтесь от Бехолдеров и Мимиков, чтобы выжить в глубоком подземелье.
      </footer>
    </main>
  );
}
