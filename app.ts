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
const proxyUrl = 'https://awedtan.ca/upgrade-viewer/proxy';

// for masteries, sort them by rating = story+advanced
// for modules, sort them by priority
const ratingScale = ['F', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S-', 'S', 'S+', 'S++', 'EX'];
const suggestionsLimit = 15;

let ops: any[];
let overallRatingDict: { [key: string]: OverallRating } = {};
let masteryRatingDict: { [key: string]: MasteryRating } = {};
let moduleRatingDict: { [key: string]: ModuleRating } = {};
let operatorRatingDict: { [key: string]: OperatorRating } = {};

let sortedMasteries: MasteryRating[];
let sortedModules: ModuleRating[];
let sortedOperators: OperatorRating[];

let currentLimit = suggestionsLimit;
let currentUserOps: KroosterOperator[] | null = null;

const clean = (str: string) => str?.replace(/['-*()]/g, '').replace(/[\n]/g, ' ').trim() ?? null;

function byId(id: string) {
    const elem = document.getElementById(id);
    if (!elem) throw new Error(`Missing element with id: ${id}`);
    return elem as HTMLElement;
}

function getOpRating(opId: string, opName: string = ''): OverallRating {
    if (!overallRatingDict[opId]) {
        overallRatingDict[opId] = {
            id: opId,
            name: opName,
            masteryDesc: '',
            masteries: [],
            modules: [],
            operator: {
                operator: '',
                tier: '',
                rating: 0
            }
        };
    }
    return overallRatingDict[opId];
}

async function loadMasteryRatings() {
    const masterySheetId = '1iJF12O6QOba1dlUVmobwvc1eBZE7FRB6-tKxmZEcG1I'
    const masterySheetGids = [
        1974758696,  // latest
        122346402,   // vanguard
        1866092508,  // guard
        1415267055,  // defender
        730977758,   // sniper
        1966952250,  // caster
        1102114684,  // medic
        638719893,   // supporter
        1272513614,  // specialist
    ];

    console.info('Loading mastery ratings...');

    const urls = masterySheetGids.map(gid => `${proxyUrl}/sheet?id=${masterySheetId}&gid=${gid}`);
    const responses = (await Promise.all(urls.map(url => fetch(url).then(response => response.text()))));
    const masterySheets = responses.map(data => JSON.parse(data.substring(47).slice(0, -2)))

    let currOpId = '';
    for (const sheet of masterySheets) {
        for (let i = 2; i < sheet.table.rows.length; i++) {
            const row: string[] = sheet.table.rows[i].c.map((e: any) => e?.v ?? '');
            if (!row || row.filter((e: any) => e !== '').length < 2 || ["Skill", "Full Article"].includes(row[0]) || (row[0][0] === 'S' && row[0][2] === 'M'))
                continue;

            for (let j = 0; j < row.length; j++) {
                row[j] = clean(row[j]);
            }

            if (row[0] && row[0] !== '') {
                const nameOverride: { [key: string]: string } = {
                    'Лето / Leto': 'Leto',
                    'Greyy the Lightning Bearer': 'Greyy the Lightningbearer',
                    'Sussuro': 'Sussurro',
                    'Mr.Nothing': 'Mr. Nothing',
                }
                const currOpName = clean(nameOverride[row[0]]) ?? clean(row[0]);

                try {
                    currOpId = ops.find((e: any) => e.keys.includes(currOpName.toLowerCase())).value.id;
                } catch (e) {
                    console.error(`Mastery: operator ${currOpName} not found`);
                    continue;
                }
                if (!currOpId) {
                    console.error(`Mastery: operator ${currOpName} not found`);
                    continue;
                }

                getOpRating(currOpId, currOpName).masteryDesc = row[9] ?? 'N/A';

                let currSkill = '';
                for (let j = i + 1; j < sheet.table.rows.length; j++) {
                    const row2: string[] = sheet.table.rows[j].c.map((e: any) => e?.v ?? '');

                    if (row2[9]) {
                        i = j;
                        break;
                    }

                    if (row2[0]?.length === 4 && row2[0][0] === 'S') {
                        currSkill = row2[0];
                    }
                    else if (row2[0] !== "Skill" && row2[2] && (row2[5] || row2[4])) {
                    }
                    else {
                        continue;
                    }

                    const breakpoint = row2[2].startsWith('Breakpoint');

                    const currMastery: MasteryRating = {
                        operator: currOpId,
                        skill: Number(!breakpoint ? currSkill[1] : row2[2][14]),
                        mastery: Number(!breakpoint ? currSkill[3] : row2[2][16]),
                        breakpoint: breakpoint,
                        story: !breakpoint ? row2[2] ?? 'N/A' : 'N/A',
                        advanced: !breakpoint ? row2[5].length ? row2[5] : row2[4] ?? 'N/A' : 'N/A',
                        rating: [row2[2], row2[5]].reduce((acc, mastery) => acc + Math.max(0, ratingScale.indexOf(mastery)), 0)
                    };

                    getOpRating(currOpId).masteries.push(currMastery);
                    masteryRatingDict[`${currMastery.operator}_${currMastery.skill}_${currMastery.mastery}`] = currMastery;
                }
            }
        }
    }

    console.info('Mastery ratings loaded.');
}

async function loadModuleRatings() {
    const moduleSheetId = '1A0_0XTAcDDtHkvyAwjTqEEzM8cf5h3E60u23ZVXw4eg'
    const moduleSheetGid = '0';

    console.info('Loading module ratings...');

    const url = `${proxyUrl}/sheet?id=${moduleSheetId}&gid=${moduleSheetGid}`;
    const response = await fetch(url).then(response => response.text());
    const moduleSheet = JSON.parse(response.substring(47).slice(0, -2));

    for (let i = 2; i < moduleSheet.table.rows.length; i++) {
        const row = moduleSheet.table.rows[i].c.map((e: any) => e?.v ?? '');

        if (!row || row.filter((e: any) => e !== '').length != 10)
            continue;

        for (let j = 0; j < row.length; j++) {
            row[j] = clean(row[j]);
        }

        const nameOverride: { [key: string]: string } = {
            'Pozyomka': 'Pozemka',
            'Qiu Bai': 'Qiubai',
            'Togawa Sakiko': 'Sakiko Togawa',
            'Chen Alter2': 'Chen the Dawnstreak'
        }
        const currOpName = clean(nameOverride[row[0]]) ?? clean(row[0]);

        let currOp;
        try {
            currOp = ops.find(op => op.keys.includes(currOpName.toLowerCase())).value;
        } catch (e) {
            console.error(`Module: operator ${currOpName} not found`);
            continue;
        }
        if (!currOp) {
            console.error(`Module: operator ${currOpName} not found`);
            continue;
        }
        if (currOp.modules.length === 0) {
            console.error(`Module: operator ${currOpName} has no modules`);
            continue;
        }

        const moduleNameMap: { [key: string]: string } = { 'X': 'X', 'Y': 'Y', 'Δ': 'D' }
        const currModuleId = currOp.modules.find((m: any) => m.info.typeName2 === moduleNameMap[row[2]])?.info.uniEquipId;

        if (!currModuleId) {
            console.error(`Module: module ${row[2]} for ${currOpName} not found`);
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

    console.info('Module ratings loaded.');
}

async function loadOperatorRatings() {
    const operatorSheetId = '1E7HmgKWiV8pKpJpvpVzziYxnaQTP01Vtw_PXEdL7XPA';
    const operatorSheetGid = '1108925005';

    console.info('Loading operator ratings...');

    const url = `${proxyUrl}/sheet?id=${operatorSheetId}&gid=${operatorSheetGid}`;
    const response = await fetch(url).then(response => response.text());
    const operatorSheet = JSON.parse(response.substring(47).slice(0, -2));

    let currRating = 'EX';
    for (let i = 2; i < operatorSheet.table.rows.length; i++) {
        const row = operatorSheet.table.rows[i].c.map((e: any) => e?.v ?? '');

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

            const fixName = (name: string) => {
                const nameOverride: { [key: string]: string } = {
                    'Reed the Flameshadow': 'Reed the Flame Shadow',
                    'Fiametta': 'Fiammetta',
                    'Лето Leto': 'Leto',
                    'Sussuro': 'Sussurro',
                    'Waii Fu': 'Waai Fu'
                }
                name = name.endsWith(' General') ? name.slice(0, -8) : name;
                return nameOverride[name] ?? name;
            }

            const currOpName = clean(fixName(row[j])) ?? clean(row[j]);
            let currOp;
            try {
                currOp = ops.find(op => op.keys.includes(currOpName.toLowerCase())).value;
            }
            catch (e) {
                console.error(`Operator: operator ${currOpName} not found`);
                continue;
            }
            if (!currOp) {
                console.error(`Operator: operator ${currOpName} not found`,);
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

async function loadKrooster(username: string) {
    try {
        const userAccount = (await (await fetch(`${proxyUrl}/krooster_accounts?username=${username}`)).json())[0];
        const userId = userAccount.user_id;
        const userOps: KroosterOperator[] = await (await fetch(`${proxyUrl}/krooster_operators?userId=${userId}`)).json();

        return { userAccount, userOps };
    } catch (e) {
        return { userAccount: null, userOps: null };
    }
}

type Row = { id: string } & Record<string, any>;

type Column = {
    field?: string;
    operator?: boolean;
};

const AVATAR: Column = { operator: true };

const skillLevelRating: Column[] = [AVATAR, { field: 'skill' }, { field: 'level' }, { field: 'rating' }];
const skillUpgradeRating: Column[] = [AVATAR, { field: 'skill' }, { field: 'upgrade' }, { field: 'rating' }];
const symbolLevelRating: Column[] = [AVATAR, { field: 'symbol' }, { field: 'level' }, { field: 'rating' }];
const symbolUpgradeRating: Column[] = [AVATAR, { field: 'symbol' }, { field: 'upgrade' }, { field: 'rating' }];
const skillLevel: Column[] = [AVATAR, { field: 'skill' }, { field: 'level' }];
const skillUpgrade: Column[] = [AVATAR, { field: 'skill' }, { field: 'upgrade' }];
const tier: Column[] = [AVATAR, { field: 'tier' }];

function renderTable(tableId: string, cols: Column[], rows: Row[]) {
    const table = byId(tableId);
    table.innerHTML = '';
    for (const row of rows) {
        const tr = document.createElement('tr');
        for (const col of cols) {
            const td = document.createElement('td');
            if (col.operator) {
                td.classList.add('operator');
                const img = document.createElement('img');
                img.src = `https://raw.githubusercontent.com/Awedtan/HellaAssets/refs/heads/main/operator/avatars/${row.id}.png`;
                img.alt = row.name;
                const span = document.createElement('span');
                span.textContent = row.name;
                td.append(img, span);
            } else {
                const pre = document.createElement('pre');
                pre.textContent = row[col.field ?? ''];
                td.appendChild(pre);
            }
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
}

function renderOperatorLookup(op: OverallRating) {
    renderTable('opMasteryTable', skillLevelRating, op.masteries
        .filter(mastery => !mastery.breakpoint)
        .map(mastery => ({
            id: mastery.operator,
            name: overallRatingDict[mastery.operator].name,
            skill: `S${mastery.skill}`,
            level: `M${mastery.mastery}`,
            rating: `${mastery.story.padEnd(4)}/ ${mastery.advanced.padEnd(3)}`,
        })));

    renderTable('opBreakpointTable', skillLevel, op.masteries
        .filter(mastery => mastery.breakpoint)
        .map(mastery => ({
            id: mastery.operator,
            name: overallRatingDict[mastery.operator].name,
            skill: `S${mastery.skill}`,
            level: `M${mastery.mastery}`,
        })));

    renderTable('opModuleTable', symbolLevelRating, op.modules
        .map(module => ({
            id: module.operator,
            name: overallRatingDict[module.operator].name,
            symbol: module.symbol,
            level: `L${module.level}`,
            rating: `${module.moduleRating.padEnd(3)}/ ${module.improveChar.padEnd(3)}/ ${module.priority.padEnd(2)}`,
        })));

    renderTable('opUnownedTable', tier, [{ id: op.id, name: op.name, tier: op.operator.tier.padEnd(2) }]);
}

function setLimit(limit: number) {
    currentLimit = limit;
    if (currentUserOps) renderAccountOverview(currentUserOps, limit);
}

async function opOnClick() {
    ['opMasteryTable', 'opBreakpointTable', 'opModuleTable', 'opUnownedTable'].forEach(e => byId(e).innerHTML = '');

    const operatorName = (byId('opInput') as HTMLInputElement).value;
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

    renderOperatorLookup(op);
}

async function userOnClick() {
    const elements = ['masteryTable', 'breakpointTable', 'moduleTable', 'unownedTable'];
    elements.forEach((e: any) => byId(e).innerHTML = '');

    const username = (byId('userInput') as HTMLInputElement).value;

    if (!username)
        return;

    try {
        const { userAccount, userOps } = await loadKrooster(username);
        if (!userAccount || !userOps) {
            alert(`User not found: ${username}`);
            return;
        }
        currentUserOps = userOps;
        renderAccountOverview(userOps, currentLimit);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

function renderAccountOverview(userOps: KroosterOperator[], limit: number) {
    renderTable('masteryTable', skillUpgradeRating, sortedMasteries
        .filter(mastery => {
            const userOp = userOps.find(op => op.op_id === mastery.operator);
            return userOp && userOp.masteries[mastery.skill - 1] < mastery.mastery;
        })
        .slice(0, limit)
        .map(mastery => ({
            id: mastery.operator,
            name: overallRatingDict[mastery.operator].name,
            skill: `S${mastery.skill}`,
            upgrade: `M${userOps.find(op => op.op_id === mastery.operator)?.masteries[mastery.skill - 1]} > M${mastery.mastery}`,
            rating: `${mastery.story.padEnd(4)}/ ${mastery.advanced.padEnd(3)}`,
        })));

    renderTable('breakpointTable', skillUpgrade, sortedMasteries
        .filter(mastery => {
            const userOp = userOps.find(op => op.op_id === mastery.operator);
            return userOp && userOp.elite === 2 && userOp.masteries[mastery.skill - 1] < mastery.mastery && mastery.breakpoint;
        })
        .slice(0, limit)
        .map(mastery => ({
            id: mastery.operator,
            name: overallRatingDict[mastery.operator].name,
            skill: `S${mastery.skill}`,
            upgrade: `M${userOps.find(op => op.op_id === mastery.operator)?.masteries[mastery.skill - 1]} > M${mastery.mastery}`,
        })));

    renderTable('moduleTable', symbolUpgradeRating, sortedModules
        .filter(module => {
            const userOp = userOps.find(op => op.op_id === module.operator);
            return userOp && userOp.modules[module.module] < module.level;
        })
        .slice(0, limit)
        .map(module => ({
            id: module.operator,
            name: overallRatingDict[module.operator].name,
            symbol: module.symbol,
            upgrade: `L${userOps.find(op => op.op_id === module.operator)?.modules[module.module]} > L${module.level}`,
            rating: `${module.moduleRating.padEnd(3)}/ ${module.improveChar.padEnd(3)}/ ${module.priority.padEnd(2)}`,
        })));

    renderTable('unleveledTable', tier, sortedOperators
        .filter(operator => userOps.some(op => op.op_id === operator.operator && op.elite !== 2))
        .slice(0, limit)
        .map(operator => ({
            id: operator.operator,
            name: overallRatingDict[operator.operator].name,
            tier: operator.tier.padEnd(2),
        })));

    renderTable('unownedTable', tier, sortedOperators
        .filter(operator => !userOps.some(op => op.op_id === operator.operator))
        .slice(0, limit)
        .map(operator => ({
            id: operator.operator,
            name: overallRatingDict[operator.operator].name,
            tier: operator.tier.padEnd(2),
        })));
}

document.addEventListener('DOMContentLoaded', async function () {
    console.info('Loading operator data...');
    ops = await (await fetch(`${hellaApi}/operator?include=id&include=modules`)).json();
    await Promise.all([
        loadMasteryRatings(),
        loadModuleRatings(),
        loadOperatorRatings()
    ]);
    console.info('Data successfully loaded.');
    sortedMasteries = Object.values(masteryRatingDict).sort((a, b) => b.rating - a.rating);
    sortedModules = Object.values(moduleRatingDict).sort((a, b) => b.rating - a.rating);
    sortedOperators = Object.values(operatorRatingDict).sort((a, b) => b.rating - a.rating);

    byId('opInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            byId('opSubmitBtn').click();
        }
    });
    byId('opInput').removeAttribute('disabled');
    byId('opSubmitBtn').addEventListener('click', opOnClick);
    byId('opSubmitBtn').removeAttribute('disabled');

    byId('userInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            byId('userSubmitBtn').click();
        }
    });
    byId('userInput').removeAttribute('disabled');
    byId('userSubmitBtn').addEventListener('click', userOnClick);
    byId('userSubmitBtn').removeAttribute('disabled');

    byId('limit5').addEventListener('click', () => setLimit(5));
    byId('limit15').addEventListener('click', () => setLimit(15));
    byId('limit30').addEventListener('click', () => setLimit(30));
});
