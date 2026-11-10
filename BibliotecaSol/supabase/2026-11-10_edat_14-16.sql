-- Biblioteca de la Sol · 2026-11-10
-- Unifica el grup d'edat «15-16 anys» dins de «14-16 anys».

update public.books
set recommended_level = '14-16 anys'
where recommended_level = '15-16 anys';

delete from public.book_options
where field_name = 'recommended_level' and value = '15-16 anys';
