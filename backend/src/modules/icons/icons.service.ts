import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve } from 'path';

type MaterialSymbolEntry = {
  iconName: string;
  tags?: string[];
  aliases?: string[];
};

@Injectable()
export class IconsService {
  private readonly symbols: MaterialSymbolEntry[];

  constructor() {
    const filePath = resolve(process.cwd(), 'resources', 'material_symbols.json');
    const raw = readFileSync(filePath, 'utf8');
    this.symbols = JSON.parse(raw) as MaterialSymbolEntry[];
  }

  searchMaterialSymbols({
    query,
    offset,
    limit,
  }: {
    query: string;
    offset: number;
    limit: number;
  }) {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? this.symbols.filter((symbol) => {
          const nameMatch = symbol.iconName.toLowerCase().includes(normalized);
          const tagMatch = (symbol.tags ?? []).some((tag) => tag.toLowerCase().includes(normalized));
          const aliasMatch = (symbol.aliases ?? []).some((alias) => alias.toLowerCase().includes(normalized));
          return nameMatch || tagMatch || aliasMatch;
        })
      : this.symbols;

    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const items = filtered.slice(safeOffset, safeOffset + safeLimit);

    return {
      items,
      total: filtered.length,
      offset: safeOffset,
      limit: safeLimit,
    };
  }
}
