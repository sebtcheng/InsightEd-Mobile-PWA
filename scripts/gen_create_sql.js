import fs from 'fs';

const schema = JSON.parse(fs.readFileSync('masterlist_schema.json', 'utf8'));

const cols = schema.map(c => {
    let type = c.data_type;
    if (c.character_maximum_length) {
        type += `(${c.character_maximum_length})`;
    }
    if (type === 'character varying') type = 'VARCHAR';
    return `"${c.column_name}" ${type}`;
});

const createQuery = `
    CREATE TABLE IF NOT EXISTS masterlist_26_30 (
        ${cols.join(',\n        ')}
    );
`;

fs.writeFileSync('create_table.sql', createQuery);
console.log("Saved SQL to create_table.sql");
