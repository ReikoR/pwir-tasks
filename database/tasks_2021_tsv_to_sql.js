const fs = require('fs');

const content = fs.readFileSync('tasks_2021.tsv', 'utf8');
const lines = content.split(/[\r\n]+/);

const dateTimePattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2})/;
const dateTimeReplaceString = '$1-$2-$3 $4:$5:00 Europe/Tallinn';
const wikiBaseURL = 'https://digilabor.ut.ee/index.php/2021_PiCR_grading_and_tasks#';
let activeGroup = 'other';

let outputFileContent = `insert into task (name, points, task_group, is_optional, is_progress,
                  expires_at,
                  description)
values\n`;
const valueLines = [];

for (const line of lines) {
    const cells = line.split('\t');

    if (cells[0].startsWith('Group: ')) {
        activeGroup = cells[0].replace('Group: ', '');
        valueLines.push(`\t-- ${activeGroup}`);
        continue;
    }

    if (!dateTimePattern.test(cells[2])) {
        continue;
    }

    let name = cells[0];
    const description = wikiBaseURL + name.replace(/ /g, '_');
    const points = cells[1];
    const expiresAt = cells[2].replace(dateTimePattern, dateTimeReplaceString);
    const isOptional = false;
    const isProgress = name.includes('Progress');

    valueLines.push(`\t('${name}', ${points}, '${activeGroup}', ${isOptional}, ${isProgress},
\t'${expiresAt}',
\t'${description}')`);
}

outputFileContent += valueLines.join(',\n') + ';';

fs.writeFileSync('init_tasks_2021.sql', outputFileContent);

/*
name, points, task_group, on_time_bonus, week_before_bonus, is_optional, is_progress
deadline, expires_at,
description
 */