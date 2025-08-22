"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function AccountSettings() {
  return (
    <div className="max-w-3xl space-y-8">
      {/* Profile Information Card */}
      <Card className="rounded-xm shadow-none">
        <div className="p-8">
          {/* Name Section */}
          <section>
            <form>
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-lg font-semibold">Your Name</h4>
                  <p className="text-sm text-muted-foreground">
                    This is your display name within the platform. For example,
                    your full name or nickname.
                  </p>
                </div>

                <div>
                  <Input
                    placeholder="Enter your name"
                    defaultValue="John Doe"
                    maxLength={32}
                    className="h-10 max-w-md rounded-md"
                  />
                </div>

                <footer className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Please use 32 characters at maximum.
                  </span>
                  <Button size="sm" className="h-8 px-4">
                    Save
                  </Button>
                </footer>
              </div>
            </form>
          </section>
        </div>
      </Card>
    </div>
  );
}
