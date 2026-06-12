import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

const INTERNET_CATEGORY_ICON = 'wifi';
const INTERNET_CATEGORY_COLOR = '#0ea5e9';

@Injectable()
export class InternetPlansService {
  private readonly logger = new Logger(InternetPlansService.name);

  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.internetPlan.findMany({
      include: { product: { include: { category: true } } },
      orderBy: { position: 'asc' },
    });
  }

  async findById(id: string) {
    const plan = await this.prisma.internetPlan.findUnique({
      where: { id },
      include: { product: { include: { category: true } } },
    });
    if (!plan) throw new NotFoundException('Plan de internet no encontrado');
    return plan;
  }

  async create(dto: CreatePlanDto) {
    const category = await this.ensureInternetCategory();

    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          price: dto.price,
          stock: 0,
          type: 'SIMPLE',
          active: true,
          categoryId: category.id,
          iconName: INTERNET_CATEGORY_ICON,
          colorHex: INTERNET_CATEGORY_COLOR,
        },
      });

      const plan = await tx.internetPlan.create({
        data: {
          name: dto.name,
          duration: dto.duration,
          idleTimeout: dto.idleTimeout ?? 1800,
          downloadBandwidth: dto.downloadBandwidth ?? '10M',
          uploadBandwidth: dto.uploadBandwidth ?? '2M',
          price: dto.price,
          position: dto.position ?? 0,
          productId: product.id,
          categoryId: category.id,
        },
        include: { product: { include: { category: true } } },
      });

      return plan;
    });

    this.logger.log(`Plan creado: ${dto.name} (${dto.duration}s, $${dto.price})`);
    return result;
  }

  async update(id: string, dto: UpdatePlanDto) {
    const existing = await this.findById(id);

    const result = await this.prisma.$transaction(async (tx) => {
      if (existing.productId) {
        const productUpdate: Record<string, unknown> = {};
        if (dto.name !== undefined) productUpdate.name = dto.name;
        if (dto.price !== undefined) productUpdate.price = dto.price;
        if (dto.active !== undefined) productUpdate.active = dto.active;
        if (Object.keys(productUpdate).length > 0) {
          await tx.product.update({
            where: { id: existing.productId },
            data: productUpdate,
          });
        }
      }

      const plan = await tx.internetPlan.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
          ...(dto.idleTimeout !== undefined ? { idleTimeout: dto.idleTimeout } : {}),
          ...(dto.downloadBandwidth !== undefined ? { downloadBandwidth: dto.downloadBandwidth } : {}),
          ...(dto.uploadBandwidth !== undefined ? { uploadBandwidth: dto.uploadBandwidth } : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.position !== undefined ? { position: dto.position } : {}),
        },
        include: { product: { include: { category: true } } },
      });

      return plan;
    });

    this.logger.log(`Plan actualizado: ${id}`);
    return result;
  }

  async remove(id: string) {
    const plan = await this.findById(id);

    await this.prisma.$transaction(async (tx) => {
      if (plan.productId) {
        await tx.product.delete({ where: { id: plan.productId } });
      }
      await tx.internetPlan.delete({ where: { id } });
    });

    this.logger.log(`Plan eliminado: ${plan.name} (${id})`);
    return { deleted: true };
  }

  async syncProducts() {
    const plans = await this.prisma.internetPlan.findMany({
      where: { productId: null },
    });

    if (plans.length === 0) return;

    const category = await this.ensureInternetCategory();

    for (const plan of plans) {
      const product = await this.prisma.product.create({
        data: {
          name: plan.name,
          price: plan.price,
          stock: 0,
          type: 'SIMPLE',
          active: plan.active,
          categoryId: category.id,
        },
      });

      await this.prisma.internetPlan.update({
        where: { id: plan.id },
        data: { productId: product.id, categoryId: category.id },
      });

      this.logger.log(`Producto auto-creado para plan: ${plan.name}`);
    }
  }

  async findPlanByProductId(productId: string) {
    return this.prisma.internetPlan.findFirst({
      where: { productId, active: true },
    });
  }

  private async ensureInternetCategory() {
    const plans = await this.prisma.internetPlan.findFirst({
      where: { categoryId: { not: null } },
      select: { categoryId: true },
    });

    if (plans?.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: plans.categoryId } });
      if (cat) return cat;
    }

    const existing = await this.prisma.category.findFirst({
      where: { name: 'Internet' },
    });

    if (existing) return existing;

    return this.prisma.category.create({
      data: {
        name: 'Internet',
        iconName: INTERNET_CATEGORY_ICON,
        colorHex: INTERNET_CATEGORY_COLOR,
        active: true,
        ticket: true,
      },
    });
  }
}
