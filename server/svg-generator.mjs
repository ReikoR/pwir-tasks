import {promises as fs} from 'fs';
import {DateTime, Interval} from 'luxon';
import prettier from 'prettier';

const prettierOptions = {
    parser: 'html',
    printWidth: 120
};

const dayHeight = 12;
const weekCount = 22;
const dayCount = weekCount * 7;

const timeZone = 'Europe/Tallinn';
const locale = 'en-GB';
const week1StartDateTime = DateTime.local(2021, 9, 1, 0, 0, 0, 0, {zone: timeZone, locale}).startOf('week');
const courseEndDateTime = week1StartDateTime.plus({days: 7 * 22});
const taskGroupOrder = ['progress', 'competitions', 'other', 'programming', 'mechanics', 'electronics'];

const imageOutputDirectory = '../web/img/generated/'

function getNowDateTime() {
    return DateTime.local({zone: timeZone});
}

const LabelSide = {
    top: 'top',
    right: 'right',
    bottom: 'bottom',
    left: 'left',
};

const TextAnchor = {
    middle: 'middle',
    start: 'start',
    end: 'end',
}

const TextDominantBaseline = {
    baseline: 'baseline',
    central: 'central',
    hanging: 'hanging',
}

const moveX = (point, rx) => {
    return {x: point.x + rx, y: point.y};
}

const moveY = (point, ry) => {
    return {x: point.x, y: point.y + ry};
}

const moveXY = (point, rPoint) => {
    return {x: point.x + rPoint.x, y: point.y + rPoint.y};
}

const mirrorX = (point, center) => {
    return {x: 2 * center.x - point.x, y: point.y};
}

const mirrorY = (point, center) => {
    return {x: point.x, y: 2 * center.y - point.y};
}

const mirrorXY = (point, center) => {
    return {x: 2 * center.x - point.x, y: 2 * center.y - point.y};
}

const toSVG = (content, width, height) =>
    prettier.format(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${content}</svg>`, prettierOptions);

const rect = (x, y, width, height, fill, stroke, strokeWidth, style) =>
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" style="${style}"/>`;
const circle = (center, r, fill, stroke, strokeWidth, strokeDashArray = 'none') =>
    `<circle cx="${center.x}" cy="${center.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDashArray}"/>`;
const line = (from, to, stroke, strokeWidth) =>
    `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
const text = (label, point, size, color, anchor, dominantBaseline, style) =>
    `<text x="${point.x}" y="${point.y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" dominant-baseline="${dominantBaseline}" font-family="sans-serif" style="${style}">${label}</text>`;

const box = (x, y, width, height, textString, {
    color = 'transparent',
    fontSize = 10,
    rectStyle = '',
    textStyle = '',
    textClass = '',
    border = 'black',
    isMultiline = false
} = {}) => {
    const rectSVG = rect(x, y, width, height, color, border, 1, rectStyle);

    if (!textString) {
        return rectSVG;
    }

    const textClassAttr = textClass ? `class="${textClass}"` : ''

    const textSVG = isMultiline
        ? `<foreignObject class="node" x="${x}" y="${y}" width="${width}" height="${height}">
            <div xmlns="http://www.w3.org/1999/xhtml" ${textClassAttr}>${textString}</div>                
            </foreignObject>`
        : text(textString, moveXY({x, y}, {x: width / 2, y: height / 2}), fontSize, 'black', TextAnchor.middle, TextDominantBaseline.central, textStyle);


    return `<g>
        ${rect(x, y, width, height, color, border, 1, rectStyle)}
        ${textSVG}      
        </g>`;
}

/**
 * @param {DateTime} nowDateTime
 * @param {number} width
 * @returns {string|null}
 */
const dateScaleToday = (nowDateTime, width) => {
    const startOfNowDateTime = nowDateTime.startOf('day');

    if (startOfNowDateTime < week1StartDateTime || startOfNowDateTime > courseEndDateTime) {
        return null;
    }

    const y = Math.floor(dayHeight * startOfNowDateTime.diff(week1StartDateTime, 'days').days);

    return box(0, y, width, dayHeight, '', {color: '#8bf', border: '#8bf'});
}

const dateScaleMonths = (firstDayDateTime, lastDayDateTime) => {
    const fragments = [];
    const width = 20;
    let monthStartDateTime = firstDayDateTime;
    let monthEndDateTime = monthStartDateTime.endOf('month');

    while (monthStartDateTime < lastDayDateTime) {
        const y = Math.round(dayHeight * monthStartDateTime.diff(firstDayDateTime, 'days').days);
        const height = Math.round(dayHeight * monthEndDateTime.diff(monthStartDateTime, 'days').days);

        const name = height > 100 ? monthStartDateTime.monthLong : '';

        fragments.push(box(0, y, width, height, name, {
            textStyle: 'writing-mode: tb; text-orientation: upright;',
            fontSize: 12
        }));

        monthStartDateTime = monthEndDateTime.plus({day: 1}).startOf('month');
        monthEndDateTime = monthStartDateTime.endOf('month');
    }

   return fragments.join('');
};

const dateScaleDays = (firstDayDateTime, dayCount) => {
    const fragments = [];
    const width = 20;
    const height = 12;
    let activeDateTime = firstDayDateTime;

    for (let dayOffset = 0; dayOffset < dayCount; dayOffset++) {
        fragments.push(box(width, dayOffset * height, width, height, activeDateTime.day));

        activeDateTime = activeDateTime.plus({days: 1});
    }

    return fragments.join('');
}

const dateScaleWeeks = (weekCount) => {
    const fragments = [];
    const height = 12 * 7;
    const width = 20;

    for (let weekOffset = 0; weekOffset < weekCount; weekOffset++) {
        const name = weekOffset + 1;
        fragments.push(box(width * 2, weekOffset * height, width, height, name, {fontSize: 12}));
    }

    return fragments.join('');
}

/**
 * @param {DateTime} nowDateTime
 * @returns {string}>
*/
const dateScale = (nowDateTime) => {
    return `<g transform="translate(0.5, 0.5)">
        ${dateScaleToday(nowDateTime, 60)}
        ${dateScaleMonths(week1StartDateTime, week1StartDateTime.plus({days: dayCount}))}
        ${dateScaleDays(week1StartDateTime, dayCount)}
        ${dateScaleWeeks(weekCount)}
        </g>`;
};

/**
 *
 * @param {DateTime} nowDateTime
 * @param {Object[]} tasks
 * @param {Object} team
 * @param {Object} completedTasksMap
 * @param {Boolean} isPreview
 * @returns {{width: number, content: string}}
 */
const tasksSchedule = (nowDateTime, tasks, team, completedTasksMap, isPreview) => {
    const width = isPreview ? 8 : 60;
    const fragments = [];
    const taskGroupLaneStartIndices = [0, 0, 1, 2, 4, 6];
    const groups = {};

    for (const groupName of taskGroupOrder) {
        groups[groupName] = [];
    }

    for (const task of tasks) {
        groups[task.task_group].push(task);
    }

    const gridOccupation = [];

    function gridAddNewLane() {
        gridOccupation.push(new Array(dayCount).fill(false));
    }

    function gridLaneIsFree(lane, startIndex, endIndex) {
        return lane.slice(startIndex, endIndex + 1).every(v => !v);
    }

    function gridLaneOccupy(lane, startIndex, endIndex) {
        for (let i = startIndex; i < endIndex + 1; i++) {
            lane[i] = true;
        }
    }

    function placeOnGrid(startIndex, endIndex, startLaneIndex = 0) {
        for (const [laneIndex, lane] of gridOccupation.slice(startLaneIndex).entries()) {
            const isFree = gridLaneIsFree(lane, startIndex, endIndex);

            if (isFree) {
                gridLaneOccupy(lane, startIndex, endIndex);
                return laneIndex + startLaneIndex;
            }
        }

        gridAddNewLane();
        gridLaneOccupy(gridOccupation[gridOccupation.length - 1], startIndex, endIndex);

        return gridOccupation.length - 1;
    }

    for (const [groupIndex, groupName] of taskGroupOrder.entries()) {
        for (const task of groups[groupName]) {
            const startDateTime = DateTime.fromJSDate(task.start_time);
            const endDateTime = DateTime.fromJSDate(task.end_time);
            const taskInterval = Interval.fromDateTimes(startDateTime, endDateTime);

            const gridStartIndex = Math.floor(startDateTime.diff(week1StartDateTime, 'days').days);
            const gridEndIndex = Math.floor(endDateTime.diff(week1StartDateTime, 'days').days);
            const laneIndex = placeOnGrid(gridStartIndex, gridEndIndex, taskGroupLaneStartIndices[groupIndex]);

            const startY = Math.round(dayHeight * startDateTime.diff(week1StartDateTime, 'days').days);
            const endY = Math.round(dayHeight * endDateTime.diff(week1StartDateTime, 'days').days);
            const height = endY - startY;

            const name = isPreview ? '' : `<a href="${task.description}" title="${task.name}" target="_blank">${task.name}</a>`;

            let color = isPreview ? 'rgba(150,150,150,0.5)' : 'rgba(150,150,150,0.3)';

            if (completedTasksMap[task.task_id]) {
                color = isPreview ? 'rgba(0,200,0,0.8)' : 'rgba(0,200,0,0.4)';
            } else if (!task.is_optional) {
                if (taskInterval.contains(nowDateTime)) {
                    color = isPreview ? 'rgba(0,100,200,0.5)' : 'rgba(0,100,200,0.3)';
                } else if (endDateTime < nowDateTime) {
                    color = isPreview ? 'rgba(200,0,0,0.8)' : 'rgba(200,0,0,0.4)';
                }
            }

            fragments.push(box(width * laneIndex, startY, width, height, name, {
                color,
                isMultiline: true,
                textClass: 'task-name',
                border: isPreview ? color : 'black',
            }));
        }
    }

    const fullWidth = gridOccupation.length * width;
    fragments.unshift(dateScaleToday(nowDateTime, fullWidth));

    fragments.unshift(`<style>
        .task-name {
            font-family: sans-serif;
            font-size: 10px;
            line-height: 12px;
            padding: 0 2px;
            overflow-wrap: break-word;
        }
        
        .task-name a {
            text-decoration: none;
            color: black;
        }
        
        .task-name a:hover {
            color: #048;
            text-decoration: underline;
        }
    </style>`);

    return {width: fullWidth, content: `<g transform="translate(0.5, 0.5)">${fragments.join('')}</g>`};
}

export async function generateSVGs(teams, tasks, completedTasksList, shouldGenerateDateScale = true) {
    await fs.mkdir(imageOutputDirectory, {recursive: true});

    const nowDateTime = getNowDateTime();

    if (shouldGenerateDateScale) {
        console.log(DateTime.now().toISO(), 'Generate SVG for date scale');
        const datesSVG = toSVG(dateScale(nowDateTime), 62, dayHeight * dayCount + 1);
        await fs.writeFile(`${imageOutputDirectory}schedule-dates.svg`, datesSVG);
    }

    const fullHeight = dayHeight * dayCount + 1

    for (const team of teams) {
        console.log(DateTime.now().toISO(), 'Generate SVGs for team', team.team_id);

        const completedTasksMap = {};

        for (const completedTask of completedTasksList) {
            if (completedTask.team_id === team.team_id && completedTask.completion_time) {
                completedTasksMap[completedTask.task_id] = true;
            }
        }

        const {content: contentPreview, width: widthPreview} = tasksSchedule(nowDateTime, tasks, team, completedTasksMap, true);
        const tasksPreviewSVG = toSVG(contentPreview, widthPreview + 1, fullHeight);

        await fs.writeFile(`${imageOutputDirectory}schedule-tasks-team-${team.team_id}-preview.svg`, tasksPreviewSVG);

        const {content, width} = tasksSchedule(nowDateTime, tasks, team, completedTasksMap, false);
        const tasksSVG = toSVG(content, width + 1, fullHeight);

        await fs.writeFile(`${imageOutputDirectory}schedule-tasks-team-${team.team_id}.svg`, tasksSVG);
    }

    console.log(DateTime.now().toISO(), 'SVGs generated');
}
