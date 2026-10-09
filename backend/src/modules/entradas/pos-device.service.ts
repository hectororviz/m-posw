import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ModuleAccess, ModuleKey, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';

const POS_TERMINAL_USERNAME = 'pos-terminal';

/**
 * Resuelve el usuario genérico al que se atribuyen las ventas de
 * terminales POS (auth por token de dispositivo, sin JWT).
 * Se auto-repara: si falta el usuario o el vínculo en Setting
 * (instancia nueva sin seed), lo crea al arrancar y ante cada
 * resolución. La reactivación también es automática.
 */
@Injectable()
export class PosDeviceService implements OnModuleInit {
  private readonly logger = new Logger(PosDeviceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensurePosTerminalUser();
    } catch (error) {
      this.logger.warn(`pos-terminal no pudo asegurarse al arrancar: ${error}`);
    }
  }

  async resolvePosUserId(): Promise<string> {
    const setting = await this.prisma.setting.findFirst({
      select: { id: true, posDeviceUserId: true },
    });
    const userId = setting?.posDeviceUserId ?? null;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, active: true },
      });
      if (user?.active) return user.id;
      this.logger.warn(`posDeviceUserId=${userId} inexistente o inactivo, reasegurando`);
    }
    try {
      return await this.ensurePosTerminalUser();
    } catch (error) {
      this.logger.warn(`No se pudo asegurar pos-terminal: ${error}`);
      throw new ServiceUnavailableException({
        code: 'POS_USER_NOT_CONFIGURED',
        message: 'Terminal POS sin usuario atribuido',
      });
    }
  }

  /**
   * Idempotente: crea/reactiva el usuario genérico, le asegura el
   * permiso POS FULL y vincula Setting.posDeviceUserId. Ante carreras
   * (dos terminales en instancia fresca) el P2002 se resuelve releyendo.
   */
  async ensurePosTerminalUser(): Promise<string> {
    let user = await this.prisma.user.findUnique({
      where: { username: POS_TERMINAL_USERNAME },
      select: { id: true, active: true },
    });
    if (!user) {
      try {
        const password = await bcrypt.hash(`${POS_TERMINAL_USERNAME}:${randomUUID()}`, 10);
        user = await this.prisma.user.create({
          data: { username: POS_TERMINAL_USERNAME, password, role: Role.USER, active: true },
          select: { id: true, active: true },
        });
        this.logger.log('Usuario genérico "pos-terminal" creado automáticamente.');
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          user = await this.prisma.user.findUnique({
            where: { username: POS_TERMINAL_USERNAME },
            select: { id: true, active: true },
          });
        } else {
          throw error;
        }
      }
    }
    if (!user) {
      throw new Error('No se pudo crear ni leer el usuario pos-terminal');
    }
    if (!user.active) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { active: true },
        select: { id: true, active: true },
      });
      this.logger.warn('Usuario "pos-terminal" reactivado automáticamente.');
    }
    await this.prisma.userModulePermission.upsert({
      where: { userId_module: { userId: user.id, module: ModuleKey.POS } },
      create: { userId: user.id, module: ModuleKey.POS, access: ModuleAccess.FULL },
      update: { access: ModuleAccess.FULL },
    });
    const setting = await this.prisma.setting.findFirst({
      select: { id: true, posDeviceUserId: true },
    });
    if (!setting) {
      await this.prisma.setting.create({
        data: { storeName: 'Mi Tienda', posDeviceUserId: user.id },
      });
    } else if (setting.posDeviceUserId !== user.id) {
      await this.prisma.setting.update({
        where: { id: setting.id },
        data: { posDeviceUserId: user.id },
      });
    }
    // Por si hay filas Setting duplicadas (instancias viejas): que ninguna
    // quede sin vínculo, porque findFirst() sin orden es arbitrario.
    await this.prisma.setting.updateMany({
      where: { posDeviceUserId: null },
      data: { posDeviceUserId: user.id },
    });
    return user.id;
  }
}
