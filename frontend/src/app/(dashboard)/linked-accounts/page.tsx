"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings2, ExternalLink, Shield, Clock } from "lucide-react";
import { LinkedAccountConfigurationStepper } from "@/features/linked-accounts/components/linked-account-configuration-stepper";
import { useLinkedAccounts } from "@/features/linked-accounts/hooks/use-linked-account";
import { LinkedAccount } from "@/features/linked-accounts/types/linkedaccount.types";
import { formatToLocalTime } from "@/utils/time";
import { Separator } from "@/components/ui/separator";

export default function LinkedAccountsPage() {
  const [selectedAccount, setSelectedAccount] = useState<LinkedAccount | null>(
    null,
  );
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const { data: accounts, isLoading } = useLinkedAccounts();

  const handleConfigure = (account: LinkedAccount) => {
    setSelectedAccount(account);
    setIsConfigOpen(true);
  };

  const handleCloseConfig = () => {
    setIsConfigOpen(false);
    setSelectedAccount(null);
  };

  return (
    <div>
      <div className="m-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Linked Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage and configure your connected accounts
          </p>
        </div>
        <Button onClick={() => setIsConfigOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>
      <Separator />

      <div className="m-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        ) : accounts && accounts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Card
                key={account.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {account.app_name}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {account.linked_account_owner_id}
                      </CardDescription>
                    </div>
                    <Badge variant={account.enabled ? "default" : "secondary"}>
                      {account.enabled ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      <span>{account.security_scheme}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {account.last_used_at
                          ? `Last used: ${formatToLocalTime(account.last_used_at)}`
                          : "Never used"}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleConfigure(account)}
                      >
                        <Settings2 className="mr-2 h-3 w-3" />
                        Configure
                      </Button>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-center space-y-3">
                <h3 className="text-lg font-semibold">
                  No linked accounts yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Connect your first account to start managing integrations
                </p>
                <Button onClick={() => setIsConfigOpen(true)} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedAccount && (
        <LinkedAccountConfigurationStepper
          isOpen={isConfigOpen}
          onClose={handleCloseConfig}
          account={selectedAccount}
        />
      )}
    </div>
  );
}
