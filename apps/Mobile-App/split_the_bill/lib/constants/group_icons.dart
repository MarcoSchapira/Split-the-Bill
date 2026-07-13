import 'package:flutter/material.dart';

const groupIconKeys = [
  'home',
  'trip',
  'food',
  'groceries',
  'rent',
  'utilities',
  'entertainment',
  'sports',
  'pets',
  'family',
  'work',
  'other',
];

const defaultGroupIconKey = 'other';

IconData groupIconForKey(String iconKey) {
  return switch (iconKey) {
    'home' => Icons.home_outlined,
    'trip' => Icons.flight_outlined,
    'food' => Icons.restaurant_outlined,
    'groceries' => Icons.shopping_cart_outlined,
    'rent' => Icons.apartment_outlined,
    'utilities' => Icons.bolt_outlined,
    'entertainment' => Icons.movie_outlined,
    'sports' => Icons.sports_soccer_outlined,
    'pets' => Icons.pets_outlined,
    'family' => Icons.family_restroom_outlined,
    'work' => Icons.work_outline,
    _ => Icons.groups_outlined,
  };
}

bool isGroupIconKey(String value) => groupIconKeys.contains(value);
