/* scripts/build_help_index.cjs */
const fs = require("fs");
const path = require("path");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

async function main() {
  const pdfPath = path.join(process.cwd(), "public", "circolare.pdf");

  if (!fs.existsSync(pdfPath)) {
    throw new Error("PDF non trovato: " + pdfPath);
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  const chunks = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const text = textContent.items
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      chunks.push({
        id: pageNum,
        page: pageNum,
        source: "Circolare Agenzia delle Entrate n. 12/E (2026)",
        text,
      });
    }
  }

  const outDir = path.join(process.cwd(), "src", "help");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "circolare_index.json");
  fs.writeFileSync(outPath, JSON.stringify(chunks, null, 2), "utf-8");

  console.log("✅ Indice help creato");
  console.log("📄 Pagine indicizzate:", chunks.length);
}

main().catch((e) => {
  console.error("❌ Errore:", e);
  process.exit(1);
});
