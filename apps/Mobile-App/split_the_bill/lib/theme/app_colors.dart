import 'package:flutter/material.dart';

abstract final class AppColors {
  static const text = Color(0xFF64716E);
  static const textH = Color(0xFF112824);
  static const bg = Color(0xFFF7F8F4);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF3F5F1);
  static const border = Color(0xFFE0E6DF);
  static const accent = Color(0xFF0E9375);
  static const accentSoft = Color(0xFFDBF3EC);
  static const brandSoft = Color(0xFF8BE0CA);
  static const error = Color(0xFFAF3939);
  static const errorBg = Color(0xFFFFF3F1);
  static const errorBorder = Color(0xFFF1D0CA);
  static const pendingBg = Color(0xFFFFF4DB);
  static const pendingText = Color(0xFF956500);
  static const modalBackdrop = Color(0x52112824);

  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF102F2D), Color(0xFF0D554C), Color(0xFF0B745D)],
    stops: [0.0, 0.58, 1.0],
  );
}
