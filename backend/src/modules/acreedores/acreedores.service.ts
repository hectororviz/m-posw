import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateAcreedorDto } from './dto/create-acreedor.dto';
import { UpdateAcreedorDto } from './dto/update-acreedor.dto';
import { CreatePagoDto } from './dto/create-pago.dto';

@Injectable()
export class AcreedoresService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.acreedor.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number) {
    const acreedor = await this.prisma.acreedor.findUnique({ where: { id } });
    if (!acreedor) {
      throw new NotFoundException('Acreedor no encontrado');
    }
    return acreedor;
  }

  create(dto: CreateAcreedorDto) {
    return this.prisma.acreedor.create({ data: dto });
  }

  async update(id: number, dto: UpdateAcreedorDto) {
    await this.findOne(id);
    return this.prisma.acreedor.update({
      where: { id },
      data: dto,
    });
  }

  async toggleActive(id: number) {
    const acreedor = await this.findOne(id);
    return this.prisma.acreedor.update({
      where: { id },
      data: { activo: !acreedor.activo },
    });
  }

  async getDeuda(id: number) {
    await this.findOne(id);

    const fiadoVentas = await this.prisma.fiadoVenta.findMany({
      where: { acreedorId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, monto: true, createdAt: true, ventaId: true },
    });

    const pagos = await this.prisma.pagoAcreedor.findMany({
      where: { acreedorId: id },
      orderBy: { fecha: 'desc' },
      select: { id: true, monto: true, medioPago: true, fecha: true, notas: true },
    });

    const totalFiado = fiadoVentas.reduce((sum, fv) => sum + Number(fv.monto), 0);
    const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto), 0);
    const saldoPendiente = totalFiado - totalPagado;

    return { fiadoVentas, pagos, totalFiado, totalPagado, saldoPendiente };
  }

  async addPago(acreedorId: number, dto: CreatePagoDto) {
    await this.findOne(acreedorId);

    if (dto.monto <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    return this.prisma.pagoAcreedor.create({
      data: {
        acreedorId,
        monto: dto.monto,
        medioPago: dto.medioPago,
        fecha: new Date(dto.fecha),
        notas: dto.notas,
      },
    });
  }
}
