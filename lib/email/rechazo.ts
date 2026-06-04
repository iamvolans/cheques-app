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

type PayloadRechazo = {
  numero_cheque: string;
  librador: string;
  monto: number;
  fee: number;
  multa: number;
  total_debitado: number;
  motivo: string;
};

const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export async function enviarRechazo(
  destinatario: string,
  razonSocial: string,
  p: PayloadRechazo
) {
  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
    <h2 style="color: #b91c1c;">Cheque rechazado</h2>
    <p>Estimados <strong>${razonSocial}</strong>:</p>
    <p>Les informamos que el siguiente valor fue <strong>rechazado por el banco</strong>:</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 6px 8px; border: 1px solid #ddd; background: #f5f5f5;">N° de cheque</td><td style="padding: 6px 8px; border: 1px solid #ddd;">${p.numero_cheque}</td></tr>
      <tr><td style="padding: 6px 8px; border: 1px solid #ddd; background: #f5f5f5;">Librador</td><td style="padding: 6px 8px; border: 1px solid #ddd;">${p.librador}</td></tr>
      <tr><td style="padding: 6px 8px; border: 1px solid #ddd; background: #f5f5f5;">Monto</td><td style="padding: 6px 8px; border: 1px solid #ddd;">${fmtARS.format(p.monto)}</td></tr>
      <tr><td style="padding: 6px 8px; border: 1px solid #ddd; background: #f5f5f5;">Motivo</td><td style="padding: 6px 8px; border: 1px solid #ddd;">${p.motivo}</td></tr>
    </table>
    <p>De acuerdo a las condiciones acordadas, se debitó de su cuenta:</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 6px 8px; border: 1px solid #ddd; background: #f5f5f5;">Comisión</td><td style="padding: 6px 8px; border: 1px solid #ddd;">${fmtARS.format(p.fee)}</td></tr>
      <tr><td style="padding: 6px 8px; border: 1px solid #ddd; background: #f5f5f5;">Penalización bancaria</td><td style="padding: 6px 8px; border: 1px solid #ddd;">${fmtARS.format(p.multa)}</td></tr>
      <tr><td style="padding: 6px 8px; border: 1px solid #ddd; background: #fee2e2;"><strong>Total debitado</strong></td><td style="padding: 6px 8px; border: 1px solid #ddd; background: #fee2e2;"><strong>${fmtARS.format(p.total_debitado)}</strong></td></tr>
    </table>
    <p style="font-size: 12px; color: #666; margin-top: 24px;">
      Este es un mensaje automático del sistema de gestión de cobranza. Ante cualquier consulta, responda este correo.
    </p>
  </div>`;

  await transporter.sendMail({
    from: `"Cobranzas GOAT" <${process.env.GMAIL_USER}>`,
    to: destinatario,
    subject: `Cheque N° ${p.numero_cheque} rechazado — débito de ${fmtARS.format(p.total_debitado)}`,
    html,
  });
}
