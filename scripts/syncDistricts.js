/**
 * Upsert all Tamil Nadu districts as Category rows (isDistrict: true).
 * Usage: node scripts/syncDistricts.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { TAMIL_NADU_DISTRICTS } from '../config/constants.js';

await mongoose.connect(process.env.MONGODB_URI);

let parent = await Category.findOne({ slug: 'district' });
if (!parent) {
  parent = await Category.create({
    name: 'District',
    nameTamil: 'மாவட்டம்',
    slug: 'district',
    order: 1,
    status: 'active',
    showInHeader: true,
    isDistrict: false,
  });
  console.log('created parent: district');
}

let created = 0;
let updated = 0;

for (let i = 0; i < TAMIL_NADU_DISTRICTS.length; i++) {
  const d = TAMIL_NADU_DISTRICTS[i];
  const order = i + 1;
  const existing = await Category.findOne({ slug: d.slug });

  if (existing) {
    existing.name = d.name;
    existing.nameTamil = d.nameTamil;
    existing.isDistrict = true;
    existing.parent = parent._id;
    existing.order = order;
    existing.status = 'active';
    // Keep header visibility for Chennai main nav; hide other districts
    if (d.slug !== 'chennai') existing.showInHeader = false;
    await existing.save();
    updated += 1;
    console.log(`updated: ${d.slug} (${d.nameTamil})`);
  } else {
    await Category.create({
      name: d.name,
      nameTamil: d.nameTamil,
      slug: d.slug,
      isDistrict: true,
      parent: parent._id,
      order,
      status: 'active',
      showInHeader: false,
    });
    created += 1;
    console.log(`created: ${d.slug} (${d.nameTamil})`);
  }
}

console.log(`\nDone. districts=${TAMIL_NADU_DISTRICTS.length} created=${created} updated=${updated}`);
await mongoose.disconnect();
