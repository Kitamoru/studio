import GameCanvas from '@/components/GameCanvas';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#050406]">
      {/* Главный игровой контейнер без внешних отступов и заголовков */}
      <div className="w-full max-w-[800px] flex flex-col items-center">
        <GameCanvas />
      </div>
    </main>
  );
}
