const fs = require('fs');
const {DateTime} = require('luxon');

const content = fs.readFileSync('tasks_2023.tsv', 'utf8');
const lines = content.split(/[\r\n]+/);

const week1StartDateTime = DateTime.local(2021, 9, 1).startOf('week');
const dateTimePattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2})/;
const datePattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/;
const dateTimeReplaceString = '$1-$2-$3 $4:$5:00 Europe/Tallinn';
let activeGroup = 'other';

let outputFileContent = `insert into task (name, points, task_group, is_optional, is_progress,
                  deadline, expires_at,
                  description)
values\n`;
const valueLines = [];

for (const line of lines) {
    const [taskName, points, deadlineRaw, expiresAtRaw, optionalRaw, linkOverride, link]
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

    valueLines.push(`\t('${name}', ${points}, '${activeGroup}', ${isOptional}, ${isProgress},
\t${deadline === '' ? 'null' : `'${deadline}'`}, '${expiresAt}',
\t'${description}')`);
}

outputFileContent += valueLines.join(',\n') + ';';

fs.writeFileSync('init_tasks_2023.sql', outputFileContent);