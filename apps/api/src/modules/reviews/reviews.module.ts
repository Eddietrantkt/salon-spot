import { Module } from '@nestjs/common';
import { ProfessionalsModule } from '../professionals/professionals.module.js';
import { ReviewsService } from './application/reviews.service.js';
import { BookingReviewsController, PublicSalonReviewsController } from './presentation/reviews.controller.js';

@Module({
  imports: [ProfessionalsModule],
  controllers: [BookingReviewsController, PublicSalonReviewsController],
  providers: [ReviewsService]
})
export class ReviewsModule {}
