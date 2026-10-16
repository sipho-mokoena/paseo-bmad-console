"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, User } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils";

export function UserMenu() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  if (isPending) {
    return <Skeleton className="size-7 rounded-md" />;
  }

  if (!session?.user) return null;

  const { name, email, image } = session.user;

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setSignOutError(true);
        return;
      }
      router.push("/login");
    } catch {
      setSignOutError(true);
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) setSignOutError(false); }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={name ?? email ?? "Account"}
          className="inline-flex size-8 md:size-7 items-center justify-center rounded-md outline-hidden transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent"
        >
          <Avatar size="sm" className="size-5">
            {image && <AvatarImage src={image} alt="" />}
            <AvatarFallback className="text-2xs">{getInitials(name)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        side="top"
        align="start"
        sideOffset={4}
        collisionPadding={8}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-xs leading-none text-muted-foreground">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <User />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {signOutError && (
          <p className="px-2 py-1.5 text-xs text-destructive">
            Sign out failed. Please try again.
          </p>
        )}
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={isSigningOut}
          variant="destructive"
        >
          {isSigningOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
