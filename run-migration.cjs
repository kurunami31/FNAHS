const { Client } = require('pg');
const client = new Client({ 
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.roorltaytdaktlpygqwv',
  password: 'fnahsdorsu2026',
});

client.connect()
  .then(() => client.query(`
    UPDATE profiles SET positions = '{}' WHERE email = 'dms.prime3101@gmail.com';
  `))
  .then(() => { console.log('SUCCESS: Position cleared'); client.end(); })
  .catch(e => { console.error('ERROR:', e.message); client.end(); process.exit(1); });