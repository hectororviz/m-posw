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

    return {
      socio: {
        nombre: `${socio.apellido}, ${socio.nombre}`,
        nroSocio: socio.nroSocio,
        tipo: socio.socioTipo.nombre,
      },
      estado,
      beneficios: [],
    };
  }
}
