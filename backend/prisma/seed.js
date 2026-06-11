"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const adminName = process.env.ADMIN_NAME || 'admin';
    if (!adminEmail) {
        throw new Error('ADMIN_EMAIL es requerido para el usuario admin.');
    }
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const adminData = {
        name: adminName,
        password: passwordHash,
        role: client_1.Role.ADMIN,
        active: true,
        email: adminEmail,
    };
    await prisma.user.upsert({
        where: { name: adminName },
        update: adminData,
        create: adminData,
    });
    const setting = await prisma.setting.findFirst();
    if (!setting) {
        await prisma.setting.create({
            data: {
                storeName: 'Mi Tienda',
                accentColor: '#0ea5e9',
            },
        });
    }
    await seedLedgerAccounts();
    await seedPaymentMethodAccounts();
}
async function seedLedgerAccounts() {
    const accounts = [
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
    // Build parent references
    const parentMap = {};
    for (const a of accounts) {
        const parts = a.code.split('.');
        if (parts.length > 1) {
            const parentCode = parts.slice(0, -1).join('.');
            parentMap[a.code] = parentCode;
        }
        else {
            parentMap[a.code] = null;
        }
    }
    // Insert accounts with parent references
    const codeToId = {};
    for (const a of accounts) {
        const existing = await prisma.ledgerAccount.findUnique({ where: { code: a.code } });
        const parentCode = parentMap[a.code];
        const parentId = parentCode ? codeToId[parentCode] || null : null;
        if (existing) {
            await prisma.ledgerAccount.update({
                where: { code: a.code },
                data: {
                    name: a.name,
                    type: a.type,
                    acceptsEntries: a.acceptsEntries,
                    parentId: parentId || existing.parentId,
                },
            });
            codeToId[a.code] = existing.id;
        }
        else {
            const created = await prisma.ledgerAccount.create({
                data: { code: a.code, name: a.name, type: a.type, acceptsEntries: a.acceptsEntries, parentId },
            });
            codeToId[a.code] = created.id;
        }
    }
    console.log('Plan de cuentas contable sembrado correctamente.');
}
async function seedPaymentMethodAccounts() {
    const accounts = await prisma.ledgerAccount.findMany({
        where: { code: { in: ['1.1.01', '1.1.02', '1.2.03'] } },
    });
    const byCode = {};
    for (const a of accounts)
        byCode[a.code] = a.id;
    const mappings = [
        { paymentMethod: 'CASH', ledgerAccountCode: '1.1.01' },
        { paymentMethod: 'MP_QR', ledgerAccountCode: '1.1.02' },
        { paymentMethod: 'TRANSFER', ledgerAccountCode: '1.1.02' },
        { paymentMethod: 'FIADO', ledgerAccountCode: '1.2.03' },
    ];
    for (const m of mappings) {
        const ledgerAccountId = byCode[m.ledgerAccountCode];
        if (!ledgerAccountId) {
            console.warn(`Cuenta ${m.ledgerAccountCode} no encontrada para PaymentMethodAccount ${m.paymentMethod}`);
            continue;
        }
        await prisma.paymentMethodAccount.upsert({
            where: { paymentMethod: m.paymentMethod },
            update: { ledgerAccountId },
            create: { paymentMethod: m.paymentMethod, ledgerAccountId },
        });
    }
    console.log('PaymentMethodAccount sembrado correctamente.');
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
