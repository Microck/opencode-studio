// node:sqlite uses camel-case readOnly. An unknown `readonly` option is ignored.
function openReadOnlyDatabase(DatabaseSync, file) {
    if (!DatabaseSync) throw new Error('SQLite requires a compatible Node runtime');
    return new DatabaseSync(file, { readOnly: true });
}
module.exports = { openReadOnlyDatabase };
