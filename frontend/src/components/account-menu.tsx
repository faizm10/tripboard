"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, Map, UserRound } from "lucide-react";
import { initialsFromName } from "@/components/profile-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-actions";

export function AccountMenu({
  demo = false,
  email,
  image,
  name,
}: {
  demo?: boolean;
  email?: string | null;
  image?: string | null;
  name: string;
}) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      window.location.replace("/sign-in");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${name}'s account`} className="profile-chip-link">
        <Avatar className="size-9">
          {image ? <AvatarImage alt="" referrerPolicy="no-referrer" src={image} /> : null}
          <AvatarFallback>{initialsFromName(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-120 w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground text-sm font-medium">{name}</span>
              {email ? <span className="truncate text-xs">{email}</span> : null}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/trips">
              <Map />
              Your trips
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/account">
              <UserRound />
              Account
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={demo || signingOut}
          onSelect={() => {
            void handleSignOut();
          }}
        >
          <LogOut />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
