import * as T from 'hella-types';

/**
 * User-specific operator data as provided by Krooster.
 */
type KroosterOperator = {
    /**
     * Krooster user ID.
     */
    user_id: string;
    /**
     * Operator ID.
     */
    op_id: string;
    /**
     * If the operator is favourited on Krooster.
     */
    favorite: boolean;
    /**
     * Operator's attained elite level.
     * Value ranges from 0 to 2.
     */
    elite: number;
    /**
     * Operator's attained level.
     * Value ranges from 1 to 90.
     */
    level: number;
    /**
     * Operator's attained skill level.
     * Value ranges from 1 to 7.
     */
    skill_level: number;
    /**
     * Array of operator's attained per-skill mastery levels.
     * Length ranges from 0 to 3. Values range from 0 to 3.
     */
    masteries: number[];
    /**
     * Record of operator's attained per-module levels.
     * Size is 0 or greater. Keys are module IDs. Values range from 0 to 3.
     */
    modules: Record<string, number>;
    /**
     * Operator's attained potential level.
     * Value ranges from 1 to 6.
     */
    potential: number;
    /**
     * Current skin ID.
     */
    skin: string;
}

/**
 * Collection of all ratings associated with an operator.
 */
type OverallRating = {
    /**
     * Operator ID.
     */
    id: string;
    /**
     * Operator name.
     */
    name: string;
    /**
     * Operator's mastery writeup.
     */
    masteryDesc: string;
    /**
     * Operator's rated masteries.
     */
    masteries: MasteryRating[];
    /**
     * Operator's rated modules.
     */
    modules: ModuleRating[];
    /**
     * Operator rating.
     */
    operator: OperatorRating;
};

/**
 * Mastery ratings as provided by TacticalBreakfast.
 * Skills may have multiple ratings for different mastery levels.
 */
type MasteryRating = {
    /**
     * Operator ID.
     */
    operator: string;
    /**
     * Operator's skill number.
     * Ranges from 1 to 3.
     */
    skill: number;
    /**
     * Skill's mastery level.
     * Ranges from 1 to 3.
     */
    mastery: number;
    /**
     * If this rating is a breakpoint.
     */
    breakpoint: boolean;
    /**
     * Story content rating.
     * Ranges from `None` to `S++`.
     */
    story: string;
    /**
     * Advanced content rating.
     * Ranges from `None` to `S++`.
     */
    advanced: string;
    /**
     * Sum of story and advanced ratings indicies in `ratingScale`.
     */
    rating: number;
};

/**
 * Module ratings as provided by DragonGJY.
 * Each module may only have one rating.
 */
type ModuleRating = {
    /**
     * Operator ID.
     */
    operator: string;
    /**
     * Module ID.
     */
    module: string;
    /**
     * Module symbol (eg. `X`, `Δ`).
     */
    symbol: string;
    /**
     * Module 'Pros' + 'Cons'.
     */
    description: string;
    /** Module's individual rating.
     * Ranges from `C` to `S`.
     */
    moduleRating: string;
    /** Module's improvement to character.
     * Ranges from `C` to `S`.
     */
    improveChar: string;
    /**
     * Recommended module level.
     * Value ranges from 0 to 3.
     */
    level: number;
    /** Module's upgrade priority.
     * Ranges from `C` to `S`.
     */
    priority: string;
    /**
     * Module upgrade priority rating's index in `ratingScale`.
     */
    rating: number;
}

/**
 * Operator ratings as provided by TacticalBreakfast.
 * Each operator may only have one rating. TODO: add separate IS ratings?
 */
type OperatorRating = {
    /**
     * Operator ID.
     */
    operator: string;
    /**
     * Operator rating.
     * Ranges from `F` to `EX`.
     */
    tier: string;
    /**
     * Operator rating's index in `ratingScale`.
     */
    rating: number;
}

const hellaApi = 'https://awedtan.ca/api';
const proxyUrl = 'https://awedtan.ca/upgrade-viewer/proxy';

const ratingScale = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S-', 'S', 'S+', 'S++', 'EX'];

type Row = { id: string } & Record<string, any>;

type Column = {
    field?: string;
    operator?: boolean;
};

const skillLevelRating: Column[] = [{ operator: true }, { field: 'skill' }, { field: 'level' }, { field: 'rating' }];
const skillUpgradeRating: Column[] = [{ operator: true }, { field: 'skill' }, { field: 'upgrade' }, { field: 'rating' }];
const symbolLevelRating: Column[] = [{ operator: true }, { field: 'symbol' }, { field: 'level' }, { field: 'rating' }];
const symbolUpgradeRating: Column[] = [{ operator: true }, { field: 'symbol' }, { field: 'upgrade' }, { field: 'rating' }];
const skillLevel: Column[] = [{ operator: true }, { field: 'skill' }, { field: 'level' }];
const skillUpgrade: Column[] = [{ operator: true }, { field: 'skill' }, { field: 'upgrade' }];
const tier: Column[] = [{ operator: true }, { field: 'tier' }];
const investment: Column[] = [{ operator: true }, { field: 'tier' }, { field: 'level' }, { field: 'masteries' }, { field: 'modules' }];

type OpRes = {
    _id: string;
    meta: any;
    keys: string[];
    canon: string;
    value: T.Operator;
}

let ops: OpRes[];
const overallRatings = new Map<string, OverallRating>();
const masteryRatings = new Map<string, MasteryRating>();
const moduleRatings = new Map<string, ModuleRating>();
const operatorRatings = new Map<string, OperatorRating>();

let sortedMasteries: MasteryRating[];
let sortedModules: ModuleRating[];
let sortedOperators: OperatorRating[];

const initialLimit = 5;
let upgradeLimit = initialLimit;
let operatorLimit = initialLimit;
let investmentLimit = initialLimit;
let currentUserOps: KroosterOperator[] | null = null;

const clean = (str: string) => str?.replace(/['-*()]/g, '').replace(/[\n]/g, ' ').trim() ?? null;

function getById(id: string): HTMLElement {
    const elem = document.getElementById(id);
    if (!elem) throw new Error(`Missing element with id: ${id}`);
    return elem as HTMLElement;
}

function getOverallRating(opId: string, opName: string = ''): OverallRating {
    if (!overallRatings.get(opId)) {
        overallRatings.set(opId, {
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
        });
    }
    return overallRatings.get(opId) as OverallRating;
}

function renderTable(tableId: string, cols: Column[], rows: Row[]) {
    const table = getById(tableId);
    table.innerHTML = '';
    for (const row of rows) {
        const tr = document.createElement('tr');
        for (const col of cols) {
            const td = document.createElement('td');
            if (col.operator) {
                td.classList.add('operator');
                const img = document.createElement('img');
                const avatar = row.id === 'char_1037_amiya3' ? 'char_1037_amiya3_2' : row.id;
                img.src = `https://raw.githubusercontent.com/Awedtan/HellaAssets/refs/heads/main/operator/avatars/${avatar}.png`;
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

function renderUpgradeTables(userOps: KroosterOperator[]) {
    renderTable('masteryTable', skillUpgradeRating, sortedMasteries
        .filter(mastery => {
            const userOp = userOps.find(op => op.op_id === mastery.operator);
            return userOp && userOp.masteries[mastery.skill - 1] < mastery.mastery;
        })
        .slice(0, upgradeLimit)
        .map(mastery => ({
            id: mastery.operator,
            name: getOverallRating(mastery.operator).name,
            skill: `S${mastery.skill}`,
            upgrade: `M${userOps.find(op => op.op_id === mastery.operator)?.masteries[mastery.skill - 1]} > M${mastery.mastery}`,
            rating: `${mastery.story.padEnd(4)}/ ${mastery.advanced.padEnd(3)}`,
        })));

    renderTable('breakpointTable', skillUpgrade, sortedMasteries
        .filter(mastery => {
            const userOp = userOps.find(op => op.op_id === mastery.operator);
            return userOp && userOp.elite === 2 && userOp.masteries[mastery.skill - 1] < mastery.mastery && mastery.breakpoint;
        })
        .slice(0, upgradeLimit)
        .map(mastery => ({
            id: mastery.operator,
            name: getOverallRating(mastery.operator).name,
            skill: `S${mastery.skill}`,
            upgrade: `M${userOps.find(op => op.op_id === mastery.operator)?.masteries[mastery.skill - 1]} > M${mastery.mastery}`,
        })));

    renderTable('moduleTable', symbolUpgradeRating, sortedModules
        .filter(module => {
            const userOp = userOps.find(op => op.op_id === module.operator);
            return userOp && userOp.modules[module.module] < module.level;
        })
        .slice(0, upgradeLimit)
        .map(module => ({
            id: module.operator,
            name: getOverallRating(module.operator).name,
            symbol: module.symbol,
            upgrade: `L${userOps.find(op => op.op_id === module.operator)?.modules[module.module]} > L${module.level}`,
            rating: `${module.moduleRating.padEnd(3)}/ ${module.improveChar.padEnd(3)}/ ${module.priority.padEnd(2)}`,
        })));
}

function renderOperatorTables(userOps: KroosterOperator[]) {
    renderTable('unleveledTable', tier, sortedOperators
        .filter(operator => userOps.some(op => op.op_id === operator.operator && op.elite !== 2))
        .slice(0, operatorLimit)
        .map(operator => ({
            id: operator.operator,
            name: getOverallRating(operator.operator).name,
            tier: operator.tier.padEnd(2),
        })));

    renderTable('unownedTable', tier, sortedOperators
        .filter(operator => !userOps.some(op => op.op_id === operator.operator))
        .slice(0, operatorLimit)
        .map(operator => ({
            id: operator.operator,
            name: getOverallRating(operator.operator).name,
            tier: operator.tier.padEnd(2),
        })));
}

function renderInvestmentTables(userOps: KroosterOperator[]) {
    const ratedUserOps = userOps.filter(op => operatorRatings.has(op.op_id));
    const rank: { [key: string]: number } = { X: 0, Y: 1, D: 2 };

    const investmentRow = (op: KroosterOperator): Row => ({
        id: op.op_id,
        name: getOverallRating(op.op_id).name,
        tier: operatorRatings.get(op.op_id)?.tier.padEnd(2),
        level: `E${op.elite} L${op.level}`,
        masteries: [0, 1, 2]
            .map(i => (op.masteries[i] ?? 0) > 0 ? `S${i + 1} M${op.masteries[i]}` : `S${i + 1} L${op.skill_level}`).join('\n'),
        modules: Object.entries(op.modules)
            .map(([id, level]) => {
                const typeName2 = ops.find(e => e.value.id === op.op_id)?.value?.modules?.find((m: any) => m.info.uniEquipId === id)?.info.typeName2 ?? '???';
                return { symbol: typeName2 === 'D' ? 'Δ' : (typeName2 ?? id), level, rank: rank[typeName2] ?? 9 };
            })
            .sort((a, b) => a.rank - b.rank)
            .map(m => `${m.symbol} L${m.level}`)
            .join('\n'),
    });

    renderTable('goodTable', investment, [...ratedUserOps]
        .sort((a, b) => goodInvest(b) - goodInvest(a))
        .slice(0, investmentLimit).map(investmentRow));
    renderTable('badTable', investment, [...ratedUserOps]
        .sort((a, b) => badInvest(a) - badInvest(b))
        .slice(0, investmentLimit).map(investmentRow));
}

const maxRatingIndex = ratingScale.length - 1;

const investmentWeights = { A: 1, B: 1 / 3, C: 1 / 3 };

function skillMasteryRating(opId: string, skill: number, mastery: number) {
    // normalized 0..1 rating for a skill at a given mastery level; the exact (skill, mastery) row wins, then the nearest rated mastery; a skill with no rated masteries gets the worst rating (F -> 0)
    const rated = getOverallRating(opId).masteries.filter(m => m.skill === skill && !m.breakpoint);
    const exact = rated.find(m => m.mastery === mastery);
    if (exact)
        return exact.rating / (2 * maxRatingIndex);
    if (rated.length)
        return rated.sort((a, b) => Math.abs(a.mastery - mastery) - Math.abs(b.mastery - mastery))[0].rating / (2 * maxRatingIndex);
    return 0;
}

function moduleRating(opId: string, moduleId: string) {
    // normalized 0..1 rating, or null if the module is unrated (unrated modules are ignored)
    const module = moduleRatings.get(moduleId);
    return module ? module.rating / maxRatingIndex : null;
}

function goodInvest(op: KroosterOperator) {
    const { A, B, C } = investmentWeights;
    const opRating = operatorRatings.get(op.op_id)?.rating ?? 0 / maxRatingIndex;
    const opLevel = (op.level - 1) / 89;
    const skillSum = [1, 2, 3].map(skill => {
        const mastery = op.masteries[skill - 1] ?? 0; // L7 = 0, M3 = 1
        return skillMasteryRating(op.op_id, skill, mastery) * (mastery / 3);
    }).reduce((a, b) => a + b, 0);
    const moduleSum = Object.entries(op.modules).reduce((acc, [id, level]) => {
        const rating = moduleRating(op.op_id, id);
        return rating === null ? acc : acc + rating * (level / 3); // L0 = 0, L3 = 1
    }, 0);
    return A * (opRating * opLevel) + B * skillSum + C * moduleSum;
}

function badInvest(op: KroosterOperator) {
    const { A, B, C } = investmentWeights;
    const opRating = 1 - (operatorRatings.get(op.op_id)?.rating ?? 0) / maxRatingIndex;
    const opLevel = (op.level - 1) / 89;
    const skillSum = [1, 2, 3].map(skill => {
        const mastery = op.masteries[skill - 1] ?? 0;
        return (1 - skillMasteryRating(op.op_id, skill, mastery)) * (mastery / 3);
    }).reduce((a, b) => a + b, 0);
    const moduleSum = Object.entries(op.modules).reduce((acc, [id, level]) => {
        const rating = moduleRating(op.op_id, id);
        return rating === null ? acc : acc + (1 - rating) * (level / 3);
    }, 0);
    return -(A * (opRating * opLevel) + B * skillSum + C * moduleSum);
}

async function opOnClick() {
    const operatorName = (getById('opInput') as HTMLInputElement).value;
    if (!operatorName)
        return;
    try {
        const operator = ops.find(op => op.keys.includes(operatorName.toLowerCase()));
        if (!operator)
            throw new Error('Operator not found.');
        const op = getOverallRating(operator.value.id, operatorName);
        if (!op)
            throw new Error('Operator rating not found.');

        ['opMasteryTable', 'opBreakpointTable', 'opModuleTable', 'opRatingTable']
            .forEach(e => getById(e).innerHTML = '');

        renderTable('opMasteryTable', skillLevelRating, op.masteries
            .filter(mastery => !mastery.breakpoint)
            .map(mastery => ({
                id: mastery.operator,
                name: op.name,
                skill: `S${mastery.skill}`,
                level: `M${mastery.mastery}`,
                rating: `${mastery.story.padEnd(4)}/ ${mastery.advanced.padEnd(3)}`,
            })));

        renderTable('opBreakpointTable', skillLevel, op.masteries
            .filter(mastery => mastery.breakpoint)
            .map(mastery => ({
                id: mastery.operator,
                name: op.name,
                skill: `S${mastery.skill}`,
                level: `M${mastery.mastery}`,
            })));

        renderTable('opModuleTable', symbolLevelRating, op.modules
            .map(module => ({
                id: module.operator,
                name: op.name,
                symbol: module.symbol,
                level: `L${module.level}`,
                rating: `${module.moduleRating.padEnd(3)}/ ${module.improveChar.padEnd(3)}/ ${module.priority.padEnd(2)}`,
            })));

        renderTable('opRatingTable', tier, [{ id: op.id, name: op.name, tier: op.operator.tier.padEnd(2) }]);
    } catch (e) {
        alert(`Operator not found: ${operatorName}`);
        console.error('Operator: ', e);
    }
}

async function userOnClick() {
    const username = (getById('userInput') as HTMLInputElement).value;
    if (!username)
        return;
    try {
        const userAccount = (await (await fetch(`${proxyUrl}/krooster_accounts?username=${username}`)).json())[0];
        if (!userAccount)
            throw new Error('User account not found.');
        const userOps: KroosterOperator[] = await (await fetch(`${proxyUrl}/krooster_operators?userId=${userAccount.user_id}`)).json();
        if (!userOps)
            throw new Error('User\'s operators not found.');

        ['masteryTable', 'breakpointTable', 'moduleTable', 'unleveledTable', 'unownedTable', 'goodTable', 'badTable']
            .forEach((e: any) => getById(e).innerHTML = '');

        currentUserOps = userOps;
        renderUpgradeTables(userOps);
        renderOperatorTables(userOps);
        renderInvestmentTables(userOps);
    } catch (e) {
        alert(`User not found: ${username}`);
        console.error('User: ', e);
    }
}

function setUpgradeLimit(limit: number) {
    upgradeLimit = limit;
    if (currentUserOps) renderUpgradeTables(currentUserOps);
}

function setOperatorLimit(limit: number) {
    operatorLimit = limit;
    if (currentUserOps) renderOperatorTables(currentUserOps);
}

function setInvestmentLimit(limit: number) {
    investmentLimit = limit;
    if (currentUserOps) renderInvestmentTables(currentUserOps);
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

    let currOpId;
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

                currOpId = ops.find((e: any) => e.keys.includes(currOpName.toLowerCase()))?.value.id;
                if (!currOpId) {
                    console.error(`Mastery: operator ${currOpName} not found`);
                    continue;
                }

                getOverallRating(currOpId, currOpName).masteryDesc = row[9] ?? 'N/A';

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
                        story: !breakpoint ? clean(row2[2]) ?? 'N/A' : 'N/A',
                        advanced: !breakpoint ? clean(row2[5].length ? row2[5] : row2[4]) ?? 'N/A' : 'N/A',
                        rating: [clean(row2[2]), clean(row2[5])].reduce((acc, mastery) => acc + Math.max(0, ratingScale.indexOf(mastery)), 0)
                    };

                    getOverallRating(currOpId).masteries.push(currMastery);
                    masteryRatings.set(`${currMastery.operator}_${currMastery.skill}_${currMastery.mastery}`, currMastery);
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

        let currOp = ops.find(op => op.keys.includes(currOpName.toLowerCase()))?.value;
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

        getOverallRating(currOp.id, currOpName).modules.push(currModule);
        moduleRatings.set(currModule.module, currModule);
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
            let currOp = ops.find(op => op.keys.includes(currOpName.toLowerCase()))?.value;
            if (!currOp) {
                console.error(`Operator: operator ${currOpName} not found`,);
                continue;
            }

            const currOpRating = {
                operator: currOp.id,
                tier: currRating,
                rating: Math.max(0, ratingScale.indexOf(currRating))
            };
            getOverallRating(currOp.id, currOpName).operator = currOpRating;
            operatorRatings.set(currOp.id, currOpRating)
        }
    }
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
    sortedMasteries = masteryRatings.values().toArray().sort((a, b) => b.rating - a.rating);
    sortedModules = moduleRatings.values().toArray().sort((a, b) => b.rating - a.rating);
    sortedOperators = operatorRatings.values().toArray().sort((a, b) => b.rating - a.rating);

    getById('opInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            getById('opSubmitBtn').click();
        }
    });
    getById('opInput').removeAttribute('disabled');
    getById('opSubmitBtn').addEventListener('click', opOnClick);
    getById('opSubmitBtn').removeAttribute('disabled');

    getById('userInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            getById('userSubmitBtn').click();
        }
    });
    getById('userInput').removeAttribute('disabled');
    getById('userSubmitBtn').addEventListener('click', userOnClick);
    getById('userSubmitBtn').removeAttribute('disabled');

    getById('upgradeLimit5').addEventListener('click', () => setUpgradeLimit(5));
    getById('upgradeLimit15').addEventListener('click', () => setUpgradeLimit(15));
    getById('upgradeLimit30').addEventListener('click', () => setUpgradeLimit(30));
    getById('operatorLimit5').addEventListener('click', () => setOperatorLimit(5));
    getById('operatorLimit15').addEventListener('click', () => setOperatorLimit(15));
    getById('operatorLimit30').addEventListener('click', () => setOperatorLimit(30));
    getById('investmentLimit5').addEventListener('click', () => setInvestmentLimit(5));
    getById('investmentLimit15').addEventListener('click', () => setInvestmentLimit(15));
    getById('investmentLimit30').addEventListener('click', () => setInvestmentLimit(30));
});
