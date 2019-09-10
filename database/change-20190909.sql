create or replace function task_points_with_time(t task, completion_time timestamptz) returns integer as $$
begin
    if t.expires_at < completion_time then
        return 0;
    elseif t.week_before_bonus and t.deadline - interval '1 week' >= completion_time then
        return t.points * 1.2;
    elseif t.on_time_bonus and t.deadline >= completion_time then
        return t.points * 1.1;
    end if;

  return t.points;
end;
$$ stable language 'plpgsql';