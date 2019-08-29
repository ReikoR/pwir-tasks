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
    expires_at timestamptz not null,
    on_time_bonus boolean not null default true,
    week_before_bonus boolean not null default true,
    is_optional boolean not null default false,
    is_progress boolean not null default false
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
    task_id integer not null references task(task_id),
    team_id integer not null references team(team_id),
    completion_time timestamptz not null,
    primary key (task_id, team_id)
);

create table completed_task_participant (
    task_id integer not null,
    team_id integer not null,
    participant_id integer not null references participant(participant_id),
    points integer not null,
    primary key (task_id, team_id, participant_id),
    foreign key (task_id, team_id) references completed_task(task_id, team_id)
);

create table completed_task_history (
    completed_task_history_id serial primary key,
    task_id integer not null,
    team_id integer not null,
    edit_time timestamptz not null default now(),
    editor_id integer not null references participant(participant_id),
    state jsonb,
    foreign key (task_id, team_id) references completed_task(task_id, team_id)
)