-- Forward 2 weeks
update public.task set deadline = '2024-10-28 20:00:00 Europe/Tallinn' where name = 'Mainboard schematic completed';
update public.task set deadline = '2024-10-28 20:00:00 Europe/Tallinn' where name = 'Motor driver schematic completed';

-- Forward 1 week
update public.task set deadline = '2024-11-11 20:00:00 Europe/Tallinn' where name = 'Mainboard design completed';
update public.task set deadline = '2024-11-11 20:00:00 Europe/Tallinn' where name = 'Motor driver design completed';
update public.task set deadline = '2024-11-25 20:00:00 Europe/Tallinn' where name = 'PCB(s) soldered properly';