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
var SociosService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SociosService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const prisma_service_1 = require("../common/prisma.service");
const journal_entries_service_1 = require("../treasury/journal-entries.service");
const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
let SociosService = SociosService_1 = class SociosService {
    constructor(prisma, journalEntriesService) {
        this.prisma = prisma;
        this.journalEntriesService = journalEntriesService;
        this.logger = new common_1.Logger(SociosService_1.name);
    }
    async getTipos() {
        return this.prisma.socioTipo.findMany({
            orderBy: { nombre: 'asc' },
        });
    }
    async getTipo(id) {
        const tipo = await this.prisma.socioTipo.findUnique({ where: { id } });
        if (!tipo)
            throw new common_1.NotFoundException('Tipo de socio no encontrado');
        return tipo;
    }
    async createTipo(dto) {
        const tipo = await this.prisma.socioTipo.create({ data: dto });
        await this.prisma.socioTipoHistorial.create({
            data: {
                socioTipoId: tipo.id,
                monto: dto.montoMensual,
                vigenciaDesde: new Date(),
            },
        });
        return tipo;
    }
    async updateTipo(id, dto) {
        await this.getTipo(id);
        const data = { ...dto };
        if (dto.montoMensual !== undefined) {
            await this.prisma.socioTipoHistorial.create({
                data: {
                    socioTipoId: id,
                    monto: dto.montoMensual,
                    vigenciaDesde: new Date(),
                },
            });
        }
        return this.prisma.socioTipo.update({ where: { id }, data });
    }
    async deleteTipo(id) {
        await this.getTipo(id);
        return this.prisma.socioTipo.update({
            where: { id },
            data: { activo: false },
        });
    }
    async findAll(filters) {
        const where = {};
        if (filters?.estado) {
            where.estado = filters.estado;
        }
        if (filters?.socioTipoId) {
            where.socioTipoId = parseInt(filters.socioTipoId);
        }
        const socios = await this.prisma.socio.findMany({
            where,
            include: {
                socioTipo: { select: { id: true, nombre: true, montoMensual: true, activo: true } },
                cuotas: {
                    select: { montoOriginal: true, montoPagado: true, mes: true, anio: true, estado: true },
                },
            },
            orderBy: { nroSocio: 'asc' },
        });
        const ahora = new Date();
        const anioActual = ahora.getUTCFullYear();
        const mesActual = ahora.getUTCMonth() + 1;
        const result = socios.map((s) => {
            let deudaTotal = s.cuotas.reduce((sum, c) => sum + (Number(c.montoOriginal) - Number(c.montoPagado)), 0);
            if (s.estado === 'ACTIVO' &&
                s.socioTipo.activo &&
                Number(s.socioTipo.montoMensual) > 0) {
                const cuotasExistentes = new Set(s.cuotas.map((c) => `${c.anio}-${c.mes}`));
                const fechaAlta = new Date(s.fechaAlta);
                for (let mes = 1; mes <= 12; mes++) {
                    const key = `${anioActual}-${mes}`;
                    if (cuotasExistentes.has(key))
                        continue;
                    const dia10 = new Date(Date.UTC(anioActual, mes - 1, 10, 12, 0, 0));
                    if (mes < mesActual &&
                        fechaAlta.getTime() <= dia10.getTime() &&
                        ahora.getTime() >= dia10.getTime()) {
                        deudaTotal += Number(s.socioTipo.montoMensual);
                    }
                }
            }
            return {
                id: s.id,
                nroSocio: s.nroSocio,
                dni: s.dni,
                apellido: s.apellido,
                nombre: s.nombre,
                fechaNacimiento: s.fechaNacimiento,
                telefono: s.telefono,
                direccion: s.direccion,
                socioTipo: s.socioTipo,
                fechaAlta: s.fechaAlta,
                estado: s.estado,
                deudaTotal,
            };
        });
        if (filters?.deuda === 'con-deuda') {
            return result.filter((s) => s.deudaTotal > 0);
        }
        if (filters?.deuda === 'al-dia') {
            return result.filter((s) => s.deudaTotal === 0);
        }
        return result;
    }
    async findOne(id) {
        const socio = await this.prisma.socio.findUnique({
            where: { id },
            include: {
                socioTipo: true,
            },
        });
        if (!socio)
            throw new common_1.NotFoundException('Socio no encontrado');
        return socio;
    }
    async create(dto) {
        const existing = await this.prisma.socio.findUnique({
            where: { nroSocio: dto.nroSocio },
        });
        if (existing) {
            throw new common_1.BadRequestException('Ya existe un socio con ese numero');
        }
        await this.getTipo(dto.socioTipoId);
        return this.prisma.socio.create({
            data: {
                nroSocio: dto.nroSocio,
                dni: dto.dni,
                apellido: dto.apellido,
                nombre: dto.nombre,
                fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
                telefono: dto.telefono,
                direccion: dto.direccion,
                socioTipoId: dto.socioTipoId,
                fechaAlta: new Date(dto.fechaAlta),
                estado: dto.estado || 'ACTIVO',
            },
            include: { socioTipo: true },
        });
    }
    async update(id, dto) {
        await this.findOne(id);
        if (dto.nroSocio != null) {
            const existing = await this.prisma.socio.findUnique({
                where: { nroSocio: dto.nroSocio },
            });
            if (existing && existing.id !== id) {
                throw new common_1.BadRequestException('Ya existe un socio con ese numero');
            }
        }
        if (dto.socioTipoId != null) {
            await this.getTipo(dto.socioTipoId);
        }
        const data = { ...dto };
        delete data.socioTipoId;
        if (dto.fechaNacimiento !== undefined) {
            data.fechaNacimiento = dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : null;
        }
        if (dto.fechaAlta !== undefined) {
            data.fechaAlta = dto.fechaAlta ? new Date(dto.fechaAlta) : null;
        }
        if (data.telefono === '')
            data.telefono = null;
        if (data.direccion === '')
            data.direccion = null;
        return this.prisma.socio.update({
            where: { id },
            data: {
                ...data,
                ...(dto.socioTipoId != null ? { socioTipo: { connect: { id: dto.socioTipoId } } } : {}),
            },
            include: { socioTipo: true },
        });
    }
    async deactivate(id) {
        await this.findOne(id);
        return this.prisma.socio.update({
            where: { id },
            data: { estado: 'INACTIVO' },
        });
    }
    async getMontoVigente(socioTipoId, fechaInicioMes) {
        const historial = await this.prisma.socioTipoHistorial.findFirst({
            where: {
                socioTipoId,
                vigenciaDesde: { lte: fechaInicioMes },
            },
            orderBy: { vigenciaDesde: 'desc' },
        });
        if (historial) {
            return Number(historial.monto);
        }
        const tipo = await this.prisma.socioTipo.findUnique({
            where: { id: socioTipoId },
            select: { montoMensual: true },
        });
        return tipo ? Number(tipo.montoMensual) : 0;
    }
    async generateCuotasMes(anio, mes) {
        const primerDia = new Date(Date.UTC(anio, mes - 1, 1, 12, 0, 0));
        const dia10 = new Date(Date.UTC(anio, mes - 1, 10, 12, 0, 0));
        const socios = await this.prisma.socio.findMany({
            where: {
                estado: 'ACTIVO',
                socioTipo: { montoMensual: { gt: 0 }, activo: true },
            },
            include: { socioTipo: true },
        });
        let generadas = 0;
        let omitidas = 0;
        for (const socio of socios) {
            const fechaAlta = new Date(socio.fechaAlta);
            if (fechaAlta > dia10) {
                omitidas++;
                continue;
            }
            const existente = await this.prisma.socioCuota.findUnique({
                where: {
                    socioId_mes_anio: {
                        socioId: socio.id,
                        mes,
                        anio,
                    },
                },
            });
            if (existente) {
                omitidas++;
                continue;
            }
            const montoVigente = await this.getMontoVigente(socio.socioTipoId, primerDia);
            await this.prisma.socioCuota.create({
                data: {
                    socioId: socio.id,
                    mes,
                    anio,
                    montoOriginal: montoVigente,
                    montoPagado: 0,
                    estado: 'PENDIENTE',
                },
            });
            generadas++;
        }
        this.logger.log(`Cuotas generadas: ${generadas} (omitidas: ${omitidas}) para ${mes}/${anio}`);
        return {
            mensaje: `Cuotas generadas: ${generadas}. Omitidas: ${omitidas}`,
            generadas,
            omitidas,
        };
    }
    async generarCuotas(dto) {
        return this.generateCuotasMes(dto.anio, dto.mes);
    }
    async handleGenerarCuotasMensuales() {
        const ahora = new Date();
        const anio = ahora.getUTCFullYear();
        const mes = ahora.getUTCMonth() + 1;
        this.logger.log(`Cron: generando cuotas del mes ${mes}/${anio}...`);
        await this.generateCuotasMes(anio, mes);
    }
    async getCuotasSocio(socioId) {
        await this.findOne(socioId);
        return this.prisma.socioCuota.findMany({
            where: { socioId },
            include: {
                pagos: { orderBy: { fecha: 'desc' } },
            },
            orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
        });
    }
    async pagarCuota(userId, cuotaId, dto) {
        if (dto.monto <= 0) {
            throw new common_1.BadRequestException('El monto debe ser mayor a 0');
        }
        const cuota = await this.prisma.socioCuota.findUnique({
            where: { id: cuotaId },
            include: { socio: true },
        });
        if (!cuota) {
            throw new common_1.NotFoundException('Cuota no encontrada');
        }
        if (cuota.estado === 'PAGADO') {
            throw new common_1.BadRequestException('La cuota ya esta pagada completamente');
        }
        const pendiente = Number(cuota.montoOriginal) - Number(cuota.montoPagado);
        if (dto.monto > pendiente) {
            throw new common_1.BadRequestException(`El monto ingresado (${dto.monto}) supera el saldo pendiente (${pendiente})`);
        }
        const setting = await this.prisma.setting.findFirst();
        if (!setting?.enableAutoJournalSocios) {
            const treasuryAccount = this.prisma.ledgerAccount.findUnique({
                where: { id: dto.treasuryAccountId },
            });
            const nuevoMontoPagado = Number(cuota.montoPagado) + dto.monto;
            let nuevoEstado = 'PENDIENTE';
            if (nuevoMontoPagado >= Number(cuota.montoOriginal) - 0.001) {
                nuevoEstado = 'PAGADO';
            }
            else if (nuevoMontoPagado > 0) {
                nuevoEstado = 'PARCIAL';
            }
            const [year, month, day] = dto.fecha.split('-').map(Number);
            const [cuotaActualizada, pago] = await this.prisma.$transaction([
                this.prisma.socioCuota.update({
                    where: { id: cuotaId },
                    data: { montoPagado: nuevoMontoPagado, estado: nuevoEstado },
                }),
                this.prisma.socioPago.create({
                    data: {
                        socioCuotaId: cuotaId,
                        monto: dto.monto,
                        fecha: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
                        observacion: dto.observacion,
                        treasuryAccountId: dto.treasuryAccountId,
                    },
                }),
            ]);
            return { cuota: cuotaActualizada, pago };
        }
        const treasuryAccount = await this.prisma.ledgerAccount.findUnique({
            where: { id: dto.treasuryAccountId },
        });
        if (!treasuryAccount) {
            throw new common_1.BadRequestException('Cuenta de tesorería no encontrada');
        }
        const cuotasAccount = await this.prisma.ledgerAccount.findUnique({
            where: { code: '4.1.03' },
        });
        if (!cuotasAccount) {
            throw new common_1.BadRequestException('Cuenta contable 4.1.03 no encontrada');
        }
        const nuevoMontoPagado = Number(cuota.montoPagado) + dto.monto;
        let nuevoEstado = 'PENDIENTE';
        if (nuevoMontoPagado >= Number(cuota.montoOriginal) - 0.001) {
            nuevoEstado = 'PAGADO';
        }
        else if (nuevoMontoPagado > 0) {
            nuevoEstado = 'PARCIAL';
        }
        const [year, month, day] = dto.fecha.split('-').map(Number);
        const result = await this.prisma.$transaction(async (tx) => {
            const cuotaActualizada = await tx.socioCuota.update({
                where: { id: cuotaId },
                data: {
                    montoPagado: nuevoMontoPagado,
                    estado: nuevoEstado,
                },
            });
            const pago = await tx.socioPago.create({
                data: {
                    socioCuotaId: cuotaId,
                    monto: dto.monto,
                    fecha: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
                    observacion: dto.observacion,
                },
            });
            const socioName = cuota.socio
                ? `${cuota.socio.nombre} ${cuota.socio.apellido}`
                : `socio #${cuota.socioId}`;
            const entry = await this.journalEntriesService.createAutomatedEntry(tx, userId, {
                date: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
                description: `Pago cuota - ${socioName} - ${cuota.mes}/${cuota.anio}`,
                lines: [
                    { accountId: dto.treasuryAccountId, debit: dto.monto, credit: 0 },
                    { accountId: cuotasAccount.id, debit: 0, credit: dto.monto },
                ],
                sourceType: 'SOCIO_PAGO',
                sourceId: pago.id,
            });
            await tx.socioPago.update({
                where: { id: pago.id },
                data: { journalEntryId: entry.id, treasuryAccountId: dto.treasuryAccountId },
            });
            return { cuota: cuotaActualizada, pago };
        });
        return result;
    }
    async getMatriz(anio) {
        const socios = await this.prisma.socio.findMany({
            include: {
                socioTipo: { select: { id: true, nombre: true, montoMensual: true, activo: true } },
            },
            orderBy: { nroSocio: 'asc' },
        });
        const cuotas = await this.prisma.socioCuota.findMany({
            where: { anio, socioId: { in: socios.map((s) => s.id) } },
        });
        const cuotasPorSocio = {};
        for (const c of cuotas) {
            if (!cuotasPorSocio[c.socioId]) {
                cuotasPorSocio[c.socioId] = {};
            }
            cuotasPorSocio[c.socioId][c.mes] = {
                montoOriginal: Number(c.montoOriginal),
                montoPagado: Number(c.montoPagado),
                estado: c.estado,
                id: c.id,
            };
        }
        const filas = socios.map((s) => {
            const meses = {};
            let deudaAnual = 0;
            for (let mes = 1; mes <= 12; mes++) {
                const cuota = cuotasPorSocio[s.id]?.[mes];
                if (cuota) {
                    const pendiente = cuota.montoOriginal - cuota.montoPagado;
                    deudaAnual += pendiente;
                    meses[mes] = {
                        estado: cuota.estado,
                        pendiente: Math.round(pendiente * 100) / 100,
                        cuotaId: cuota.id,
                    };
                }
                else if (s.estado === 'ACTIVO' && s.socioTipo.activo && Number(s.socioTipo.montoMensual) > 0) {
                    const fechaAlta = new Date(s.fechaAlta);
                    const dia10delMes = new Date(Date.UTC(anio, mes - 1, 10, 12, 0, 0));
                    const ahora = new Date();
                    if (fechaAlta.getTime() > dia10delMes.getTime() || ahora.getTime() < dia10delMes.getTime()) {
                        meses[mes] = { estado: 'NO_APLICA' };
                    }
                    else {
                        meses[mes] = { estado: 'PENDIENTE_SIN_CUOTA', pendiente: Number(s.socioTipo.montoMensual) };
                        deudaAnual += Number(s.socioTipo.montoMensual);
                    }
                }
                else {
                    meses[mes] = { estado: 'NO_APLICA' };
                }
            }
            return {
                socioId: s.id,
                nroSocio: s.nroSocio,
                apellido: s.apellido,
                nombre: s.nombre,
                tipo: s.socioTipo.nombre,
                estadoSocio: s.estado,
                meses,
                deudaAnual: Math.round(deudaAnual * 100) / 100,
            };
        });
        const totalesPorMes = {};
        for (let mes = 1; mes <= 12; mes++) {
            let total = 0;
            for (const f of filas) {
                const m = f.meses[mes];
                if (m && m.pendiente) {
                    total += m.pendiente;
                }
            }
            totalesPorMes[mes] = Math.round(total * 100) / 100;
        }
        return { anio, filas, totalesPorMes };
    }
    async getTesoreríaResumen() {
        const cuotasPendientes = await this.prisma.socioCuota.findMany({
            where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
            select: { montoOriginal: true, montoPagado: true },
        });
        const deudaTotal = cuotasPendientes.reduce((sum, c) => sum + (Number(c.montoOriginal) - Number(c.montoPagado)), 0);
        const sociosActivos = await this.prisma.socio.count({
            where: { estado: 'ACTIVO' },
        });
        const sociosConDeuda = await this.prisma.socio.count({
            where: {
                estado: 'ACTIVO',
                cuotas: {
                    some: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
                },
            },
        });
        return {
            deudaTotal: Math.round(deudaTotal * 100) / 100,
            sociosActivos,
            sociosConDeuda,
        };
    }
    drawCard(doc, cardX, cardY, socio, displayName, accentColor, logoUrl, qrBuffer) {
        const { CARD_W: cardW, CARD_H: cardH } = SociosService_1;
        doc.roundedRect(cardX, cardY, cardW, cardH, 6).fill('#ffffff');
        const stripeW = 8;
        doc.save();
        doc.roundedRect(cardX, cardY, cardW, cardH, 6).clip();
        doc.rect(cardX, cardY, stripeW, cardH).fill(accentColor);
        doc.restore();
        doc.roundedRect(cardX, cardY, cardW, cardH, 6).stroke('#cccccc');
        const marginX = cardX + stripeW + 12;
        const marginY = cardY + 10;
        const contentW = cardW - stripeW - 24;
        const logoSize = 42;
        const headerBottom = marginY + 20;
        doc.strokeColor(accentColor)
            .lineWidth(0.5)
            .moveTo(marginX, headerBottom)
            .lineTo(cardX + cardW - 12, headerBottom)
            .stroke();
        const logoX = cardX + cardW - 12 - logoSize;
        const logoY = marginY;
        if (logoUrl) {
            const logoPath = logoUrl.startsWith('/')
                ? path.join('/data/uploads', logoUrl.replace('/uploads/', ''))
                : logoUrl;
            if (logoPath.startsWith('/data/uploads') && fs.existsSync(logoPath)) {
                try {
                    doc.image(logoPath, logoX, logoY, { fit: [logoSize, logoSize] });
                }
                catch (_) {
                }
            }
        }
        doc.fill(accentColor)
            .fontSize(14)
            .font('Helvetica-Bold')
            .text(displayName.toUpperCase(), marginX, marginY, {
            width: cardW - stripeW - 24 - logoSize - 8,
            align: 'left',
            lineBreak: false,
        });
        const bodyY = headerBottom + 10;
        const nombreCompleto = `${socio.apellido}, ${socio.nombre}`;
        doc.fill('#111111')
            .fontSize(12)
            .font('Helvetica-Bold')
            .text(nombreCompleto, marginX, bodyY, {
            width: contentW,
            align: 'left',
        });
        doc.fill('#333333')
            .fontSize(10)
            .font('Helvetica')
            .text(`Socio Nº ${String(socio.nroSocio).padStart(6, '0')}`, marginX, bodyY + 18, {
            width: contentW,
            align: 'left',
        });
        const fechaAlta = new Date(socio.fechaAlta);
        const fechaAltaStr = `${String(fechaAlta.getUTCDate()).padStart(2, '0')}/${String(fechaAlta.getUTCMonth() + 1).padStart(2, '0')}/${fechaAlta.getUTCFullYear()}`;
        const dniFormateado = socio.dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        const infoY = bodyY + 38;
        const lineH = 14;
        doc.fill('#555555').fontSize(7).font('Helvetica');
        doc.text(`Tipo: ${socio.socioTipo.nombre}`, marginX, infoY);
        doc.text(`DNI: ${dniFormateado}`, marginX, infoY + lineH);
        doc.text(`Socio desde: ${fechaAltaStr}`, marginX, infoY + lineH * 2);
        const footerY = cardY + cardH - 14;
        doc.strokeColor('#dddddd')
            .lineWidth(0.3)
            .moveTo(marginX, footerY - 4)
            .lineTo(cardX + cardW - 12, footerY - 4)
            .stroke();
        doc.fill('#aaaaaa')
            .fontSize(5.5)
            .font('Helvetica')
            .text(displayName, marginX, footerY, {
            width: contentW,
            align: 'center',
        });
        const qrSize = 60;
        const qrX = cardX + cardW - qrSize - 8;
        const qrY = cardY + cardH - qrSize - 8;
        doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });
    }
    async generateCarnetPdf(socioId) {
        const socio = await this.prisma.socio.findUnique({
            where: { id: socioId },
            include: { socioTipo: true },
        });
        if (!socio)
            throw new common_1.NotFoundException('Socio no encontrado');
        const setting = await this.prisma.setting.findUnique({
            where: { id: '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca' },
            select: { logoUrl: true, storeName: true, clubName: true, accentColor: true },
        });
        const displayName = setting?.clubName?.trim() || setting?.storeName || 'Club';
        const accentColor = setting?.accentColor || '#1e3a5f';
        const filename = `credencial-socio-${socio.nroSocio}.pdf`;
        const qrBuffer = await QRCode.toBuffer(socio.uuid, {
            type: 'png',
            width: 120,
            margin: 1,
        });
        const { CARD_W: cardW, CARD_H: cardH } = SociosService_1;
        return new Promise((resolve, reject) => {
            const chunks = [];
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'portrait',
                margin: 0,
            });
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), filename }));
            doc.on('error', reject);
            const pageW = 595.28;
            const cardX = (pageW - cardW) / 2;
            const cardY = 40;
            this.drawCard(doc, cardX, cardY, socio, displayName, accentColor, setting?.logoUrl, qrBuffer);
            doc.end();
        });
    }
    async generateCarnetsPdf(ids) {
        if (!ids || ids.length === 0)
            throw new common_1.BadRequestException('Se requiere al menos un ID de socio');
        const socios = await this.prisma.socio.findMany({
            where: { id: { in: ids } },
            include: { socioTipo: true },
            orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        });
        if (socios.length === 0)
            throw new common_1.NotFoundException('No se encontraron socios con los IDs proporcionados');
        const setting = await this.prisma.setting.findUnique({
            where: { id: '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca' },
            select: { logoUrl: true, storeName: true, clubName: true, accentColor: true },
        });
        const displayName = setting?.clubName?.trim() || setting?.storeName || 'Club';
        const accentColor = setting?.accentColor || '#1e3a5f';
        const logoUrl = setting?.logoUrl || null;
        const qrMap = new Map();
        for (const socio of socios) {
            const qrBuffer = await QRCode.toBuffer(socio.uuid, {
                type: 'png',
                width: 120,
                margin: 1,
            });
            qrMap.set(socio.id, qrBuffer);
        }
        const { CARD_W: cardW, CARD_H: cardH } = SociosService_1;
        const COLS = 2;
        const ROWS = 4;
        const CARDS_PER_PAGE = COLS * ROWS;
        const pageW = 595.28;
        const colGap = 38;
        const rowGap = 46;
        const leftMargin = (pageW - COLS * cardW - colGap) / 2;
        const topMargin = 42;
        return new Promise((resolve, reject) => {
            const chunks = [];
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'portrait',
                margin: 0,
            });
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve({
                buffer: Buffer.concat(chunks),
                filename: `credenciales-${socios.length}-socios.pdf`,
            }));
            doc.on('error', reject);
            for (let i = 0; i < socios.length; i++) {
                const pageIndex = Math.floor(i / CARDS_PER_PAGE);
                const slotInPage = i % CARDS_PER_PAGE;
                const col = slotInPage % COLS;
                const row = Math.floor(slotInPage / COLS);
                const cardX = leftMargin + col * (cardW + colGap);
                const cardY = topMargin + row * (cardH + rowGap);
                if (slotInPage === 0 && i > 0) {
                    doc.addPage();
                }
                const socio = socios[i];
                const qrBuffer = qrMap.get(socio.id);
                this.drawCard(doc, cardX, cardY, socio, displayName, accentColor, logoUrl, qrBuffer);
            }
            doc.end();
        });
    }
};
exports.SociosService = SociosService;
SociosService.CARD_W = 242.65;
SociosService.CARD_H = 153.07;
__decorate([
    (0, schedule_1.Cron)('0 5 0 1 * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SociosService.prototype, "handleGenerarCuotasMensuales", null);
exports.SociosService = SociosService = SociosService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        journal_entries_service_1.JournalEntriesService])
], SociosService);
