const hasOwn = {}.hasOwnProperty;

export function classNames() {
    const classes = [];

    for (let i = 0; i < arguments.length; i++) {
        const arg = arguments[i];
        if (!arg) continue;

        const argType = typeof arg;

        if (argType === 'string' || argType === 'number') {
            classes.push(arg);
        } else if (Array.isArray(arg) && arg.length) {
            const inner = classNames.apply(null, arg);
            if (inner) {
                classes.push(inner);
            }
        } else if (argType === 'object') {
            for (const key in arg) {
                if (hasOwn.call(arg, key) && arg[key]) {
                    classes.push(key);
                }
            }
        }
    }

    return classes.join(' ');
}

export function cloneObject(object) {
    return JSON.parse(JSON.stringify(object));
}

export function shallowCloneObject(object) {
    return Object.assign({}, object);
}

export function deepFreeze(object) {
    // Retrieve the property names defined on object
    const propNames = Object.getOwnPropertyNames(object);

    // Freeze properties before freezing self
    for (let name of propNames) {
        let value = object[name];

        object[name] = value && typeof value === "object" ? deepFreeze(value) : value;
    }

    return Object.freeze(object);
}

export function divideIntoIntegers(sum, count) {
    const min = Math.floor(sum / count);

    const values = Array(count).fill(min);
    const leftOver = sum - min * count;

    for (let i = 0; i < leftOver; i++) {
        values[i]++;
    }

    return values;
}