const fs = require('fs');
const XLSX = require('xlsx');

const Cruzado = require('../models/Cruzado');
const CruzadoTemp = require('../models/CruzadoTemp');

const normalizeText = (value) => String(value || '').trim();

const normalizeDigits = (value) => normalizeText(value).replace(/\D/g, '');

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;

  const normalized = normalizeText(value).toLowerCase();
  if (['sim', 's', 'true', '1', 'x', 'yes', 'y'].includes(normalized)) return true;
  if (['nao', 'não', 'n', 'false', '0', 'no'].includes(normalized)) return false;
  return defaultValue;
};

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  const text = normalizeText(value);
  const match = text.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getHeaderValue = (row, aliases) => {
  const normalizedKeys = Object.keys(row).reduce((acc, key) => {
    acc[key.toLowerCase().replace(/\s+/g, '')] = row[key];
    return acc;
  }, {});

  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase().replace(/\s+/g, '');
    if (normalizedKeys[normalizedAlias] !== undefined) {
      return normalizedKeys[normalizedAlias];
    }
  }

  return undefined;
};

const mapVinculo = (value) => {
  const text = normalizeText(value).toLowerCase();
  if (text.includes('marinha')) return 'Marinha';
  if (text.includes('exército') || text.includes('exercito')) return 'Exército';
  if (text.includes('força aérea') || text.includes('forca aerea')) return 'Força Aérea';
  if (text.includes('polícia militar') || text.includes('policia militar')) return 'Polícia Militar';
  if (text.includes('corpo de bombeiros')) return 'Corpo de Bombeiros Militar';
  if (text.includes('civil')) return 'Civil';
  return null;
};

const mapSituacao = (value) => {
  const text = normalizeText(value).toLowerCase();
  if (text.includes('ativa')) return 'Ativa';
  if (text.includes('reserva')) return 'Reserva';
  if (text.includes('reform')) return 'Reformado';
  if (text.includes('aposent')) return 'Aposentado';
  if (text.includes('pension')) return 'Pensionista';
  return null;
};

const mapFormacao = (value) => {
  const text = normalizeText(value).toLowerCase();
  if (text.includes('fund')) return 'fundamental';
  if (text.includes('med')) return 'medio';
  if (text.includes('super')) return 'superior';
  if (text.includes('mestre')) return 'mestre';
  if (text.includes('dout')) return 'doutor';
  return null;
};

// Converte string vazia/undefined para null (seguro para gravação no Mongo)
const nullIfEmpty = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const buildDocument = (row, rowNumber, target) => {
  const nome = normalizeText(getHeaderValue(row, ['nome', 'nome completo', 'nome completo do cruzado']));
  const cpf = normalizeDigits(getHeaderValue(row, ['cpf', 'c.p.f.', 'cadastro cpf']));
  const celular = normalizeText(getHeaderValue(row, ['celular', 'telefone', 'telefone celular', 'whatsapp']));
  const email = normalizeText(getHeaderValue(row, ['email', 'e-mail', 'mail']));
  const estado = normalizeText(getHeaderValue(row, ['estado', 'uf']));
  const cidade = normalizeText(getHeaderValue(row, ['cidade', 'municipio', 'município']));
  const endereco = normalizeText(getHeaderValue(row, ['endereco', 'endereço', 'logradouro']));
  const cep = normalizeDigits(getHeaderValue(row, ['cep', 'codigo postal', 'código postal']));
  const sexoRaw = normalizeText(getHeaderValue(row, ['sexo', 'genero', 'gênero'])).toLowerCase();
  const sexo = sexoRaw.startsWith('f') ? 'feminino' : (sexoRaw ? 'masculino' : null);
  const dataNascimento = parseDate(getHeaderValue(row, ['data de nascimento', 'nascimento', 'dt nascimento', 'data_nascimento']));
  const vinculoSource = getHeaderValue(row, ['vinculo profissional', 'vínculo profissional', 'vinculo', 'vínculo']);
  const especificarVinculo = normalizeText(getHeaderValue(row, ['especificar vinculo', 'especificar vínculo', 'observacao vinculo', 'observação vínculo']));
  const situacaoSource = getHeaderValue(row, ['situacao profissional', 'situação profissional', 'situacao', 'situação']);
  const especificarSituacao = normalizeText(getHeaderValue(row, ['especificar situacao', 'especificar situação', 'observacao situacao', 'observação situação']));
  const formacao = mapFormacao(getHeaderValue(row, ['formacao', 'formação', 'escolaridade']));
  const nucleoOuGede = normalizeText(getHeaderValue(row, ['nucleo ou gede', 'núcleo ou gede', 'nucleo/gede', 'núcleo/gede', 'nucleo', 'núcleo']));
  const nomeResponsavelIndicacao = normalizeText(getHeaderValue(row, ['nome responsavel indicacao', 'nome responsável indicação', 'indicador', 'responsavel indicacao']));
  const cpfResponsavelIndicacao = normalizeDigits(getHeaderValue(row, ['cpf responsavel indicacao', 'cpf responsável indicação', 'cpf indicador']));
  const desejaContribuir = parseBoolean(getHeaderValue(row, ['deseja contribuir', 'contribui', 'contribuir']), null);
  const valorContribuicaoRaw = getHeaderValue(row, ['valor contribuicao', 'valor contribuição', 'contribuicao', 'contribuição']);
  const valorContribuicao = valorContribuicaoRaw === undefined || valorContribuicaoRaw === null || valorContribuicaoRaw === ''
    ? null
    : Number(String(valorContribuicaoRaw).replace('.', '').replace(',', '.'));
  const consignacao = parseBoolean(getHeaderValue(row, ['consignacao', 'consignação']), null);
  const encarnado = parseBoolean(getHeaderValue(row, ['encarnado']), null);
  const trabalharVoluntario = parseBoolean(getHeaderValue(row, ['trabalhar voluntario', 'trabalhar voluntário', 'voluntario', 'voluntário']), false);
  const numeroCruzadoRaw = normalizeText(getHeaderValue(row, ['numero cruzado', 'número cruzado', 'numero', 'número']));
  const numeroCruzado = numeroCruzadoRaw || null;
  const dataAprovacao = parseDate(getHeaderValue(row, ['data aprovacao', 'data aprovação', 'dataaprovacao', 'data de aprovacao']));

  return {
    rowNumber,
    nome: nome || null,
    cpf: cpf || null,
    celular: celular || null,
    email: email || null,
    estado: estado || null,
    cidade: cidade || null,
    endereco: endereco || null,
    cep: cep || null,
    sexo,
    dataNascimento,
    vinculoProfissional: mapVinculo(vinculoSource),
    especificarVinculo: especificarVinculo || null,
    situacaoProfissional: mapSituacao(situacaoSource),
    especificarSituacao: especificarSituacao || null,
    formacao,
    nucleoOuGede: nucleoOuGede || null,
    nomeResponsavelIndicacao: nomeResponsavelIndicacao || null,
    cpfResponsavelIndicacao: cpfResponsavelIndicacao || null,
    desejaContribuir,
    valorContribuicao: Number.isFinite(valorContribuicao) ? valorContribuicao : null,
    consignacao,
    numeroCruzado,
    encarnado,
    trabalharVoluntario,
    status: target === 'permanent' ? 'aprovado' : 'pendente',
    dataAprovacao: target === 'permanent' ? (dataAprovacao || new Date()) : null,
    origem: 'legado',
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

// Validação leniente para o fluxo legado: apenas nome e numeroCruzado são essenciais.
// Campos ausentes são aceitos como null/vazio.
const validateDocument = (document, options = {}) => {
  const { target = 'permanent' } = options;
  const missing = [];

  if (!normalizeText(document.nome)) missing.push('nome');
  if (target === 'permanent' && !normalizeText(document.numeroCruzado)) missing.push('numeroCruzado');

  return { ok: missing.length === 0, missing };
};

const createSummary = () => ({
  read: 0,
  valid: 0,
  imported: 0,
  withoutCpf: 0,
  updated: 0,
  errors: 0,
  skipped: 0,
  invalidRows: []
});

const resolveModel = (target) => (target === 'permanent' ? Cruzado : CruzadoTemp);

// Remove undefined (o Mongo ignora undefined), mantém null para campos ausentes
const stripUndefined = (value) => Object.fromEntries(
  Object.entries(value).filter(([, entry]) => entry !== undefined)
);

const importRows = async (rows, options = {}) => {
  const { target = 'temp', dryRun = false } = options;
  const summary = createSummary();
  const Model = resolveModel(target);

  summary.read = rows.length;

  for (const [index, row] of rows.entries()) {
    const document = buildDocument(row, index + 2, target);
    const validation = validateDocument(document, { target });

    if (!validation.ok) {
      summary.skipped += 1;
      summary.invalidRows.push({ row: document.rowNumber, reason: `Campos obrigatórios ausentes: ${validation.missing.join(', ')}` });
      continue;
    }

    summary.valid += 1;

    // Contabilizar registros sem CPF (fluxo legado)
    if (!document.cpf) {
      summary.withoutCpf += 1;
    }

    if (dryRun) {
      continue;
    }

    try {
      // Buscar duplicidade: preferir CPF quando existir; senão usar numeroCruzado
      let existing = null;
      if (document.cpf) {
        existing = await Model.findOne({ cpf: document.cpf });
      }
      if (!existing && document.numeroCruzado) {
        existing = await Model.findOne({ numeroCruzado: document.numeroCruzado });
      }

      if (existing) {
        const updatePayload = stripUndefined({
          ...document,
          _id: undefined,
          rowNumber: undefined,
          cpf: document.cpf || existing.cpf || null,
          numeroCruzado: document.numeroCruzado || existing.numeroCruzado || null,
          updatedAt: new Date(),
          status: target === 'permanent' ? 'aprovado' : 'pendente',
          createdAt: existing.createdAt || document.createdAt
        });

        await Model.updateOne(
          { _id: existing._id },
          { $set: updatePayload },
          { runValidators: false }
        );

        summary.updated += 1;
        continue;
      }

      // Criar registro com campos vazios como null
      const docToCreate = stripUndefined({
        ...document,
        rowNumber: undefined,
        _id: undefined
      });

      await Model.create(docToCreate);
      summary.imported += 1;
    } catch (error) {
      // Duplicidade por índice parcial (ex.: mesmo numeroCruzado importado duas vezes na mesma leva)
      if (error.code === 11000) {
        summary.errors += 1;
        summary.invalidRows.push({ row: document.rowNumber, reason: `Duplicado (${error.message})` });
      } else {
        summary.errors += 1;
        summary.invalidRows.push({ row: document.rowNumber, reason: error.message });
      }
    }
  }

  return summary;
};

const importFromWorkbook = async (workbook, options = {}) => {
  const { sheetName } = options;
  const selectedSheetName = sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[selectedSheetName];

  if (!worksheet) {
    throw new Error(`Planilha '${selectedSheetName}' não encontrada.`);
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return importRows(rows, options);
};

const importFromBuffer = async (buffer, options = {}) => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  return importFromWorkbook(workbook, options);
};

const importFromFile = async (filePath, options = {}) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  return importFromWorkbook(workbook, options);
};

const printSummary = (summary) => {
  console.log('\nResumo da importação');
  console.log('--------------------');
  console.log(`Linhas lidas: ${summary.read}`);
  console.log(`Válidas: ${summary.valid}`);
  console.log(`Importadas: ${summary.imported}`);
  console.log(`Atualizadas: ${summary.updated}`);
  console.log(`Sem CPF: ${summary.withoutCpf || 0}`);
  console.log(`Com erro: ${summary.errors}`);
  console.log(`Ignoradas: ${summary.skipped}`);

  if (summary.invalidRows.length > 0) {
    console.log('\nLinhas inválidas:');
    summary.invalidRows.slice(0, 20).forEach((item) => {
      console.log(`- Linha ${item.row}: ${item.reason}`);
    });

    if (summary.invalidRows.length > 20) {
      console.log(`... mais ${summary.invalidRows.length - 20} linha(s) inválida(s)`);
    }
  }
};

module.exports = {
  importFromBuffer,
  importFromFile,
  printSummary,
};

