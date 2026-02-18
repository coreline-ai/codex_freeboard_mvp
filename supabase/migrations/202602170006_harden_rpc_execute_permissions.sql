revoke execute on function public.toggle_post_like(uuid, uuid) from public;
revoke execute on function public.toggle_post_like(uuid, uuid) from anon;
revoke execute on function public.toggle_post_like(uuid, uuid) from authenticated;
grant execute on function public.toggle_post_like(uuid, uuid) to service_role;

revoke execute on function public.search_profiles_admin(integer, integer, text, text, boolean) from public;
revoke execute on function public.search_profiles_admin(integer, integer, text, text, boolean) from anon;
revoke execute on function public.search_profiles_admin(integer, integer, text, text, boolean) from authenticated;
grant execute on function public.search_profiles_admin(integer, integer, text, text, boolean) to service_role;
