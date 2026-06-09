"use client";

import { useState } from "react";

function formatearCuit(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export default function InputCuit({
  name,
  placeholder,
  required,
  defaultValue,
  className,
}: {
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  className?: string;
}) {
  const [valor, setValor] = useState(formatearCuit(defaultValue ?? ""));
  return (
    <input
      name={name}
      value={valor}
      onChange={(e) => setValor(formatearCuit(e.target.value))}
      placeholder={placeholder}
      required={required}
      inputMode="numeric"
      maxLength={13}
      className={className}
    />
  );
}
