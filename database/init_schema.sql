create type participant_role as enum ('instructor', 'student');

create table participant (
    participant_id serial primary key,
    name text not null,
    study_book_no text unique,
    email text unique,
    role participant_role not null default 'student'
);

create table team (
    team_id serial primary key,
    name text not null
);

create table task (
    task_id serial primary key,
    name text not null,
    description text,
    points integer not null,
    deadline timestamptz not null,
    on_time_bonus boolean not null default true,
    week_before_bonus boolean not null default true,
    allow_overdue boolean not null default true
);

create or replace function task_points_with_bonuses(t task) returns integer as $$
begin
  if t.week_before_bonus then
    return t.points * 1.2;
  elseif t.on_time_bonus then
    return t.points * 1.1;
  end if;

  return t.points;
end;
$$ stable language 'plpgsql';

create table team_member (
    participant_id integer not null references participant(participant_id),
    team_id integer not null references team(team_id),
    start_time timestamptz not null,
    end_time timestamptz
);

alter table team_member add constraint team_member_start_before_end
    check (start_time isnull or end_time isnull or start_time < end_time);

create extension btree_gist;
alter table team_member add constraint team_member_no_time_overlap
    exclude using gist (participant_id with =, team_id with =, tstzrange(start_time, end_time) with &&);

create table completed_task (
    participant_id integer not null references participant(participant_id),
    task_id integer not null references task(task_id),
    team_id integer not null references team(team_id),
    points integer not null,
    completion_time timestamptz not null
);