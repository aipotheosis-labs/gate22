"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { X, UserPlus, Search } from "lucide-react"

interface Member {
  id: string
  name: string
  email: string
  avatar?: string
}

const availableMembers: Member[] = [
  { id: "1", name: "Alice Johnson", email: "alice@example.com", avatar: "/avatars/alice.jpg" },
  { id: "2", name: "Bob Smith", email: "bob@example.com", avatar: "/avatars/bob.jpg" },
  { id: "3", name: "Charlie Brown", email: "charlie@example.com", avatar: "/avatars/charlie.jpg" },
  { id: "4", name: "Diana Prince", email: "diana@example.com", avatar: "/avatars/diana.jpg" },
  { id: "5", name: "Edward Norton", email: "edward@example.com", avatar: "/avatars/edward.jpg" },
  { id: "6", name: "Fiona Green", email: "fiona@example.com", avatar: "/avatars/fiona.jpg" },
]

export default function NewTeamPage() {
  const router = useRouter()
  const [teamName, setTeamName] = useState("")
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const filteredMembers = availableMembers.filter(
    member => 
      !selectedMembers.find(selected => selected.id === member.id) &&
      (member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       member.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const addMember = (member: Member) => {
    setSelectedMembers([...selectedMembers, member])
    setSearchQuery("")
    setIsSearching(false)
  }

  const removeMember = (memberId: string) => {
    setSelectedMembers(selectedMembers.filter(m => m.id !== memberId))
  }

  const handleCreateTeam = () => {
    if (teamName.trim()) {
      console.log("Creating team:", { name: teamName, members: selectedMembers })
      router.push("/settings/teams")
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create New Team</h1>
        <p className="text-muted-foreground mt-2">
          Set up a new team and add members to collaborate
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Details</CardTitle>
            <CardDescription>
              Configure your team's name and basic information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  placeholder="Enter team name (e.g., Engineering, Marketing)"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Search and add members to your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search members by name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setIsSearching(true)
                  }}
                  onFocus={() => setIsSearching(true)}
                  className="pl-9"
                />
                
                {isSearching && searchQuery && (
                  <Card className="absolute top-full mt-2 w-full z-10">
                    <Command>
                      <CommandList>
                        <CommandEmpty>No members found.</CommandEmpty>
                        <CommandGroup>
                          {filteredMembers.map(member => (
                            <CommandItem
                              key={member.id}
                              className="flex items-center gap-3 cursor-pointer"
                              onSelect={() => addMember(member)}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.avatar} />
                                <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                              <UserPlus className="h-4 w-4 text-muted-foreground" />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </Card>
                )}
              </div>

              {selectedMembers.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Members ({selectedMembers.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map(member => (
                      <Badge
                        key={member.id}
                        variant="secondary"
                        className="flex items-center gap-2 py-1.5 px-3"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{member.name}</span>
                        <button
                          onClick={() => removeMember(member.id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedMembers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No members added yet</p>
                  <p className="text-xs mt-1">Search and add members to your team</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/settings/teams")}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateTeam}
            disabled={!teamName.trim()}
          >
            Create Team
          </Button>
        </div>
      </div>
    </div>
  )
}