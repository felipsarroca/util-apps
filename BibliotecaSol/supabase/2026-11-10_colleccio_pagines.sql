-- Biblioteca de la Sol · 2026-11-10
-- Afegeix col·lecció, número de col·lecció i nombre de pàgines a la fitxa del llibre,
-- el grup d'edat «14-16 anys» i el gènere «Conte».

alter table public.books
  add column if not exists collection text,
  add column if not exists collection_number text,
  add column if not exists page_count integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'books_page_count_positive') then
    alter table public.books
      add constraint books_page_count_positive check (page_count is null or page_count > 0);
  end if;
end $$;

create or replace view public.catalog_books as
select
  id,
  title,
  author,
  publisher,
  isbn,
  publication_year,
  language,
  recommended_level,
  topic,
  genre,
  summary,
  location,
  total_copies,
  available_copies,
  active,
  created_at,
  updated_at,
  collection,
  collection_number,
  page_count
from public.books
where active = true;

insert into public.book_options (field_name, value)
values
  ('recommended_level', '14-16 anys'),
  ('genre', 'Conte')
on conflict (field_name, value) do nothing;
