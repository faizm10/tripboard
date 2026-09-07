import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";

export async function SiteHeader() {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer && !viewer.demo);
  const name = viewer?.name ?? "Traveller";
  const image = viewer?.image;

  return (
    <header className="site-header">
      <Logo />
      <div className="site-actions">
        {signedIn ? (
          <AccountMenu email={viewer?.email} image={image} name={name} />
        ) : (
          <>
            <Link className="text-link" href="/sign-in">
              Sign in
            </Link>
            <Link className="button button-small button-ink" href="/sign-up">
              Start a trip
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
