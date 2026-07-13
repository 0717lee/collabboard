begin;

create or replace function pg_temp.assert_true(value boolean, message text)
returns void
language plpgsql
as $$
begin
  if value is not true then
    raise exception 'assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.exec_affected(statement text)
returns bigint
language plpgsql
as $$
declare
  affected bigint;
begin
  execute statement;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function pg_temp.expect_denied(statement text, message text)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception
    when insufficient_privilege then
      return;
  end;
  raise exception 'assertion failed: expected permission denial for %', message;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000001', 'owner@example.com', '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', 'editor@example.com', '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000003', 'viewer@example.com', '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000004', 'public-editor@example.com', '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000005', 'other-owner@example.com', '{}'::jsonb);

insert into public.boards (id, name, owner_id, data, public_role)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Private shared board',
    '00000000-0000-4000-8000-000000000001',
    '{"objects":[]}'::jsonb,
    null
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Public editor board',
    '00000000-0000-4000-8000-000000000005',
    '{"objects":[]}'::jsonb,
    'editor'
  );

insert into public.shared_boards (board_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'editor'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    'viewer'
  );

set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.boards where id = '10000000-0000-4000-8000-000000000001'),
  'shared editor can read a board without recursive RLS'
);
select pg_temp.assert_true(
  pg_temp.exec_affected(
    'update public.boards set name = ''Edited'' where id = ''10000000-0000-4000-8000-000000000001'''
  ) = 1,
  'shared editor can update normal board content'
);
select pg_temp.expect_denied(
  'update public.boards set public_role = ''viewer'' where id = ''10000000-0000-4000-8000-000000000001''',
  'shared editor public_role escalation'
);
select pg_temp.expect_denied(
  'update public.boards set owner_id = ''00000000-0000-4000-8000-000000000002'' where id = ''10000000-0000-4000-8000-000000000001''',
  'shared editor owner_id escalation'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.boards where id = '10000000-0000-4000-8000-000000000001'),
  'shared viewer can read a board without recursive RLS'
);
select pg_temp.assert_true(
  pg_temp.exec_affected(
    'update public.boards set name = ''Viewer edit'' where id = ''10000000-0000-4000-8000-000000000001'''
  ) = 0,
  'shared viewer cannot update board content'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true(
  pg_temp.exec_affected(
    'update public.boards set data = ''{"objects":[{"type":"rect"}]}''::jsonb where id = ''10000000-0000-4000-8000-000000000002'''
  ) = 1,
  'public editor can update board content'
);
select pg_temp.expect_denied(
  'update public.boards set public_role = null where id = ''10000000-0000-4000-8000-000000000002''',
  'public editor changing public_role'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true(
  (select count(*) = 2 from public.shared_boards where board_id = '10000000-0000-4000-8000-000000000001'),
  'owner can read share rows without recursive RLS'
);
select pg_temp.assert_true(
  pg_temp.exec_affected(
    'update public.boards set public_role = ''viewer'' where id = ''10000000-0000-4000-8000-000000000001'''
  ) = 1,
  'owner can change public_role'
);
select pg_temp.assert_true(
  pg_temp.exec_affected(
    'update public.shared_boards set role = ''editor'' where board_id = ''10000000-0000-4000-8000-000000000001'' and user_id = ''00000000-0000-4000-8000-000000000003'''
  ) = 1,
  'owner can update a share role'
);
select pg_temp.expect_denied(
  'update public.shared_boards set board_id = ''10000000-0000-4000-8000-000000000002'' where board_id = ''10000000-0000-4000-8000-000000000001'' and user_id = ''00000000-0000-4000-8000-000000000003''',
  'owner moving a share row to another owner board'
);

reset role;
rollback;
