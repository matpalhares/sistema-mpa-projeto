// Gera variações do logo MPA (a partir do logo branco) e os QR codes na paleta nova.
import sharp from "sharp";
import QRCode from "qrcode";
const dir = "recursos/marca/";
const base = dir + "mpa_logo_branco.png";
async function tingir(hex, saida, opacidade = 1) {
  const { data, info } = await sharp(base).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = Math.round(data[i + 3] * opacidade); }
  await sharp(data, { raw: info }).png().toFile(saida);
}
await tingir("#0D2F63", dir + "mpa_logo_azul.png");
await tingir("#C79B63", dir + "mpa_logo_dourado.png");
await tingir("#0D2F63", dir + "mpa_marca_dagua.png", 0.05);
const qr = (texto, saida, cor = "#0D2F63") => QRCode.toFile(saida, texto, { errorCorrectionLevel: "H", margin: 2, width: 360, color: { dark: cor, light: "#F7F4EE" } });
await qr("https://wa.me/5517997080373", dir + "mpa_qr_whatsapp.png");
await qr("https://instagram.com/matheuspalhares.arquitetura", dir + "mpa_qr_instagram.png", "#A87B3F");
console.log("ok");
