/**
 * Upsert site categories from DEFAULT_CATEGORIES (names + order).
 * Usage: node scripts/syncCategories.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { DEFAULT_CATEGORIES } from '../config/constants.js';

await mongoose.connect(process.env.MONGODB_URI);

let created = 0;
let updated = 0;

const MAIN_SLUGS = new Set(DEFAULT_CATEGORIES.filter((c) => c.order < 90).map((c) => c.slug));

for (const cat of DEFAULT_CATEGORIES) {
  const showInHeader = cat.order < 90;
  const existing = await Category.findOne({ slug: cat.slug });
  if (existing) {
    existing.name = cat.name;
    existing.nameTamil = cat.nameTamil;
    existing.order = cat.order;
    existing.status = 'active';
    existing.showInHeader = showInHeader;
    // Keep district as district parent flag
    if (cat.slug === 'district') {
      existing.isDistrict = false; // parent hub, not a TN district child
    }
    await existing.save();
    updated += 1;
    console.log(`updated: ${cat.slug} (${cat.nameTamil}) order=${cat.order} header=${showInHeader}`);
  } else {
    await Category.create({
      ...cat,
      status: 'active',
      isDistrict: false,
      showInHeader,
    });
    created += 1;
    console.log(`created: ${cat.slug} (${cat.nameTamil}) order=${cat.order} header=${showInHeader}`);
  }
}

// District children + other leftovers: hide from header by default
const headerOff = await Category.updateMany(
  {
    $or: [{ isDistrict: true }, { slug: { $nin: [...MAIN_SLUGS] } }],
    showInHeader: { $ne: false },
  },
  { $set: { showInHeader: false } }
);
console.log(`header hidden for other/district rows: ${headerOff.modifiedCount}`);

console.log(`\nDone. created=${created} updated=${updated}`);
await mongoose.disconnect();
