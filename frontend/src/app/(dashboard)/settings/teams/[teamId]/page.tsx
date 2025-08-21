"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, UserMinus, UserPlus, Crown, Shield, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

interface TeamMember {
  id: string
  name: string
  email: string
  role: "owner" | "admin" | "member"
  avatar?: string
  joinedAt: string
}

const mockTeamMembers: TeamMember[] = [
  { id: "1", name: "Alice Johnson", email: "alice@example.com", role: "owner", avatar: "/avatars/alice.jpg", joinedAt: "2023-01-15" },
  { id: "2", name: "Bob Smith", email: "bob@example.com", role: "admin", avatar: "/avatars/bob.jpg", joinedAt: "2023-02-20" },
  { id: "3", name: "Charlie Brown", email: "charlie@example.com", role: "member", avatar: "/avatars/charlie.jpg", joinedAt: "2023-03-10" },
  { id: "4", name: "Diana Prince", email: "diana@example.com", role: "member", avatar: "/avatars/diana.jpg", joinedAt: "2023-04-05" },
]

export default function TeamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [members, setMembers] = useState(mockTeamMembers)

  const teamId = params.teamId as string
  const teamName = "Engineering Team"

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { icon: any, variant: "default" | "secondary" | "outline" }> = {
      owner: { icon: Crown, variant: "default" },
      admin: { icon: Shield, variant: "secondary" },
      member: { icon: null, variant: "outline" }
    }
    
    const config = variants[role]
    const Icon = config?.icon

    return (
      <Badge variant={config?.variant || "outline"}>
        {Icon && <Icon className="h-3 w-3 mr-1" />}
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    )
  }

  const removeMember = (memberId: string) => {
    setMembers(members.filter(m => m.id !== memberId))
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push("/settings/teams")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Teams
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{teamName}</h1>
            <p className="text-muted-foreground mt-2">
              Manage team members and permissions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Team Settings
            </Button>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Members
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? "member" : "members"} in this team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.name}</p>
                      {getRoleBadge(member.role)}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Crown className="h-4 w-4 mr-2" />
                      Make Owner
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Shield className="h-4 w-4 mr-2" />
                      Make Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings className="h-4 w-4 mr-2" />
                      Permissions
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => removeMember(member.id)}
                      disabled={member.role === "owner"}
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Remove from Team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}