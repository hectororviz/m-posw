"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcrypt = require("bcrypt");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var adminUsername, adminPassword, passwordHash, adminData, setting;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    adminUsername = process.env.ADMIN_USERNAME || 'admin';
                    adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
                    return [4 /*yield*/, bcrypt.hash(adminPassword, 10)];
                case 1:
                    passwordHash = _a.sent();
                    adminData = {
                        username: adminUsername,
                        password: passwordHash,
                        role: client_1.Role.ADMIN,
                        active: true,
                    };
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { username: adminUsername },
                            update: adminData,
                            create: adminData,
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, prisma.setting.findFirst()];
                case 3:
                    setting = _a.sent();
                    if (!!setting) return [3 /*break*/, 5];
                    return [4 /*yield*/, prisma.setting.create({
                            data: {
                                storeName: 'Mi Tienda',
                                accentColor: '#0ea5e9',
                            },
                        })];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [4 /*yield*/, seedLedgerAccounts()];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, seedPaymentMethodAccounts()];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, seedAssetStatuses()];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function seedLedgerAccounts() {
    return __awaiter(this, void 0, void 0, function () {
        var accounts, parentMap, _i, accounts_1, a, parts, parentCode, codeToId, _a, accounts_2, a, existing, parentCode, parentId, created;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    accounts = [
                        { code: '1', name: 'Activo', type: 'ASSET', acceptsEntries: false },
                        { code: '1.1', name: 'Disponibilidades', type: 'ASSET', acceptsEntries: false },
                        { code: '1.1.01', name: 'Caja - Efectivo', type: 'ASSET', acceptsEntries: true },
                        { code: '1.1.02', name: 'Mercado Pago', type: 'ASSET', acceptsEntries: true },
                        { code: '1.1.03', name: 'Banco - Cuenta principal', type: 'ASSET', acceptsEntries: true },
                        { code: '1.2', name: 'Créditos', type: 'ASSET', acceptsEntries: false },
                        { code: '1.2.01', name: 'Créditos a cobrar', type: 'ASSET', acceptsEntries: true },
                        { code: '1.2.02', name: 'Anticipos entregados', type: 'ASSET', acceptsEntries: true },
                        { code: '1.2.03', name: 'Deudores por ventas fiadas', type: 'ASSET', acceptsEntries: true },
                        { code: '2', name: 'Pasivo', type: 'LIABILITY', acceptsEntries: false },
                        { code: '2.1', name: 'Deudas', type: 'LIABILITY', acceptsEntries: false },
                        { code: '2.1.01', name: 'Proveedores a pagar', type: 'LIABILITY', acceptsEntries: true },
                        { code: '2.1.02', name: 'Gastos pendientes de pago', type: 'LIABILITY', acceptsEntries: true },
                        { code: '3', name: 'Patrimonio Neto', type: 'EQUITY', acceptsEntries: false },
                        { code: '3.1', name: 'Patrimonio', type: 'EQUITY', acceptsEntries: false },
                        { code: '3.1.01', name: 'Patrimonio / Saldo inicial', type: 'EQUITY', acceptsEntries: true },
                        { code: '3.1.02', name: 'Resultados acumulados', type: 'EQUITY', acceptsEntries: true },
                        { code: '4', name: 'Ingresos', type: 'REVENUE', acceptsEntries: false },
                        { code: '4.1', name: 'Ingresos operativos', type: 'REVENUE', acceptsEntries: false },
                        { code: '4.1.01', name: 'Ventas en jornada', type: 'REVENUE', acceptsEntries: true },
                        { code: '4.1.02', name: 'Ventas de entradas', type: 'REVENUE', acceptsEntries: true },
                        { code: '4.1.03', name: 'Cuotas', type: 'REVENUE', acceptsEntries: true },
                        { code: '4.1.04', name: 'Donaciones', type: 'REVENUE', acceptsEntries: true },
                        { code: '4.1.99', name: 'Otros ingresos', type: 'REVENUE', acceptsEntries: true },
                        { code: '5', name: 'Gastos', type: 'EXPENSE', acceptsEntries: false },
                        { code: '5.1', name: 'Compras y gastos operativos', type: 'EXPENSE', acceptsEntries: false },
                        { code: '5.1.01', name: 'Compra de mercadería', type: 'EXPENSE', acceptsEntries: true },
                        { code: '5.1.02', name: 'Compra de bienes', type: 'EXPENSE', acceptsEntries: true },
                        { code: '5.1.03', name: 'Compra de insumos', type: 'EXPENSE', acceptsEntries: true },
                        { code: '5.1.04', name: 'Limpieza', type: 'EXPENSE', acceptsEntries: true },
                        { code: '5.1.05', name: 'Mantenimiento', type: 'EXPENSE', acceptsEntries: true },
                        { code: '5.1.06', name: 'Servicios', type: 'EXPENSE', acceptsEntries: true },
                        { code: '5.1.07', name: 'Transporte', type: 'EXPENSE', acceptsEntries: true },
                        { code: '5.1.99', name: 'Otros gastos', type: 'EXPENSE', acceptsEntries: true },
                    ];
                    parentMap = {};
                    for (_i = 0, accounts_1 = accounts; _i < accounts_1.length; _i++) {
                        a = accounts_1[_i];
                        parts = a.code.split('.');
                        if (parts.length > 1) {
                            parentCode = parts.slice(0, -1).join('.');
                            parentMap[a.code] = parentCode;
                        }
                        else {
                            parentMap[a.code] = null;
                        }
                    }
                    codeToId = {};
                    _a = 0, accounts_2 = accounts;
                    _b.label = 1;
                case 1:
                    if (!(_a < accounts_2.length)) return [3 /*break*/, 7];
                    a = accounts_2[_a];
                    return [4 /*yield*/, prisma.ledgerAccount.findUnique({ where: { code: a.code } })];
                case 2:
                    existing = _b.sent();
                    parentCode = parentMap[a.code];
                    parentId = parentCode ? codeToId[parentCode] || null : null;
                    if (!existing) return [3 /*break*/, 4];
                    return [4 /*yield*/, prisma.ledgerAccount.update({
                            where: { code: a.code },
                            data: {
                                name: a.name,
                                type: a.type,
                                acceptsEntries: a.acceptsEntries,
                                parentId: parentId || existing.parentId,
                            },
                        })];
                case 3:
                    _b.sent();
                    codeToId[a.code] = existing.id;
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, prisma.ledgerAccount.create({
                        data: { code: a.code, name: a.name, type: a.type, acceptsEntries: a.acceptsEntries, parentId: parentId },
                    })];
                case 5:
                    created = _b.sent();
                    codeToId[a.code] = created.id;
                    _b.label = 6;
                case 6:
                    _a++;
                    return [3 /*break*/, 1];
                case 7:
                    console.log('Plan de cuentas contable sembrado correctamente.');
                    return [2 /*return*/];
            }
        });
    });
}
function seedPaymentMethodAccounts() {
    return __awaiter(this, void 0, void 0, function () {
        var accounts, byCode, _i, accounts_3, a, mappings, _a, mappings_1, m, ledgerAccountId;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma.ledgerAccount.findMany({
                        where: { code: { in: ['1.1.01', '1.1.02', '1.2.03'] } },
                    })];
                case 1:
                    accounts = _b.sent();
                    byCode = {};
                    for (_i = 0, accounts_3 = accounts; _i < accounts_3.length; _i++) {
                        a = accounts_3[_i];
                        byCode[a.code] = a.id;
                    }
                    mappings = [
                        { paymentMethod: 'CASH', ledgerAccountCode: '1.1.01' },
                        { paymentMethod: 'MP_QR', ledgerAccountCode: '1.1.02' },
                        { paymentMethod: 'TRANSFER', ledgerAccountCode: '1.1.02' },
                        { paymentMethod: 'FIADO', ledgerAccountCode: '1.2.03' },
                    ];
                    _a = 0, mappings_1 = mappings;
                    _b.label = 2;
                case 2:
                    if (!(_a < mappings_1.length)) return [3 /*break*/, 5];
                    m = mappings_1[_a];
                    ledgerAccountId = byCode[m.ledgerAccountCode];
                    if (!ledgerAccountId) {
                        console.warn("Cuenta ".concat(m.ledgerAccountCode, " no encontrada para PaymentMethodAccount ").concat(m.paymentMethod));
                        return [3 /*break*/, 4];
                    }
                    return [4 /*yield*/, prisma.paymentMethodAccount.upsert({
                            where: { paymentMethod: m.paymentMethod },
                            update: { ledgerAccountId: ledgerAccountId },
                            create: { paymentMethod: m.paymentMethod, ledgerAccountId: ledgerAccountId },
                        })];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    _a++;
                    return [3 /*break*/, 2];
                case 5:
                    console.log('PaymentMethodAccount sembrado correctamente.');
                    return [2 /*return*/];
            }
        });
    });
}
function seedAssetStatuses() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.assetStatus.createMany({
                        data: [
                            { name: 'Activo', isSystem: true },
                            { name: 'De Baja', isSystem: true },
                        ],
                        skipDuplicates: true,
                    })];
                case 1:
                    _a.sent();
                    console.log('AssetStatus sembrado correctamente.');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (error) {
    console.error(error);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
