export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-background text-foreground">
      <main className="flex flex-col gap-8 items-center max-w-2xl">
        <h1 className="text-5xl font-extrabold tracking-tight">
          Payroll on the <span className="text-orange-600">Stacks</span> Blockchain
        </h1>
        <p className="text-lg text-muted-foreground italic">
          Coming Soon: The non-custodial STX payroll engine.
        </p>
        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <button className="px-6 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors">
            Get Started
          </button>
          <button className="px-6 py-3 border border-orange-600 text-orange-600 rounded-lg font-bold hover:bg-orange-50 transition-colors">
            See How It Works
          </button>
        </div>
      </main>
    </div>
  );
}
