"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new client_1.PrismaClient();
async function main() {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const adminData = {
        username: adminUsername,
        password: passwordHash,
        role: client_1.Role.ADMIN,
        active: true,
    };
    await prisma.user.upsert({
        where: { username: adminUsername },
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
    await seedAssetStatuses();
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
async function seedAssetStatuses() {
    await prisma.assetStatus.createMany({
        data: [
            { name: 'Activo', isSystem: true },
            { name: 'De Baja', isSystem: true },
        ],
        skipDuplicates: true,
    });
    console.log('AssetStatus sembrado correctamente.');
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
