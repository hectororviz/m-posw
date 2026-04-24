import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Express } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '../common/upload.constants';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { mapIngredients, mapProduct, mapProducts } from './product.mapper';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async listActive(@Query('categoryId') categoryId?: string) {
    const products = await this.productsService.listActive(categoryId);
    return mapProducts(products);
  }

  @Get('raw-materials')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async listRawMaterials() {
    const products = await this.productsService.listRawMaterials();
    return mapProducts(products);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async listAll() {
    const products = await this.productsService.listAll();
    return products.map(product => ({
      ...mapProduct(product),
      recipeIngredients: product.recipeAsComposite?.length > 0
        ? mapIngredients(product.recipeAsComposite.map(ri => ({
            ...ri,
            rawMaterial: mapProduct(ri.rawMaterial),
          })))
        : undefined,
    }));
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateProductDto) {
    const product = await this.productsService.create(dto);
    return {
      ...mapProduct(product),
      recipeIngredients: product.recipeAsComposite?.length > 0
        ? mapIngredients(product.recipeAsComposite.map(ri => ({
            ...ri,
            rawMaterial: mapProduct(ri.rawMaterial),
          })))
        : undefined,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    const product = await this.productsService.update(id, dto);
    return {
      ...mapProduct(product),
      recipeIngredients: product.recipeAsComposite?.length > 0
        ? mapIngredients(product.recipeAsComposite.map(ri => ({
            ...ri,
            rawMaterial: mapProduct(ri.rawMaterial),
          })))
        : undefined,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req: unknown, file: Express.Multer.File, cb) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
          cb(new BadRequestException('Tipo de archivo inválido'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Imagen requerida');
    }
    return this.productsService.uploadImage(id, file).then(mapProduct);
  }

  @Delete(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteImage(@Param('id') id: string) {
    const product = await this.productsService.deleteImage(id);
    return mapProduct(product);
  }
}
