import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

type MaterialSymbolEntry = {
  iconName: string;
  tags?: string[];
  aliases?: string[];
};

@Injectable()
export class IconsService {
  private readonly symbols: MaterialSymbolEntry[];
  private readonly logger = new Logger(IconsService.name);

  constructor() {
    const filePath = join(process.cwd(), 'resources', 'material_symbols.json');
    try {
      const raw = readFileSync(filePath, 'utf8');
      this.symbols = JSON.parse(raw) as MaterialSymbolEntry[];
    } catch (error) {
      this.logger.warn(
        `Material symbols file not found or invalid at ${filePath}. Falling back to empty list.`,
      );
      this.symbols = [];
    }
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
