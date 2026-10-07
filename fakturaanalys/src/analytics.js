'use strict';
// Deterministiska analyser direkt i SQL – inga AI-anrop, samma svar varje gång.

function buildWhere(f = {}, alias = '') {
  const a = alias ? `${alias}.` : '';
  const where = [];
  const params = [];
  if (f.projectIds && f.projectIds.length) {
    where.push(`${a}project_id IN (${f.projectIds.map(() => '?').join(',')})`);
    params.push(...f.projectIds.map(Number));
  }
  const monthCol = f.monthBasis === 'invoice' ? 'invoice_month' : 'work_month';
  if (f.from) { where.push(`${a}${monthCol} >= ?`); params.push(f.from); }
  if (f.to) { where.push(`${a}${monthCol} <= ?`); params.push(f.to); }
  if (f.supplier) { where.push(`${a}supplier_name = ?`); params.push(f.supplier); }
  if (f.category) { where.push(`${a}cost_category = ?`); params.push(f.category); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params, monthCol };
}

function overview(db, f) {
  const w = buildWhere(f);
  const q = (select, group, order) => db.prepare(
    `SELECT ${select} FROM cost_lines ${w.sql} GROUP BY ${group} ORDER BY ${order}`).all(...w.params);
  const total = db.prepare(`SELECT ROUND(SUM(effective_amount),2) AS total, COUNT(*) AS lines
    FROM cost_lines ${w.sql}`).get(...w.params);
  return {
    total,
    byCategory: q('cost_category AS key, ROUND(SUM(effective_amount),2) AS amount, COUNT(*) AS lines',
      'cost_category', 'amount DESC'),
    bySupplier: q('supplier_name AS key, ROUND(SUM(effective_amount),2) AS amount, COUNT(*) AS lines',
      'supplier_name', 'amount DESC'),
    byMonth: q(`${w.monthCol} AS key, ROUND(SUM(effective_amount),2) AS amount, COUNT(*) AS lines`,
      w.monthCol, 'key'),
    byTrade: q(`trade AS key, ROUND(SUM(quantity),2) AS hours, ROUND(SUM(effective_amount),2) AS amount,
      ROUND(SUM(effective_amount)/NULLIF(SUM(quantity),0),2) AS avg_price`,
      'trade', 'amount DESC').filter((r) => r.key),
  };
}

// Jämför à-priser mellan projekt för t.ex. trade=elektriker (h) eller material_type=betong (m3).
function compareUnitPrices(db, { dimension, value, unit, ...f }) {
  if (!['trade', 'material_type', 'cost_category'].includes(dimension)) throw new Error('Ogiltig dimension');
  const w = buildWhere(f);
  const cond = [`${dimension} = ?`, 'effective_unit_price IS NOT NULL', 'quantity > 0'];
  const params = [value];
  if (unit) { cond.push('unit = ?'); params.push(unit); }
  const whereSql = w.sql ? `${w.sql} AND ${cond.join(' AND ')}` : `WHERE ${cond.join(' AND ')}`;
  const allParams = [...w.params, ...params];
  const agg = `COUNT(*) AS lines, ROUND(SUM(quantity),2) AS quantity,
    ROUND(SUM(quantity*effective_unit_price)/SUM(quantity),2) AS avg_price,
    ROUND(MIN(effective_unit_price),2) AS min_price, ROUND(MAX(effective_unit_price),2) AS max_price,
    ROUND(SUM(quantity*unit_price)/SUM(quantity),2) AS avg_supplier_price,
    GROUP_CONCAT(DISTINCT supplier_name) AS suppliers, GROUP_CONCAT(DISTINCT unit) AS units,
    MAX(markup_assumed) AS has_assumed_markup`;
  const perProject = db.prepare(`SELECT project_id, project_name, ${agg} FROM cost_lines ${whereSql}
    GROUP BY project_id ORDER BY avg_price`).all(...allParams);
  const overall = db.prepare(`SELECT ${agg} FROM cost_lines ${whereSql}`).get(...allParams);
  return { dimension, value, unit: unit || null, perProject, overall };
}

// Vilka värden finns att jämföra (för rullistor i UI:t)
function dimensions(db) {
  return {
    trades: db.prepare(`SELECT trade AS value, unit, COUNT(DISTINCT project_id) AS projects, COUNT(*) AS lines
      FROM cost_lines WHERE trade IS NOT NULL AND quantity > 0 GROUP BY trade, unit ORDER BY lines DESC`).all(),
    materials: db.prepare(`SELECT material_type AS value, unit, COUNT(DISTINCT project_id) AS projects,
      COUNT(*) AS lines FROM cost_lines WHERE material_type IS NOT NULL AND quantity > 0
      GROUP BY material_type, unit ORDER BY lines DESC`).all(),
    suppliers: db.prepare('SELECT DISTINCT supplier_name AS value FROM cost_lines ORDER BY 1').all().map((r) => r.value),
    months: db.prepare(`SELECT DISTINCT work_month AS value FROM cost_lines WHERE work_month IS NOT NULL
      UNION SELECT DISTINCT invoice_month FROM cost_lines WHERE invoice_month IS NOT NULL ORDER BY 1`)
      .all().map((r) => r.value),
  };
}

module.exports = { overview, compareUnitPrices, dimensions, buildWhere };
