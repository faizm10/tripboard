"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { PlacePhoto as PlacePhotoData } from "@/lib/types";

type PlacePhotoProps = {
  fsqPlaceId: string;
  name: string;
  label: string;
  sizes?: string;
  priority?: boolean;
};

export function PlacePhoto({ fsqPlaceId, name, label, sizes = "120px", priority = false }: PlacePhotoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(priority);

  useEffect(() => {
    if (inView || !frameRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [inView]);

  const query = useQuery({
    queryKey: ["place-photo", fsqPlaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/places/${encodeURIComponent(fsqPlaceId)}/photos?name=${encodeURIComponent(name)}`,
      );
      if (!response.ok) return null;
      const body = (await response.json()) as { photo: PlacePhotoData | null };
      return body.photo;
    },
    enabled: inView,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className={`place-photo${query.isLoading ? " is-loading" : ""}`} ref={frameRef}>
      {query.data ? (
        <>
          <Image
            alt={query.data.alt}
            fill
            priority={priority}
            sizes={sizes}
            src={query.data.url}
          />
          <small>{query.data.credit}</small>
        </>
      ) : (
        <span aria-hidden="true">{label.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
