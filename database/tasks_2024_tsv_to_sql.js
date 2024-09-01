const fs = require('fs');
const {DateTime} = require('luxon');

const content = fs.readFileSync('tasks_2024.tsv', 'utf8');
const lines = content.split(/[\r\n]+/);

const dateTimePattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2})/;
const datePattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/;
const dateTimeReplaceString = '$1-$2-$3 $4:$5:00 Europe/Tallinn';
let activeGroup = 'other';

let outputFileContent = `insert into task (name, points, task_group, is_progress,
                  deadline, expires_at,
                  description)
values\n`;
const valueLines = [];

for (const line of lines) {
    const [taskName, points, deadlineRaw, expiresAtRaw, linkOverride, link]
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
    const isProgress = name.includes('Progress');

    valueLines.push(`\t('${name}', ${points}, '${activeGroup}', ${isProgress},
\t${deadline === '' ? 'null' : `'${deadline}'`}, '${expiresAt}',
\t'${description}')`);
}

outputFileContent += valueLines.join(',\n') + ';';

fs.writeFileSync('init_tasks_2024.sql', outputFileContent);