"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordField({
  id,
  name = "password",
  label,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  name?: string;
  label: string;
  autoComplete: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      setCaps(event.getModifierState("CapsLock"));
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          className="pr-12"
          {...(onChange
            ? {
                value: value ?? "",
                onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
              }
            : {})}
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-[#6F7480] hover:bg-brand/4"
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {caps ? <p className="mt-1 text-xs text-destructive">Caps Lock đang bật.</p> : null}
    </div>
  );
}
