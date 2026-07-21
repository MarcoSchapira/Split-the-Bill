import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:billcompass/constants/group_icons.dart';

void main() {
  test('group icon keys map to icons', () {
    expect(groupIconKeys.length, 12);
    for (final key in groupIconKeys) {
      expect(groupIconForKey(key), isA<IconData>());
    }
    expect(groupIconForKey('unknown'), Icons.groups_outlined);
  });
}
