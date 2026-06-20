import { Review } from '../../../src/domain/review/Review';
import { StockReservation } from '../../../src/domain/stock/StockReservation';
import { slugify } from '../../../src/domain/shared/Pagination';

describe('Domain entities', () => {
  describe('Review', () => {
    it('should create review with valid rating', () => {
      const review = Review.create({
        id: 1,
        productId: 1,
        userId: 1,
        rating: 5,
        comment: 'Great product',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(review.rating).toBe(5);
    });

    it('should reject invalid rating', () => {
      expect(() =>
        Review.create({
          id: 1,
          productId: 1,
          userId: 1,
          rating: 6,
          comment: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow('Rating must be between 1 and 5');
    });
  });

  describe('StockReservation', () => {
    it('should detect expired reservations', () => {
      const reservation = StockReservation.create({
        id: 1,
        productId: 1,
        orderId: 'order-1',
        quantity: 2,
        expiresAt: new Date(Date.now() - 1000),
        status: 'ACTIVE',
        createdAt: new Date(),
      });
      expect(reservation.isExpired()).toBe(true);
    });
  });

  describe('slugify', () => {
    it('should convert names to URL-friendly slugs', () => {
      expect(slugify('Wireless Headphones')).toBe('wireless-headphones');
      expect(slugify('Home & Garden')).toBe('home-garden');
    });
  });
});
