import { WalletConnect } from "@/components/WalletConnect";

export default function WalletPage() {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[50vh]">
      <h1 className="text-3xl font-bold mb-4">Wallet Settings</h1>
      <div className="w-full max-w-md p-6 border rounded-xl bg-card shadow-sm">
        <h2 className="text-xl font-semibold mb-6 text-center">Manage Your STX Wallet</h2>
        <WalletConnect />
        <p className="mt-6 text-xs text-center text-muted-foreground">
          Payrail is non-custodial. We never see your private keys.
        </p>
      </div>
    </div>
  )
}
