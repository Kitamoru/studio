import GameCanvas from '@/components/GameCanvas';

export default function Home() {
  return (
    <main className="min-h-screen w-full flex flex-col items-center bg-[#050406]">
      {/* Контейнер теперь занимает всю высоту и не центрирует содержимое вертикально */}
      <div className="w-full max-w-[800px] h-screen flex flex-col">
        <GameCanvas />
      </div>
    </main>
  );
}
