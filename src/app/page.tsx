import GameCanvas from '@/components/GameCanvas';

export default function Home() {
  return (
    <main className="min-h-screen w-full flex justify-center bg-[#050406]">
      <div className="w-full max-w-[800px] min-h-screen">
        <GameCanvas />
      </div>
    </main>
  );
}
