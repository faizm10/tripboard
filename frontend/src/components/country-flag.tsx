import Image from "next/image";
import { flagImageUrl } from "@/lib/country-flag";

export function CountryFlag({
  code,
  country,
}: {
  code: string;
  country: string;
}) {
  return (
    <Image
      alt=""
      className="trip-cover-flag"
      fill
      sizes="(max-width: 700px) 105px, 154px"
      src={flagImageUrl(code)}
      title={country}
    />
  );
}
