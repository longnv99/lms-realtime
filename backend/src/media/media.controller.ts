import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { ListMediaAssetsQueryDto } from './dto/list-media-assets-query.dto';
import { MediaService } from './media.service';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('uploads')
  createUpload(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUploadDto) {
    return this.mediaService.createUpload(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('uploads/:id/complete')
  completeUpload(@Param('id') id: string, @Body() _dto: CompleteUploadDto) {
    return this.mediaService.completeUpload(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'INSTRUCTOR')
  @Get('assets')
  listAssets(@CurrentUser() user: AuthenticatedUser, @Query() query: ListMediaAssetsQueryDto) {
    return this.mediaService.listAssets(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'INSTRUCTOR')
  @Delete('assets/:id')
  deleteAsset(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.mediaService.deleteAsset(user, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('assets/:id/playback')
  createPlayback(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.mediaService.createPlayback(user, id);
  }
}
