import GameCanvas from '@/components/GameCanvas';

export default function Home() {
  return (
    <main className="min-h-screen w-full flex flex-col items-center bg-[#050406]">
      <div className="w-full h-screen flex flex-col">
        <GameCanvas />
      </div>
    </main>
  );
}
