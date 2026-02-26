import GameCanvas from '@/components/GameCanvas';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <header className="mb-8 text-center">
        <h1 className="text-2xl sm:text-4xl font-headline text-primary mb-2 drop-shadow-[0_2px_0_rgba(0,0,0,1)]">
          PIXELDUNGEON DASH
        </h1>
        <p className="text-[10px] sm:text-xs text-secondary opacity-80 uppercase tracking-widest">
          A 16-BIT DUNGEON ADVENTURE
        </p>
      </header>

      <GameCanvas />

      <footer className="mt-12 text-[10px] text-gray-500 text-center max-w-xs uppercase leading-loose opacity-60">
        Controls: Click or Space to Jump. Dodge the Beholders and Mimics to survive the deep dungeon.
      </footer>
    </main>
  );
}
