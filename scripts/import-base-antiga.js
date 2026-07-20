require('dotenv').config();

const path = require('path');
const mongoose = require('mongoose');

const { importFromFile, printSummary } = require('../utils/legacyImport');

const args = process.argv.slice(2);

const getArgValue = (name, defaultValue = null) => {
  const prefix = `--${name}=`;
  const item = args.find((value) => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : defaultValue;
};

const hasFlag = (name) => args.includes(`--${name}`);

const inputFile = getArgValue('file');
const sheetName = getArgValue('sheet');
const target = getArgValue('target', 'permanent');
const dryRun = hasFlag('dry-run');

if (!inputFile) {
  console.error('Uso: node scripts/import-base-antiga.js --file=base.xlsx [--sheet=Planilha1] [--target=temp|permanent] [--dry-run]');
  process.exit(1);
}

const absoluteInputFile = path.isAbsolute(inputFile) ? inputFile : path.join(process.cwd(), inputFile);

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const summary = await importFromFile(absoluteInputFile, { sheetName, target, dryRun });
  printSummary(summary);

  if (dryRun) {
    console.log('\nModo dry-run ativado. Nenhum dado foi gravado.');
  }

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('Erro ao importar base antiga:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});