import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class SociosQrService {
  constructor(private prisma: PrismaService) {}

  async resolve(uuid: string) {
    const socio = await this.prisma.socio.findUnique({
      where: { uuid },
      include: { socioTipo: { select: { nombre: true } } },
    });

    if (!socio) {
      return null;
    }

    let estado: 'AL_DIA' | 'ATRASADO' | 'INACTIVO' | 'SUSPENDIDO';

    if (socio.estado === 'INACTIVO') {
      estado = 'INACTIVO';
    } else if (socio.estado === 'SUSPENDIDO') {
      estado = 'SUSPENDIDO';
    } else {
      const ahora = new Date();
      const anioActual = ahora.getUTCFullYear();
      const mesActual = ahora.getUTCMonth() + 1;

      const cuotasAtrasadas = await this.prisma.socioCuota.findMany({
        where: {
          socioId: socio.id,
          estado: { in: ['PENDIENTE', 'PARCIAL'] },
          OR: [
            { anio: { lt: anioActual } },
            { anio: anioActual, mes: { lt: mesActual } },
          ],
        },
        select: { id: true },
      });

      estado = cuotasAtrasadas.length > 0 ? 'ATRASADO' : 'AL_DIA';
    }

    let beneficios: any[] = [];

    if (estado === 'AL_DIA') {
      const beneficiosActivos = await this.prisma.socioBeneficio.findMany({
        where: { socioTipoId: socio.socioTipoId, activo: true },
        include: {
          categoria: { select: { id: true, name: true } },
          producto: { select: { id: true, name: true } },
        },
      });

      const hoyInicio = new Date();
      hoyInicio.setUTCHours(3, 0, 0, 0);

      beneficios = await Promise.all(
        beneficiosActivos.map(async (b) => {
          let disponible = true;
          let motivoNoDisponible: string | null = null;

          if (b.limiteDiario) {
            const canjesHoy = await this.prisma.socioCanje.count({
              where: {
                socioBeneficioId: b.id,
                socioId: socio.id,
                fecha: { gte: hoyInicio },
              },
            });
            if (canjesHoy >= b.limiteDiario) {
              disponible = false;
              motivoNoDisponible = 'Ya canjeado hoy';
            }
          }

          return {
            id: b.id,
            categoriaId: b.categoria?.id || null,
            categoriaNombre: b.categoria?.name || null,
            productoId: b.producto?.id || null,
            productoNombre: b.producto?.name || null,
            porcentaje: Number(b.porcentaje),
            descuentoMaximo: b.descuentoMaximo ? Number(b.descuentoMaximo) : null,
            disponible,
            motivoNoDisponible,
          };
        }),
      );
    }

    return {
      socio: {
        nombre: `${socio.apellido}, ${socio.nombre}`,
        nroSocio: socio.nroSocio,
        tipo: socio.socioTipo.nombre,
      },
      estado,
      beneficios,
    };
  }
}
