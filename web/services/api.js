async function get(url) {
    return await fetch(url, {
        credentials: 'include',
    }).then(async (response) => {
        if (response.ok) {
            try {
                return await response.json();
            } catch {
                return response.statusText;
            }
        }

        throw await response.json();
    }).catch((errorInfo) => {
        console.error(errorInfo);

        throw errorInfo;
    });
}

async function post(url, params) {
    return await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(params)
    }).then(async (response) => {
        if (response.ok) {
            try {
                return await response.json();
            } catch {
                return response.statusText;
            }
        }

        throw await response.json();
    }).catch((errorInfo) => {
        console.error(errorInfo);

        throw errorInfo;
    });
}

export function getSession() {
    return get('/session');
}

export function getTasks() {
    return get('/api/tasks');
}

export function getTeams() {
    return get('/api/teams');
}

export function getParticipants(params) {
    return post('/api/participants', params);
}

export function getParticipantsAndPoints() {
    return get('/api/participants-and-points');
}

export function getCompletedTasksList() {
    return get('/api/completed-tasks-list');
}

export function getCompletedTask(task_id, team_id) {
    return post('/api/get-completed-task', {task_id, team_id});
}

export function setCompletedTask(params) {
    return post('/api/set-completed-task', params);
}

export function getPointsUsedByTaskParticipant(params) {
    return post('/api/get-participant-points-used', params);
}

export function getParticipantTaskPoints(params) {
    return post('/api/get-participant-task-points', params);
}

export function getCompletedTaskChanges(params) {
    return post('/api/get-completed-task-changes', params);
}