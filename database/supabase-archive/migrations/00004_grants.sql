grant execute on function public.nearby_places(double precision, double precision, integer, integer) to anon, authenticated;
grant execute on function public.places_in_viewport(double precision, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.refresh_place_aggregates(uuid) to authenticated;
