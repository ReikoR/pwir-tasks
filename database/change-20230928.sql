create or replace function task_points_with_time(t task, completion_time timestamptz) returns integer as $$
begin
    if completion_time is null or t.expires_at < completion_time then -- after expires_at
        return 0;
    elsif t.deadline < completion_time then -- after deadline, before expires_at
        return t.points / 2;
    end if;

    return t.points; -- before deadline
end;
$$ stable language 'plpgsql';

alter table public.completed_task alter column completion_time drop not null;