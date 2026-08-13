function mapRow(row) {
  const mapped = {};
  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
    mapped[camelKey] = row[key];
  }
  return mapped;
}

function mapRows(rows) {
  return rows.map(mapRow);
}

module.exports = { mapRow, mapRows };
