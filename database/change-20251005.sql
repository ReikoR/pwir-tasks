-- Change from '2025-11-03 20:00:00 Europe/Tallinn' to '2025-11-24 20:00:00 Europe/Tallinn' as originally intended
update public.task set deadline = '2025-11-24 20:00:00 Europe/Tallinn' where name = 'Camera mount design completed';
