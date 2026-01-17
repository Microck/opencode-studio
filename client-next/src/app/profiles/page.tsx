"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Check, User, Layers, Play } from "lucide-react";
import { getProfiles, createProfile, deleteProfile, activateProfile, type ProfileList } from "@/lib/api";

export default function ProfilesPage() {
  const [data, setData] = useState<ProfileList | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const loadProfiles = async () => {
    try {
      const res = await getProfiles();
      setData(res);
    } catch (e) {
      toast.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCreate = async () => {
    if (!newProfileName.trim()) return;
    try {
      setCreating(true);
      await createProfile(newProfileName);
      toast.success(`Profile ${newProfileName} created`);
      setCreateOpen(false);
      setNewProfileName("");
      loadProfiles();
    } catch (e) {
      toast.error("Failed to create profile");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProfile(deleteTarget);
      toast.success("Profile deleted");
      loadProfiles();
    } catch (e) {
      toast.error("Failed to delete profile");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleActivate = async (name: string) => {
    try {
      setActivating(name);
      await activateProfile(name);
      toast.success(`Switched to ${name}`);
      loadProfiles();
    } catch (e) {
      toast.error("Failed to switch profile");
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12 p-8">
      <header className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            Profiles
            <Badge variant="outline" className="font-mono text-xs font-normal">
              {data?.active ? `Active: ${data.active}` : "No active profile"}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage isolated OpenCode environments (configs, history, sessions).
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Profile</DialogTitle>
              <DialogDescription>
                Create a new isolated configuration environment.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input 
                placeholder="Profile Name (e.g. work)" 
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newProfileName.trim() || creating}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.profiles.map((profile) => {
          const isActive = data.active === profile;
          return (
            <Card key={profile} className={`hover-lift transition-all ${isActive ? 'border-primary shadow-md bg-primary/5' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-md ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{profile}</CardTitle>
                      {isActive && <Badge className="mt-1">Active</Badge>}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mt-4">
                  {isActive ? (
                    <Button disabled className="w-full" variant="secondary">
                      <Check className="h-4 w-4 mr-2" />
                      Current
                    </Button>
                  ) : (
                    <Button 
                      className="w-full" 
                      variant="outline" 
                      onClick={() => handleActivate(profile)}
                      disabled={activating === profile}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Switch
                    </Button>
                  )}
                  
                  {profile !== 'default' && !isActive && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(profile)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the profile "{deleteTarget}" and all its configuration and history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
