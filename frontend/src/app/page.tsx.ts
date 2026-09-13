export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50 text-gray-900">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-extrabold tracking-tight text-center lg:text-left">
          Application de Transcription & Restitution Intelligente
        </h1>
      </div>
      <p className="mt-4 text-lg text-center text-gray-600">
        Votre environnement Docker est opérationnel. Le backend FastAPI et le frontend Next.js sont connectés.
      </p>
    </main>
  );
}