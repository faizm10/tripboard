import Image from "next/image";
import { flagImageUrl } from "@/lib/country-flag";

export function CountryFlag({
  code,
  country,
  className = "trip-cover-flag",
  sizes = "(max-width: 700px) 105px, 154px",
}: {
  code: string;
  country: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <Image
      alt=""
      className={className}
      fill
      sizes={sizes}
      src={flagImageUrl(code)}
      title={country}
    />
  );
}
