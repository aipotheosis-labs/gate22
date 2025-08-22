"use client";

// Import landing page components
import { Hero } from "@/features/landing/hero";
import { Features } from "@/features/landing/features";
import { CTA } from "@/features/landing/cta";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <Features />
      <CTA />
    </div>
  );
}
