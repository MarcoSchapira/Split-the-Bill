import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:equisplit/app.dart';

void main() {
  testWidgets('shows session restore loading', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: EquiSplitApp()));
    expect(find.text('Restoring your session...'), findsOneWidget);
  });
}
