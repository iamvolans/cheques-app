import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    type: "OAuth2",
    user: process.env.GMAIL_USER,
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN,
  },
});

type PayloadTransferencia = {
  monto: number;
  beneficiario: string;
  coelsa_id: string;
  fecha: string;
  tiene_comprobante: boolean;
  portal_url: string | null;
};

const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export async function enviarTransferenciaRealizada(
  destinatario: string,
  razonSocial: string,
  p: PayloadTransferencia
) {
  const boton = p.portal_url
    ? `<p style="margin-top:20px;"><a href="${p.portal_url}" style="background:#059669;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;">Ver en mi portal${p.tiene_comprobante ? " y descargar comprobante" : ""}</a></p>`
    : "";

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
    <h2 style="color: #047857;">Transferencia realizada</h2>
    <p>Estimados <strong>${razonSocial}</strong>:</p>
    <p>Les confirmamos que se realizó la siguiente transferencia desde su saldo disponible:</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5;">Monto</td><td style="padding:6px 8px;border:1px solid #ddd;">${fmtARS.format(p.monto)}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5;">Beneficiario</td><td style="padding:6px 8px;border:1px solid #ddd;">${p.beneficiario}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5;">Fecha</td><td style="padding:6px 8px;border:1px solid #ddd;">${p.fecha}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5;">Coelsa ID</td><td style="padding:6px 8px;border:1px solid #ddd;">${p.coelsa_id}</td></tr>
    </table>
    ${p.tiene_comprobante ? '<p style="margin-top:16px;">El comprobante está disponible para descargar en su portal (se elimina automáticamente a las 48 hs).</p>' : ""}
    ${boton}
    <p style="font-size: 12px; color: #666; margin-top: 24px;">
      Este es un mensaje automático del sistema de gestión de cobranza. Ante cualquier consulta, responda este correo.
    </p>
  </div>`;

  await transporter.sendMail({
    from: `"Cobranzas GOAT" <${process.env.GMAIL_USER}>`,
    to: destinatario,
    subject: `Transferencia realizada — ${fmtARS.format(p.monto)} a ${p.beneficiario}`,
    html,
  });
}
