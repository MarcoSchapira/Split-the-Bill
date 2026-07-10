/// Returns true when at least two positive shares differ by at most
/// [toleranceCents] (default 1 cent), e.g. 333¢ and 334¢ for a $10.00 bill
/// split three ways.
bool areShareAmountsEvenlySplit(
  Iterable<int> shareCents, {
  int toleranceCents = 1,
}) {
  final amounts = shareCents.toList();
  if (amounts.length < 2) return false;
  if (amounts.any((amount) => amount <= 0)) return false;

  final min = amounts.reduce((a, b) => a < b ? a : b);
  final max = amounts.reduce((a, b) => a > b ? a : b);
  return max - min <= toleranceCents;
}
