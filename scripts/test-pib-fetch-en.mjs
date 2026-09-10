import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchFromSource } from '../services/governmentFetchService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const source = {
  name: 'Press Information Bureau (PIB)',
  level: 'central',
  department: 'Press Information Bureau',
  feedUrl: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3',
  websiteUrl: 'https://pib.gov.in',
  category: 'announcement',
  language: 'en',
  keywords: [],
};

console.log('Fetching PIB English (first 3)...');
const { items } = await fetchFromSource(source, [], 3);
items.forEach((item, i) => {
  console.log(i + 1, item.title.slice(0, 90));
  console.log('   ', item.officialUrl);
});
