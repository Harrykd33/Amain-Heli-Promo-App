import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
test('database restricts membership and prevents stale saves',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
  GRANT USAGE ON SCHEMA auth TO anon,authenticated;
  GRANT EXECUTE ON FUNCTION auth.jwt() TO anon,authenticated;`);
  const schema=await readFile(new URL('../supabase/01-schema.sql',import.meta.url),'utf8');
  // Recover a partially completed setup where only the first table exists.
  await db.exec('CREATE TABLE public.team_members(email text PRIMARY KEY CHECK(email=lower(email)), added_at timestamptz NOT NULL DEFAULT now())');
  await db.exec(schema);
  const seed=await readFile(new URL('../supabase/02-import-workbook.sql',import.meta.url),'utf8');await db.exec(seed);await db.exec(seed);
  assert.equal((await db.query('select count(*)::int as count from products')).rows[0].count,6);
  assert.equal((await db.query('select count(*)::int as count from manufacturers')).rows[0].count,33);
  await db.query("update products set notes='Preserve this edit' where id='import-5'");
  await db.exec(schema);await db.exec(seed);
  assert.equal((await db.query("select notes from products where id='import-5'")).rows[0].notes,'Preserve this edit');
  assert.equal((await db.query('select count(*)::int as count from products')).rows[0].count,6);
  // Restore the revision expected below without changing the save trigger.
  await db.exec("ALTER TABLE products DISABLE TRIGGER product_update_stamp; UPDATE products SET revision=1 WHERE id='import-5'; ALTER TABLE products ENABLE TRIGGER product_update_stamp;");
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query('select * from products'),/permission denied/);
  await db.exec('RESET ROLE; SET ROLE authenticated');
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({email:'outsider@example.com'})]);
  assert.equal((await db.query('select * from products')).rows.length,0);
  await assert.rejects(db.query("insert into products(manufacturer,product) values('Brand','Unauthorized')"),/row-level security/);
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({email:'kevndrc@gmail.com'})]);
  assert.equal((await db.query('select * from products')).rows.length,6);
  assert.deepEqual((await db.query('select email from team_members')).rows,[{email:'kevndrc@gmail.com'}]);
  await assert.rejects(db.query("insert into team_members(email) values('outsider@example.com')"),/permission denied/);
  const first=await db.query("update products set notes='First save',revision=999,updated_by='spoofed' where id='import-5' and revision=1 returning *");
  assert.equal(first.rows[0].revision,2);assert.equal(first.rows[0].updated_by,'kevndrc@gmail.com');
  const stale=await db.query("update products set notes='Stale overwrite' where id='import-5' and revision=1 returning id");assert.equal(stale.rows.length,0);
  await db.query("insert into products(manufacturer,product,eta) values('New Brand','New Product',null)");
  await assert.rejects(db.query("delete from products where id='import-5'"),/permission denied/);
  await db.exec('RESET ROLE');await db.query("delete from team_members where email='kevndrc@gmail.com'");await db.exec('SET ROLE authenticated');
  assert.equal((await db.query('select * from products')).rows.length,0);
 }finally{await db.close();}
});
