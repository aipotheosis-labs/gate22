"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      {/* Navigation Header */}
      <div className="sticky top-0 z-50 px-6 sm:px-8 lg:px-12 pt-4 bg-background">
        <div className="mx-auto max-w-7xl">
          <div className="bg-background border border-primary/50 rounded-lg px-6">
            <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-semibold tracking-tight">
                MCP Gateway
              </Link>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 hover:translate-y-[-1px]">
                Features
              </Link>
              <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 hover:translate-y-[-1px]">
                Pricing
              </Link>
              <Link href="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 hover:translate-y-[-1px]">
                Docs
              </Link>
            </nav>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" size="default" className="h-9 px-4 text-sm font-medium hover:bg-white/10">
                  Login
                </Button>
              </Link>
              <Link href="/apps">
                <Button size="default" className="h-9 px-5 text-sm font-medium transition-all duration-200">
                  Get Started
                </Button>
              </Link>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-background to-muted/20 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">MCP Gateway</h3>
              <p className="text-sm text-muted-foreground/80 leading-relaxed">
                The control plane for your enterprise MCP servers.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground/90">Product</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link href="#features" className="text-sm text-muted-foreground/70 hover:text-foreground transition-all duration-200">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-sm text-muted-foreground/70 hover:text-foreground transition-all duration-200">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="text-sm text-muted-foreground/70 hover:text-foreground transition-all duration-200">
                    Documentation
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground/90">Company</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/about" className="text-sm text-muted-foreground/70 hover:text-foreground transition-all duration-200">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="text-sm text-muted-foreground/70 hover:text-foreground transition-all duration-200">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-sm text-muted-foreground/70 hover:text-foreground transition-all duration-200">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground/90">Resources</h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="https://github.com/yourusername/mcp-gateway" className="text-sm text-muted-foreground/70 hover:text-foreground transition-all duration-200">
                    GitHub
                  </a>
                </li>
                <li>
                  <Link href="/support" className="text-sm text-muted-foreground/70 hover:text-foreground transition-all duration-200">
                    Support
                  </Link>
                </li>
                <li>
                  <Link href="/status" className="text-sm text-muted-foreground/70 hover:text-foreground transition-all duration-200">
                    Status
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-12 border-t border-white/5">
            <p className="text-center text-sm text-muted-foreground/60">
              © 2024 MCP Gateway. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}