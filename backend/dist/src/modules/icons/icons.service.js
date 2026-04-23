"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var IconsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IconsService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
let IconsService = IconsService_1 = class IconsService {
    constructor() {
        this.logger = new common_1.Logger(IconsService_1.name);
        const filePath = (0, path_1.join)(process.cwd(), 'resources', 'material_symbols.json');
        try {
            const raw = (0, fs_1.readFileSync)(filePath, 'utf8');
            this.symbols = JSON.parse(raw);
        }
        catch (error) {
            this.logger.warn(`Material symbols file not found or invalid at ${filePath}. Falling back to empty list.`);
            this.symbols = [];
        }
    }
    searchMaterialSymbols({ query, offset, limit, }) {
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
};
exports.IconsService = IconsService;
exports.IconsService = IconsService = IconsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], IconsService);
