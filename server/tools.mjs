import database from './database.mjs';
import {generateSVGs} from './svg-generator.mjs';
import {createDoneTasksReport} from './done-tasks-report-generator.mjs';

let isReportGenerationRunning = false;
let shouldRerunReportGeneration = false;

async function generateAllSVGs() {
    const teams = await database.getTeams();

    await generateSVGsInternal(teams);
}

async function generateTeamSVGs(teamId) {
    const teams = (await database.getTeams()).filter(t => t.team_id === teamId);

    await generateSVGsInternal(teams, false);
}

async function generateSVGsInternal(teams, shouldGenerateDateScale = true) {
    const tasks = await database.getTasks();
    const completedTasksList = await database.getCompletedTasksOverview();

    await generateSVGs(teams, tasks, completedTasksList, shouldGenerateDateScale);
}

async function generateDoneTasksReport() {
    console.log('isReportGenerationRunning', isReportGenerationRunning);

    if (isReportGenerationRunning) {
        shouldRerunReportGeneration = true;
        return;
    }

    isReportGenerationRunning = true;

    const teams = await database.getTeamsAndPoints();
    const tasks = await database.getTasks();
    const completedTasksList = await database.getCompletedTasksOverview();

    await createDoneTasksReport(teams, tasks, completedTasksList);
    isReportGenerationRunning = false;

    if (shouldRerunReportGeneration) {
        shouldRerunReportGeneration = false;
        await generateDoneTasksReport();
    }
}

export {
    generateAllSVGs,
    generateTeamSVGs,
    generateDoneTasksReport
}

