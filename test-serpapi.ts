import 'dotenv/config';
import axios from 'axios';

const key = process.env.SERPAPI_KEY;
console.log('SERPAPI_KEY:', key ? 'SET' : 'MISSING');

console.time('api');
const res = await axios.get('https://serpapi.com/search', {
  params: {
    engine: 'google',
    q: 'site:cttrain.co.za train schedule Cape Town',
    api_key: key,
    num: 5,
  },
  timeout: 10000,
});
console.timeEnd('api');

const results = res.data?.organic_results ?? [];
console.log('Total organic results:', results.length);
results.forEach((r: any, i: number) => {
  console.log('\n--- Result', i + 1, '---');
  console.log('Title:', r.title);
  console.log('Link:', r.link);
  console.log('Snippet:', r.snippet);
});
