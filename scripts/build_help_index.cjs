/* scripts/build_help_index.cjs */
const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

async function main() {
  // PDF già in public/
  const pdfPath = path.join(process.cwd(), "public", "circolare.pdf");
  if (!fs.existsSync(pdfPath)) {
    throw new Error("PDF non trovato: " + pdfPath);
  }

  const dataBuffer = fs.readFileSync(pdfPath);

  // Estrae testo (tutto insieme)
  const data = await pdf(dataBuffer);

  // Spezziamo in “pseudo-pagine” usando form-feed se presente, altrimenti blocchi
  // (pdf-parse a volte non mantiene le pagine reali, ma per la ricerca va benissimo)
  let chunks = data.text.split("\f").map(s => s.trim()).filter(Boolean);

  // fallback: se non ci sono \f, tagliamo in blocchi da ~3500 caratteri
  if (chunks.length <= 1) {
    const text = data.text.replace(/\s+\n/g, "\n").trim();
    const size = 3500;
    chunks = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
  }

  const out = chunks.map((text, idx) => ({
    id: idx + 1,
    // ATTENZIONE: questa "page" è indicativa se il PDF non mantiene \f
    page: idx + 1,
    text,
  }));

  const outDir = path.join(process.cwd(), "src", "help");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "circolare_index.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");

  console.log("✅ Creato indice:", outPath, "chunks:", out.length);
}

main().catch((e) => {
  console.error("❌ Errore:", e.message);
  process.exit(1);
});
