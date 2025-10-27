type KroosterOperator = {
    user_id: string;
    op_id: string;
    favorite: boolean;
    elite: number;
    level: number;
    skill_level: number;
    masteries: number[];
    modules: Record<string, number>;
    potential: number;
    skin: string;
}
type OverallRating = {
    id: string;
    name: string;
    masteryDesc: string;
    masteries: MasteryRating[];
    modules: ModuleRating[];
    operator: OperatorRating;
};
type MasteryRating = {
    operator: string;
    skill: number;
    mastery: number;
    breakpoint: boolean;
    story: string;
    advanced: string;
    roguelike: string;
    rating: number;
};
type ModuleRating = {
    operator: string;
    module: string;
    symbol: string;
    description: string;
    moduleRating: string;
    improveChar: string;
    level: number;
    priority: string;
    rating: number;
}
type OperatorRating = {
    operator: string;
    tier: string;
    rating: number;
}

const hellaApi = 'https://awedtan.ca/api';
const proxyUrl = 'https://awedtan.ca/proxy';

// for masteries, sort them by rating = story+advanced
// for modules, sort them by priority
const ratingScale = ['F', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S-', 'S', 'S+', 'S++', 'EX'];
const suggestionsLimit = 15;

let ops: any[];
let overallRatingDict: { [key: string]: OverallRating } = {};
let masteryRatingDict: { [key: string]: MasteryRating } = {};
let moduleRatingDict: { [key: string]: ModuleRating } = {};
let operatorRatingDict: { [key: string]: OperatorRating } = {};

const clean = str => str?.replace(/['-*()]/g, '').trim() ?? null;

function colourLog(str: string, colour = '', style = '') {
    const colours = {
        'red': '\x1b[31m',
        'green': '\x1b[32m',
        'yellow': '\x1b[33m',
        'blue': '\x1b[34m',
        'magenta': '\x1b[35m',
        'cyan': '\x1b[36m'
    }
    const styles = {
        'bold': '\x1b[1m',
        'italic': '\x1b[3m',
        'underline': '\x1b[4m'
    }
    // console.log(`${colours[colour] ?? ''}${styles[style] ?? ''}${str}\x1b[0m`);
    console.log(str);
}

function getOpRating(opId: string, opName: string = ''): OverallRating {
    if (!overallRatingDict[opId]) {
        overallRatingDict[opId] = {
            id: opId,
            name: opName,
            masteryDesc: '',
            masteries: [],
            modules: [],
            operator: null
        };
    }
    return overallRatingDict[opId];
}

async function loadMasteryRatings() {
    const masterySheetId = '1iJF12O6QOba1dlUVmobwvc1eBZE7FRB6-tKxmZEcG1I'
    const masterySheetGids = [
        // 6 stars
        1620637056,  // vanguard
        1409930322,  // guard
        0,           // defender
        2023844965,  // sniper
        18186132,    // caster
        1074329234,  // medic
        1309173570,  // supporter
        236453289,   // specialist
        // 4&5 stars
        766639019,   // vanguard
        628627289,   // guard
        365280683,   // defender
        708929742,   // sniper
        370855676,   // caster
        1964081576,  // medic
        852971951,   // supporter
        1083748537   // specialist
    ];

    colourLog('Loading mastery ratings...', 'yellow');

    const urls = masterySheetGids.map(gid => `${proxyUrl}/sheet?id=${masterySheetId}&gid=${gid}`);
    const responses = (await Promise.all(urls.map(url => fetch(url).then(response => response.text()))));
    const masterySheets = responses.map(data => JSON.parse(data.substring(47).slice(0, -2)))

    let currOpId = '';
    for (const sheet of masterySheets) {
        for (let i = 2; i < sheet.table.rows.length; i++) {
            const row = sheet.table.rows[i].c.map(e => e?.v ?? '');

            if (!row || row.filter(e => e !== '').length < 2)
                continue;
            for (let j = 0; j < row.length; j++) {
                row[j] = clean(row[j]);
            }

            if (row[0] && row[0] !== '') {
                const nameOverride = {
                    'Лето / Leto': 'Leto',
                    'Greyy the Lightning Bearer': 'Greyy the Lightningbearer',
                    'Sussuro': 'Sussurro',
                    'Mr.Nothing': 'Mr. Nothing',
                }
                const currOpName = clean(nameOverride[row[0]]) ?? clean(row[0]);

                try {
                    currOpId = ops.find(e => e.keys.includes(currOpName.toLowerCase())).value.id;
                } catch (e) {
                    colourLog(`Mastery: operator for ${currOpName} not found`, 'red');
                    continue;
                }
                if (!currOpId) {
                    colourLog(`Mastery: operator for ${currOpName} not found`, 'red');
                    continue;
                }

                getOpRating(currOpId, currOpName).masteryDesc = row[5] ?? 'N/A';
            }

            const currMastery: MasteryRating = {
                operator: currOpId,
                skill: Number(row[1][1]),
                mastery: Number(row[1][3]),
                breakpoint: row[2] === 'Breakpoint',
                story: row[2] ?? 'None',
                advanced: row[3] ?? 'None',
                roguelike: row[4] ?? 'None',
                rating: [row[2], row[3]].reduce((acc, mastery) => acc + Math.max(0, ratingScale.indexOf(mastery)), 0)
            };

            getOpRating(currOpId).masteries.push(currMastery);
            masteryRatingDict[`${currMastery.operator}_${currMastery.skill}_${currMastery.mastery}`] = currMastery;
        }
    }

    colourLog('Mastery ratings loaded.', 'yellow');
}

async function loadModuleRatings() {
    const moduleSheetId = '1A0_0XTAcDDtHkvyAwjTqEEzM8cf5h3E60u23ZVXw4eg'
    const moduleSheetGid = '0';

    colourLog('Loading module ratings...', 'yellow');

    const url = `${proxyUrl}/sheet?id=${moduleSheetId}&gid=${moduleSheetGid}`;
    const response = await fetch(url).then(response => response.text());
    const moduleSheet = JSON.parse(response.substring(47).slice(0, -2));

    for (let i = 2; i < moduleSheet.table.rows.length; i++) {
        const row = moduleSheet.table.rows[i].c.map(e => e?.v ?? '');

        if (!row || row.filter(e => e !== '').length != 10)
            continue;
        for (let j = 0; j < row.length; j++) {
            row[j] = clean(row[j]);
        }

        const nameOverride = {
            'Pozyomka': 'Pozemka',
            'Qiu Bai': 'Qiubai'
        }
        const currOpName = clean(nameOverride[row[0]]) ?? clean(row[0]);

        let currOp;
        try {
            currOp = ops.find(op => op.keys.includes(currOpName.toLowerCase())).value;
        } catch (e) {
            colourLog(`Module: operator ${currOpName} not found`, 'red');
            continue;
        }
        if (!currOp) {
            colourLog(`Module: operator ${currOpName} not found`, 'red');
            continue;
        }
        if (currOp.modules.length === 0) {
            colourLog(`Module: operator ${currOpName} has no modules`, 'red');
            continue;
        }

        const moduleNameMap = { 'X': 'X', 'Y': 'Y', 'Δ': 'D' }
        const currModuleId = currOp.modules.find(m => m.info.typeName2 === moduleNameMap[row[2]])?.info.uniEquipId;

        if (!currModuleId) {
            colourLog(`Module: module ${row[2]} for ${currOpName} not found`, 'red');
            continue;
        }

        const currModule: ModuleRating = {
            operator: currOp.id,
            module: currModuleId,
            symbol: row[2],
            description: row[8] + '\n' + row[9],
            moduleRating: row[4],
            improveChar: row[5],
            level: Number(row[6].split(' ')[1][0]),
            priority: row[7],
            rating: Math.max(0, ratingScale.indexOf(row[7])),
        }

        getOpRating(currOp.id, currOpName).modules.push(currModule);
        moduleRatingDict[currModule.operator + currModule.module] = currModule;
    }

    colourLog('Module ratings loaded.', 'yellow');
}

async function loadOperatorRatings() {
    const operatorSheetId = '1E7HmgKWiV8pKpJpvpVzziYxnaQTP01Vtw_PXEdL7XPA';
    const operatorSheetGid = '1108925005';

    colourLog('Loading operator ratings...', 'yellow');

    const url = `${proxyUrl}/sheet?id=${operatorSheetId}&gid=${operatorSheetGid}`;
    const response = await fetch(url).then(response => response.text());
    const operatorSheet = JSON.parse(response.substring(47).slice(0, -2));

    let currRating = 'EX';
    for (let i = 2; i < operatorSheet.table.rows.length; i++) {
        const row = operatorSheet.table.rows[i].c.map(e => e?.v ?? '');

        if (!row)
            continue;
        for (let j = 0; j < row.length; j++) {
            row[j] = clean(row[j]);
        }

        if (row[0] && ratingScale.includes(row[0])) {
            currRating = row[0];
        }
        for (let j = 1; j < row.length; j++) {
            if (!row[j])
                continue;

            const nameOverride = {
                'Reed the Flameshadow': 'Reed the Flame Shadow',
                'Phantom General': 'Phantom',
                'Fiametta': 'Fiammetta',
                'Лето Leto': 'Leto',
                'Sussuro': 'Sussurro',
                'Waii Fu': 'Waai Fu',
                'Rosmontis General': 'Rosmontis',
                'Angelina General': 'Angelina',
            }
            const currOpName = clean(nameOverride[row[j]]) ?? clean(row[j]);
            let currOp;
            try {
                currOp = ops.find(op => op.keys.includes(currOpName.toLowerCase())).value;
            }
            catch (e) {
                colourLog(`Operator: operator ${currOpName} not found`, 'red');
                continue;
            }
            if (!currOp) {
                colourLog(`Operator: operator ${currOpName} not found`, 'red');
                continue;
            }

            const currOpRating = {
                operator: currOp.id,
                tier: currRating,
                rating: Math.max(0, ratingScale.indexOf(currRating))
            };
            getOpRating(currOp.id, currOpName).operator = currOpRating;
            operatorRatingDict[currOp.id] = currOpRating;
        }
    }
}

async function loadKrooster(username) {
    try {
        const userAccount = (await (await fetch(`${proxyUrl}/krooster_accounts?username=${username}`)).json())[0];
        const userId = userAccount.user_id;
        const userOps: KroosterOperator[] = await (await fetch(`${proxyUrl}/krooster_operators?userId=${userId}`)).json();

        return { userAccount, userOps };
    } catch (e) {
        return { userAccount: null, userOps: null };
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    colourLog('Arknights Upgrades Overview', 'cyan', 'bold');
    console.log('Account info pulled from Krooster by neia:');
    colourLog('https://www.krooster.com', 'blue', 'underline');
    console.log('Mastery ratings pulled from TacticalBreakfast\'s spreadsheet:');
    colourLog('https://docs.google.com/spreadsheets/d/1iJF12O6QOba1dlUVmobwvc1eBZE7FRB6-tKxmZEcG1I', 'blue', 'underline');
    console.log('Module ratings pulled from DragonGJY\'s spreadsheet:');
    colourLog('https://docs.google.com/spreadsheets/d/1A0_0XTAcDDtHkvyAwjTqEEzM8cf5h3E60u23ZVXw4eg', 'blue', 'underline');

    colourLog('Loading operator data...', 'yellow');
    ops = await (await fetch(`${hellaApi}/operator?include=id&include=modules`)).json();
    await Promise.all([
        loadMasteryRatings(),
        loadModuleRatings(),
        loadOperatorRatings()
    ]);
    colourLog('Data successfully loaded.', 'green');
    const sortedMasteries = Object.values(masteryRatingDict).sort((a, b) => b.rating - a.rating);
    const sortedModules = Object.values(moduleRatingDict).sort((a, b) => b.rating - a.rating);
    const sortedOperators = Object.values(operatorRatingDict).sort((a, b) => b.rating - a.rating);

    document.getElementById('opInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('opSubmitBtn').click();
        }
    });
    document.getElementById('opInput').removeAttribute('disabled');
    document.getElementById('opSubmitBtn').addEventListener('click', opOnClick);
    document.getElementById('opSubmitBtn').removeAttribute('disabled');

    document.getElementById('userInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('userSubmitBtn').click();
        }
    });
    document.getElementById('userInput').removeAttribute('disabled');
    document.getElementById('userSubmitBtn').addEventListener('click', userOnClick);
    document.getElementById('userSubmitBtn').removeAttribute('disabled');

    function populateTable(tableId, data: { id: string, values: { [key: string]: any } }[]) {
        const table = document.getElementById(tableId);
        table.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');
            for (const [key, value] of Object.entries(row.values)) {
                const td = document.createElement('td');

                if (key === 'operator') {
                    td.classList.add('operator');
                    const img = document.createElement('img');
                    img.src = `https://raw.githubusercontent.com/Awedtan/HellaAssets/refs/heads/main/operator/avatars/${row.id}.png`;
                    img.alt = value;
                    img.style.width = '2em';
                    img.style.height = '2em';
                    img.style.verticalAlign = 'middle';
                    td.appendChild(img);
                    const span = document.createElement('span');
                    span.textContent = value;
                    span.style.marginLeft = '0.5em';
                    td.appendChild(span);
                }
                else {
                    const preformatted = document.createElement('pre');
                    preformatted.textContent = value;
                    td.appendChild(preformatted);
                }

                tr.appendChild(td);
            }
            table.appendChild(tr);
        });
    }

    async function opOnClick() {
        const elements = ['opMasteryTable', 'opBreakpointTable', 'opModuleTable', 'opUnownedTable'];
        elements.forEach(e => document.getElementById(e).innerHTML = '');

        const operatorName = (document.getElementById('opInput') as HTMLInputElement).value;
        const operator = ops.find(op => op.keys.includes(operatorName.toLowerCase()));

        if (!operator) {
            alert(`Operator not found: ${operatorName}`);
            return;
        }

        const op = getOpRating(operator.value.id, operatorName);

        if (!op) {
            alert(`Operator not found: ${operatorName}`);
            return;
        }

        try {
            const ratedMasteries = op.masteries
                .slice(0, suggestionsLimit)
                .filter(mastery => !mastery.breakpoint)
                .map(mastery => ({
                    id: mastery.operator,
                    values: {
                        operator: `${overallRatingDict[mastery.operator].name}`,
                        skill: `S${mastery.skill}`,
                        rating: `${mastery.story.padEnd(4)}/ ${mastery.advanced.padEnd(4)}/ ${mastery.roguelike}`,
                        mastery: `M${mastery.mastery}`
                    }
                }));
            populateTable('opMasteryTable', ratedMasteries);

            const breakpointMasteries = op.masteries
                .filter(mastery => mastery.breakpoint)
                .slice(0, suggestionsLimit)
                .map(mastery => ({
                    id: mastery.operator,
                    values: {
                        operator: `${overallRatingDict[mastery.operator].name}`,
                        skill: `S${mastery.skill}`,
                        mastery: `M${mastery.mastery}`
                    }
                }));
            populateTable('opBreakpointTable', breakpointMasteries);

            const ratedModules = op.modules
                .slice(0, suggestionsLimit)
                .map(module => ({
                    id: module.operator,
                    values: {
                        operator: `${overallRatingDict[module.operator].name}`,
                        symbol: `${module.symbol}`,
                        rating: `${module.moduleRating.padEnd(3)}/ ${module.improveChar.padEnd(3)}/ ${module.priority}`,
                        level: `L${module.level}`
                    }
                }));
            populateTable('opModuleTable', ratedModules);

            const ratedOperators = [{ id: op.id, values: { operator: `${op.name}`, tier: `${op.operator.tier}` } }];
            populateTable('opUnownedTable', ratedOperators);
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }

    async function userOnClick(op) {
        const elements = ['masteryTable', 'breakpointTable', 'moduleTable', 'unownedTable'];
        elements.forEach(e => document.getElementById(e).innerHTML = '');

        const username = (document.getElementById('userInput') as HTMLInputElement).value;

        if (!username)
            return;

        try {
            const { userAccount, userOps } = await loadKrooster(username);
            if (!userAccount || !userOps) {
                alert(`User not found: ${username}`);
                return;
            }

            const ratedMasteries = sortedMasteries
                .filter(mastery => {
                    const userOp = userOps.find(op => op.op_id === mastery.operator);
                    return userOp && userOp.masteries[mastery.skill - 1] < mastery.mastery;
                })
                .slice(0, suggestionsLimit)
                .map(mastery => ({
                    id: mastery.operator,
                    values: {
                        operator: `${overallRatingDict[mastery.operator].name}`,
                        skill: `S${mastery.skill}`,
                        rating: `${mastery.story.padEnd(4)}/ ${mastery.advanced.padEnd(4)}/ ${mastery.roguelike}`,
                        mastery: `M${userOps.find(op => op.op_id === mastery.operator).masteries[mastery.skill - 1]} > M${mastery.mastery}`
                    }
                }));
            populateTable('masteryTable', ratedMasteries);

            const breakpointMasteries = sortedMasteries
                .filter(mastery => {
                    const userOp = userOps.find(op => op.op_id === mastery.operator);
                    return userOp && userOp.elite === 2 && userOp.masteries[mastery.skill - 1] < mastery.mastery && mastery.breakpoint;
                })
                .slice(0, suggestionsLimit)
                .map(mastery => ({
                    id: mastery.operator,
                    values: {
                        operator: `${overallRatingDict[mastery.operator].name}`,
                        skill: `S${mastery.skill}`,
                        mastery: `M${userOps.find(op => op.op_id === mastery.operator).masteries[mastery.skill - 1]} > M${mastery.mastery}`
                    }
                }));
            populateTable('breakpointTable', breakpointMasteries);

            const ratedModules = sortedModules
                .filter(module => {
                    const userOp = userOps.find(op => op.op_id === module.operator);
                    return userOp && userOp.modules[module.module] < module.level;
                })
                .slice(0, suggestionsLimit)
                .map(module => ({
                    id: module.operator,
                    values: {
                        operator: `${overallRatingDict[module.operator].name}`,
                        symbol: `${module.symbol}`,
                        rating: `${module.moduleRating.padEnd(3)}/ ${module.improveChar.padEnd(3)}/ ${module.priority}`,
                        level: `L${userOps.find(op => op.op_id === module.operator).modules[module.module]} > L${module.level}`
                    }
                }));
            populateTable('moduleTable', ratedModules);

            const ratedOperators = sortedOperators
                .filter(operator => !userOps.some(op => op.op_id === operator.operator))
                .slice(0, suggestionsLimit)
                .map(operator => ({
                    id: operator.operator,
                    values: {
                        operator: `${overallRatingDict[operator.operator].name}`,
                        tier: `${operator.tier}`,
                    }
                }));
            populateTable('unownedTable', ratedOperators);
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }
});
