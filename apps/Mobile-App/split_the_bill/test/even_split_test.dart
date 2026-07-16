import 'package:flutter_test/flutter_test.dart';
import 'package:equishare/utils/even_split.dart';

void main() {
  group('areShareAmountsEvenlySplit', () {
    test('returns true when shares differ by at most one cent', () {
      expect(areShareAmountsEvenlySplit([333, 333, 334]), isTrue);
      expect(areShareAmountsEvenlySplit([500, 500]), isTrue);
    });

    test('returns false when shares differ by more than one cent', () {
      expect(areShareAmountsEvenlySplit([333, 335]), isFalse);
      expect(areShareAmountsEvenlySplit([100, 200, 300]), isFalse);
    });

    test('returns false for fewer than two participants or zero amounts', () {
      expect(areShareAmountsEvenlySplit([500]), isFalse);
      expect(areShareAmountsEvenlySplit([0, 0]), isFalse);
      expect(areShareAmountsEvenlySplit([333, 0, 334]), isFalse);
    });

    test('includes payer share when checking even split', () {
      // $10.00 split three ways: payer gets 334¢, friends get 333¢ each.
      expect(areShareAmountsEvenlySplit([334, 333, 333]), isTrue);
      // Same split with payer in the middle.
      expect(areShareAmountsEvenlySplit([333, 334, 333]), isTrue);
    });
  });
}
