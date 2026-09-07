import Link from "next/link";
import { Plus } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/logo";

export function AppHeader({
  demo = false,
  email,
  name = "Traveller",
  image,
  tripTitle,
  highlightNav = true,
}: {
  demo?: boolean;
  email?: string | null;
  name?: string;
  image?: string | null;
  tripTitle?: string;
  highlightNav?: boolean;
}) {
  return (
    <header className="app-header">
      <Logo />
      {tripTitle ? (
        <div className="app-header-trip">
          <span>Trip board</span>
          <strong>{tripTitle}</strong>
        </div>
      ) : (
        <nav className="app-nav" aria-label="App navigation">
          <Link className={highlightNav ? "active" : undefined} href="/trips">
            My trips
          </Link>
          <Link href="/trips/new">New trip</Link>
        </nav>
      )}
      <div className="app-header-actions">
        {!tripTitle && (
          <Link href="/trips/new" className="new-trip-link">
            <Plus size={16} /> New trip
          </Link>
        )}
        <AccountMenu demo={demo} email={email} image={image} name={name} />
      </div>
    </header>
  );
}
