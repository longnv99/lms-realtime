import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { MediaService } from './media.service';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('uploads')
  createUpload(@Body() dto: CreateUploadDto) {
    return this.mediaService.createUpload(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('uploads/:id/complete')
  completeUpload(@Param('id') id: string, @Body() _dto: CompleteUploadDto) {
    return this.mediaService.completeUpload(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('assets/:id/playback')
  createPlayback(@Param('id') id: string) {
    return this.mediaService.createPlayback(id);
  }
}
