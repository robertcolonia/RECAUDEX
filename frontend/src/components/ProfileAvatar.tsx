import { useEffect, useState } from "react";
import { authenticatedBlob } from "../api/client";

type Props = {
  fullName?: string;
  updatedAt?: string | null;
  className?: string;
};

function initials(fullName = "") {
  return fullName.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export function ProfileAvatar({ fullName, updatedAt, className = "avatar" }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setImageUrl(null);
    if (!updatedAt) return () => { active = false; };

    authenticatedBlob(`/api/auth/avatar?v=${encodeURIComponent(updatedAt)}`)
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => setImageUrl(null));

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [updatedAt]);

  if (imageUrl) return <img className={className} src={imageUrl} alt={`Foto de perfil de ${fullName || "usuario"}`} />;
  return <div className={className} aria-label={`Perfil de ${fullName || "usuario"}`}>{initials(fullName)}</div>;
}
