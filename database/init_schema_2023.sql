create type participant_role as enum ('instructor', 'student');
create type task_group_name as enum ('programming', 'mechanics', 'electronics', 'other', 'progress', 'competitions');

create table participant (
    participant_id serial primary key,
    name text not null,
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
    start_time timestamptz,
    end_time timestamptz,
    deadline timestamptz,
    expires_at timestamptz not null,
    is_optional boolean not null default false,
    is_progress boolean not null default false,
    task_group task_group_name not null
);

alter table task add constraint task_start_before_end
    check (start_time isnull or end_time isnull or start_time < end_time);

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
);

create or replace function task_points_with_time(t task, completion_time timestamptz) returns integer as $$
begin
    if t.expires_at < completion_time then -- after expires_at
        return 0;
    elsif t.deadline < completion_time then -- after deadline, before expires_at
        return t.points / 2;
    end if;

  return t.points; -- before deadline
end;
$$ stable language 'plpgsql';

create schema private;

create table private.account (
    participant_id integer primary key references public.participant(participant_id),
    account_name text not null unique,
    password_hash text not null
);

create table private.account_invite (
    account_invite_id serial primary key,
    uuid text unique not null,
    participant_id integer not null references public.participant(participant_id),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
);

create role ui_user with login;

grant connect on database picr2022 to ui_user;
grant usage on schema public to ui_user;
grant usage, select on all sequences in schema public to ui_user;

grant select on table task to ui_user;
grant select on table team to ui_user;
grant select on table completed_task to ui_user;
grant select on table participant to ui_user;
grant select on table team_member to ui_user;
grant select on table completed_task_participant to ui_user;
grant select on table completed_task_history to ui_user;

grant insert on table completed_task to ui_user;
grant update on table completed_task to ui_user;
grant delete on table completed_task_participant to ui_user;
grant insert on table completed_task_participant to ui_user;
grant update on table completed_task_participant to ui_user;
grant insert on table completed_task_history to ui_user;

create role server_private_user with login;

grant connect on database picr2022 to server_private_user;
grant usage on schema public to server_private_user;
grant usage on schema private to server_private_user;
grant select on public.participant to server_private_user;
grant insert on public.participant to server_private_user;
grant update on public.participant to server_private_user;
grant delete on public.participant to server_private_user;

grant select on private.account to server_private_user;
grant insert on private.account to server_private_user;
grant update on private.account to server_private_user;
grant delete on private.account to server_private_user;
grant usage, select on public.participant_participant_id_seq to server_private_user;

grant select on private.account_invite to server_private_user;
grant insert on private.account_invite to server_private_user;
grant update on private.account_invite to server_private_user;
grant delete on private.account_invite to server_private_user;
grant usage, select on private.account_invite_account_invite_id_seq to server_private_user;