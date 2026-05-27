import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:clippy/app.dart';

void main() {
  testWidgets('App boots', (WidgetTester tester) async {
    await tester.pumpWidget(const ClippyApp());
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
