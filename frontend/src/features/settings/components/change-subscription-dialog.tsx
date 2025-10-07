"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useChangeSubscription } from "../hooks/use-change-subscription";
import { PLAN_CODES } from "../types/subscription.types";

interface ChangeSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planType: "free" | "team";
  currentPlanCode?: string;
}

export function ChangeSubscriptionDialog({
  open,
  onOpenChange,
  planType,
}: ChangeSubscriptionDialogProps) {
  const [seatCount, setSeatCount] = useState<number | "">(1);
  const { changeSubscription, isChanging } = useChangeSubscription();

  const isUpgrade = planType === "team";

  const handleConfirm = () => {
    if (planType === "team") {
      const seats = typeof seatCount === "number" ? seatCount : 1;
      changeSubscription({
        plan_code: PLAN_CODES.TEAM,
        seat_count: seats,
      });
    } else {
      changeSubscription({
        plan_code: PLAN_CODES.FREE,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isUpgrade ? "Upgrade to Team Plan" : "Downgrade to Free Tier"}</DialogTitle>
          <DialogDescription>
            {isUpgrade
              ? "Enter the number of seats you need for your team."
              : "Are you sure you want to downgrade to the Free Tier? Your features will be limited."}
          </DialogDescription>
        </DialogHeader>

        {isUpgrade && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="seat-count">Number of Seats</Label>
              <Input
                id="seat-count"
                type="number"
                min={1}
                value={seatCount}
                onChange={(e) => {
                  const value = e.target.value;
                  setSeatCount(value === "" ? "" : parseInt(value));
                }}
                placeholder="Enter number of seats"
              />
              <p className="text-sm text-muted-foreground">
                Price: ${(29.99 * (typeof seatCount === "number" ? seatCount : 0)).toFixed(2)}/month
              </p>
            </div>
          </div>
        )}

        {!isUpgrade && (
          <div className="my-4 space-y-2 rounded-lg bg-muted p-4">
            <h4 className="text-sm font-semibold">Free Tier Includes:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• 1 Control Plane</li>
              <li>• Max 1 Custom MCP</li>
              <li>• Max 2 Seats</li>
              <li>• 3 days Log Retention</li>
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isChanging}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isChanging}>
            {isChanging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
