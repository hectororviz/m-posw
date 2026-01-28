const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');

const modelRegex = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
const models = new Map();

for (const match of schema.matchAll(modelRegex)) {
  const name = match[1];
  const body = match[2];
  const fields = new Map();

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) {
      continue;
    }
    const parts = line.split(/\s+/);
    const fieldName = parts[0];
    const fieldType = parts[1];
    const attributes = parts.slice(2).join(' ');

    if (!fieldName || !fieldType) {
      continue;
    }

    fields.set(fieldName, {
      name: fieldName,
      type: fieldType,
      attributes,
      hasDbUuid: attributes.includes('@db.Uuid'),
      isRelation: attributes.includes('@relation'),
    });
  }

  models.set(name, { name, fields });
}

const modelIdHasUuid = new Map();
for (const [name, model] of models.entries()) {
  const idField = [...model.fields.values()].find((field) => field.attributes.includes('@id'));
  modelIdHasUuid.set(name, idField ? idField.hasDbUuid : false);
}

const errors = [];

for (const [modelName, model] of models.entries()) {
  for (const field of model.fields.values()) {
    if (!field.isRelation) {
      continue;
    }

    const fieldType = field.type.replace(/[\[\]?]/g, '');
    const targetHasUuid = modelIdHasUuid.get(fieldType);
    if (!targetHasUuid) {
      continue;
    }

    const fieldsMatch = field.attributes.match(/fields:\s*\[([^\]]+)\]/);
    if (!fieldsMatch) {
      continue;
    }

    const fkFields = fieldsMatch[1]
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    for (const fkFieldName of fkFields) {
      const fkField = model.fields.get(fkFieldName);
      if (!fkField) {
        continue;
      }

      if (!fkField.hasDbUuid) {
        errors.push(`${modelName}.${fkFieldName} should use @db.Uuid to match ${fieldType}.id`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Foreign key type mismatch detected:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Foreign key type check passed.');
