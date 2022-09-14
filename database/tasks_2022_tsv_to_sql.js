const fs = require('fs');
const {DateTime} = require('luxon');

const content = fs.readFileSync('tasks_2022.tsv', 'utf8');
const lines = content.split(/[\r\n]+/);

const week1StartDateTime = DateTime.local(2021, 9, 1).startOf('week');
const dateTimePattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2})/;
const datePattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/;
const dateTimeReplaceString = '$1-$2-$3 $4:$5:00 Europe/Tallinn';
let activeGroup = 'other';

let outputFileContent = `insert into task (name, points, task_group, is_optional, is_progress,
                  deadline, expires_at, start_time, end_time,
                  description)
values\n`;
const valueLines = [];

function shortDurationToLongDuration(shortDuration) {
    if (datePattern.test(shortDuration)) {
        return [shortDuration + ' 00:00:00 Europe/Tallinn', shortDuration + ' 23:59:00 Europe/Tallinn'];
    } else if (shortDuration.startsWith('W')) {
        const startAndEndWeek = shortDuration.slice(1).split('-').map(v => parseInt(v, 10));

        if (startAndEndWeek.length === 1) {
            const startDateTime = week1StartDateTime.plus({weeks: startAndEndWeek[0] - 1});
            const endDateTime = startDateTime.endOf('week');

            return [startDateTime.toSQL({includeZone: true}), endDateTime.toSQL({includeZone: true})];
        } else if (startAndEndWeek.length === 2) {
            const startDateTime = week1StartDateTime.plus({weeks: startAndEndWeek[0] - 1});
            const endDateTime = week1StartDateTime.plus({weeks: startAndEndWeek[1] - 1}).endOf('week');

            return [startDateTime.toSQL({includeZone: true}), endDateTime.toSQL({includeZone: true})];
        }
    }

    return [shortDuration + ' 00:00:00 Europe/Tallinn', shortDuration + ' 23:59:00 Europe/Tallinn'];
}

for (const line of lines) {
    const [taskName, points, deadlineRaw, expiresAtRaw, shortDuration, optionalRaw, linkOverride, link]
        = line.split('\t');

    if (taskName.startsWith('Group: ')) {
        activeGroup = taskName.replace('Group: ', '');
        valueLines.push(`\t-- ${activeGroup}`);
        continue;
    }

    if (!dateTimePattern.test(expiresAtRaw)) {
        continue;
    }

    let name = taskName;
    const description = link;
    const deadline = deadlineRaw.replace(dateTimePattern, dateTimeReplaceString);
    const expiresAt = expiresAtRaw.replace(dateTimePattern, dateTimeReplaceString);
    const isOptional = optionalRaw === '1';
    const isProgress = name.includes('Progress');

    const [startTime, endTime] = shortDurationToLongDuration(shortDuration);

    valueLines.push(`\t('${name}', ${points}, '${activeGroup}', ${isOptional}, ${isProgress},
\t${deadline === '' ? 'null' : `'${deadlineRaw}'`}, '${expiresAt}', '${startTime}', '${endTime}',
\t'${description}')`);
}

outputFileContent += valueLines.join(',\n') + ';';

fs.writeFileSync('init_tasks_2022.sql', outputFileContent);