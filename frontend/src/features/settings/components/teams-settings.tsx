"use client"

import { useMetaInfo } from "@/components/context/metainfo"
import { Button } from "@/components/ui/button"
import { Plus, Users, UsersRound, Settings, Trash2, Edit } from "lucide-react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { listTeams } from "@/features/teams/api/team"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

export function TeamsSettings() {
  const { activeOrg, accessToken } = useMetaInfo()
  const router = useRouter()

  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams", activeOrg.orgId],
    queryFn: () => listTeams(accessToken, activeOrg.orgId),
    enabled: !!accessToken && !!activeOrg.orgId,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
          <p className="text-muted-foreground">
            Manage teams and team settings for {activeOrg.orgName}
          </p>
        </div>
        <Button onClick={() => router.push("/settings/teams/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-[200px]" />
                      <Skeleton className="h-4 w-[300px]" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-[150px]" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : teams && teams.length > 0 ? (
          teams.map((team) => (
            <Card key={team.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    {team.description && (
                      <CardDescription>{team.description}</CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => router.push(`/settings/teams/${team.id}`)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Manage Team
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Team
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="h-4 w-4 mr-1" />
                    {team.member_count} {team.member_count === 1 ? "member" : "members"}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push(`/settings/teams/${team.id}`)}
                  >
                    View Members
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UsersRound className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Create your first team to organize members and manage permissions
              </p>
              <Button onClick={() => router.push("/settings/teams/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Team
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {teams && teams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team Settings</CardTitle>
            <CardDescription>
              Configure default settings for all teams
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Team Creation</p>
                <p className="text-sm text-muted-foreground">
                  Allow members to create new teams
                </p>
              </div>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Default Permissions</p>
                <p className="text-sm text-muted-foreground">
                  Set default permissions for new team members
                </p>
              </div>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Team Limits</p>
                <p className="text-sm text-muted-foreground">
                  Maximum number of teams: Unlimited
                </p>
              </div>
              <Badge variant="secondary">Pro Plan</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}