"use client";

import { useState } from "react";

function desdeNumero(v?: string) {
  if (!v) return "";
  const n = Number(v);
  return isFinite(n) ? n.toLocaleString("es-AR", { maximumFractionDigits: 2 }) : "";
}

export default function InputMonto({
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
  const [display, setDisplay] = useState(desdeNumero(defaultValue));

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const limpio = e.target.value.replace(/[^\d.,]/g, "");
    const partes = limpio.split(",");
    const entero = partes[0].replace(/\./g, "").replace(/\D/g, "");
    const dec = partes.length > 1 ? partes.slice(1).join("").replace(/\D/g, "").slice(0, 2) : null;
    const enteroFmt = entero === "" ? "" : Number(entero).toLocaleString("es-AR");
    let out = enteroFmt;
    if (dec !== null) out = (enteroFmt === "" ? "0" : enteroFmt) + "," + dec;
    setDisplay(out);
  }

  // Lo que se envía al servidor: número plano "1000000.50"
  const normalizado = display.replace(/\./g, "").replace(",", ".");

  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={className}
      />
      <input type="hidden" name={name} value={normalizado} />
    </>
  );
}
