-- Close default PUBLIC/anon grants left on package and shop tables.
-- Additive / reversible. Expected affected data rows: 0.
--
-- Rollback:
--   grant select, insert, update, delete, truncate, references, trigger
--     on public.packages, public.member_packages, public.member_package_redemptions,
--        public.shop_carts, public.shop_cart_items
--     to anon, public;

begin;

set local lock_timeout = '5s';

revoke all on public.packages from anon, public;
revoke all on public.member_packages from anon, public;
revoke all on public.member_package_redemptions from anon, public;
revoke all on public.shop_carts from anon, public;
revoke all on public.shop_cart_items from anon, public;

grant select, insert, update, delete on public.packages to authenticated;
grant select, insert, update, delete on public.member_packages to authenticated;
grant select, insert, update, delete on public.member_package_redemptions to authenticated;
grant select, insert, update, delete on public.shop_carts to authenticated;
grant select, insert, update, delete on public.shop_cart_items to authenticated;

revoke truncate, references, trigger on public.packages from authenticated;
revoke truncate, references, trigger on public.member_packages from authenticated;
revoke truncate, references, trigger on public.member_package_redemptions from authenticated;
revoke truncate, references, trigger on public.shop_carts from authenticated;
revoke truncate, references, trigger on public.shop_cart_items from authenticated;

commit;
