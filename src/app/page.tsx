import GameCanvas from '@/components/GameCanvas';

export default function Home() {
  return (
    <main className="min-h-screen w-full flex flex-col bg-[#050406]">
      <GameCanvas />
    </main>
  );
}