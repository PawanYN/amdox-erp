import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('scm/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post()
  create(@Req() req: any, @Body() createProductDto: CreateProductDto) {
    return this.productService.create(req.user.tenantId, createProductDto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get()
  findAll(@Req() req: any) {
    return this.productService.findAll(req.user.tenantId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.productService.findOne(req.user.tenantId, id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(req.user.tenantId, id, updateProductDto);
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.productService.remove(req.user.tenantId, id);
  }
}
