-- Move deadlines from Thursday to next Monday
update public.task set deadline = '2026-10-12 21:00:00 Europe/Tallinn' where name = 'Robot finds a ball';
update public.task set deadline = '2026-10-26 21:00:00 Europe/Tallinn' where name = 'Robot follows a ball';
update public.task set deadline = '2026-11-09 21:00:00 Europe/Tallinn' where name = 'Robot finds basket with a ball';