/**
 * @param {string} name
 * @return {number}
 */
function parseLesson(name) {
    const num = name.match(/(\d+)/g);
    const parsedNumber = parseInt(num[0]);
    if (parsedNumber > 0) {
        return parsedNumber;
    }
    throw new Error('Error parsing: ' + name);
}

module.exports = {
    parseLesson
}
