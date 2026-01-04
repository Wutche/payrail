import { Wallet } from "lucide-react"
import Link from "next/link"
import { Container } from "./ui/container"

export function Footer() {
  return (
    <footer className="border-t bg-card py-12">
      <Container>
        <div className="flex flex-col items-center text-center gap-6">
          <Link href="/" className="flex items-center">
            <img 
              src="/payrail-logo.svg" 
              alt="Payrail Logo" 
              className="h-12 w-auto object-contain"
            />
          </Link>
          <p className="text-sm text-muted-foreground max-w-sm">
            The non-custodial STX payroll engine for global teams. Secure, transparent, and direct.
          </p>
          
          <div className="pt-8 border-t w-full flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            <p>© 2025 Payrail. Built on Stacks Blockchain.</p>
            <div className="flex gap-6">
              <Link href="/#how-it-works" className="hover:text-primary transition-colors">How it works</Link>
              <Link href="/#features" className="hover:text-primary transition-colors">Features</Link>
              <span className="text-primary/40">Testnet</span>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  )
}
