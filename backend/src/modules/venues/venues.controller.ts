import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CreateVenueTemplateDto, UpdateVenueTemplateDto } from './dto/venue.dto';

@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  create(@Body() dto: CreateVenueTemplateDto, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.venuesService.create(dto, userId);
  }

  @Get()
  findAll(@Query('public') isPublic?: string) {
    const publicFilter = isPublic === 'true' ? true : isPublic === 'false' ? false : undefined;
    return this.venuesService.findAll(publicFilter);
  }

  @Get('marketplace')
  getMarketplace() {
    return this.venuesService.findAll(true);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.venuesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVenueTemplateDto) {
    return this.venuesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.venuesService.delete(id);
  }

  @Post(':id/use')
  incrementUsage(@Param('id') id: string) {
    return this.venuesService.incrementUsage(id);
  }
}
