"use strict";
const hellaApi = 'https://awedtan.ca/api';
const proxyUrl = 'https://awedtan.ca/upgrade-viewer/proxy';
// for masteries, sort them by rating = story+advanced
// for modules, sort them by priority
const ratingScale = ['F', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S-', 'S', 'S+', 'S++', 'EX'];
const suggestionsLimit = 15;
let ops;
let overallRatingDict = {};
let masteryRatingDict = {};
let moduleRatingDict = {};
let operatorRatingDict = {};
const clean = (str) => str?.replace(/['-*()]/g, '').replace(/[\n]/g, ' ').trim() ?? null;
function byId(id) {
    const elem = document.getElementById(id);
    if (!elem)
        throw new Error(`Missing element with id: ${id}`);
    return elem;
}
function getOpRating(opId, opName = '') {
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
    const masterySheetId = '1iJF12O6QOba1dlUVmobwvc1eBZE7FRB6-tKxmZEcG1I';
    const masterySheetGids = [
        1974758696, // latest
        122346402, // vanguard
        1866092508, // guard
        1415267055, // defender
        730977758, // sniper
        1966952250, // caster
        1102114684, // medic
        638719893, // supporter
        1272513614, // specialist
    ];
    console.info('Loading mastery ratings...');
    const urls = masterySheetGids.map(gid => `${proxyUrl}/sheet?id=${masterySheetId}&gid=${gid}`);
    const responses = (await Promise.all(urls.map(url => fetch(url).then(response => response.text()))));
    const masterySheets = responses.map(data => JSON.parse(data.substring(47).slice(0, -2)));
    let currOpId = '';
    for (const sheet of masterySheets) {
        for (let i = 2; i < sheet.table.rows.length; i++) {
            const row = sheet.table.rows[i].c.map((e) => e?.v ?? '');
            if (!row || row.filter((e) => e !== '').length < 2 || ["Skill", "Full Article"].includes(row[0]) || (row[0][0] === 'S' && row[0][2] === 'M'))
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
                };
                const currOpName = clean(nameOverride[row[0]]) ?? clean(row[0]);
                try {
                    currOpId = ops.find((e) => e.keys.includes(currOpName.toLowerCase())).value.id;
                }
                catch (e) {
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
                    const row2 = sheet.table.rows[j].c.map((e) => e?.v ?? '');
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
                    const currMastery = {
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
    const moduleSheetId = '1A0_0XTAcDDtHkvyAwjTqEEzM8cf5h3E60u23ZVXw4eg';
    const moduleSheetGid = '0';
    console.info('Loading module ratings...');
    const url = `${proxyUrl}/sheet?id=${moduleSheetId}&gid=${moduleSheetGid}`;
    const response = await fetch(url).then(response => response.text());
    const moduleSheet = JSON.parse(response.substring(47).slice(0, -2));
    for (let i = 2; i < moduleSheet.table.rows.length; i++) {
        const row = moduleSheet.table.rows[i].c.map((e) => e?.v ?? '');
        if (!row || row.filter((e) => e !== '').length != 10)
            continue;
        for (let j = 0; j < row.length; j++) {
            row[j] = clean(row[j]);
        }
        const nameOverride = {
            'Pozyomka': 'Pozemka',
            'Qiu Bai': 'Qiubai',
            'Togawa Sakiko': 'Sakiko Togawa',
            'Chen Alter2': 'Chen the Dawnstreak'
        };
        const currOpName = clean(nameOverride[row[0]]) ?? clean(row[0]);
        let currOp;
        try {
            currOp = ops.find(op => op.keys.includes(currOpName.toLowerCase())).value;
        }
        catch (e) {
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
        const moduleNameMap = { 'X': 'X', 'Y': 'Y', 'Δ': 'D' };
        const currModuleId = currOp.modules.find((m) => m.info.typeName2 === moduleNameMap[row[2]])?.info.uniEquipId;
        if (!currModuleId) {
            console.error(`Module: module ${row[2]} for ${currOpName} not found`);
            continue;
        }
        const currModule = {
            operator: currOp.id,
            module: currModuleId,
            symbol: row[2],
            description: row[8] + '\n' + row[9],
            moduleRating: row[4],
            improveChar: row[5],
            level: Number(row[6].split(' ')[1][0]),
            priority: row[7],
            rating: Math.max(0, ratingScale.indexOf(row[7])),
        };
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
        const row = operatorSheet.table.rows[i].c.map((e) => e?.v ?? '');
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
            const fixName = (name) => {
                const nameOverride = {
                    'Reed the Flameshadow': 'Reed the Flame Shadow',
                    'Fiametta': 'Fiammetta',
                    'Лето Leto': 'Leto',
                    'Sussuro': 'Sussurro',
                    'Waii Fu': 'Waai Fu'
                };
                name = name.endsWith(' General') ? name.slice(0, -8) : name;
                return nameOverride[name] ?? name;
            };
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
                console.error(`Operator: operator ${currOpName} not found`);
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
        const userOps = await (await fetch(`${proxyUrl}/krooster_operators?userId=${userId}`)).json();
        return { userAccount, userOps };
    }
    catch (e) {
        return { userAccount: null, userOps: null };
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
    const sortedMasteries = Object.values(masteryRatingDict).sort((a, b) => b.rating - a.rating);
    const sortedModules = Object.values(moduleRatingDict).sort((a, b) => b.rating - a.rating);
    const sortedOperators = Object.values(operatorRatingDict).sort((a, b) => b.rating - a.rating);
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
    function populateTable(tableId, data) {
        const table = byId(tableId);
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
        elements.forEach((e) => byId(e).innerHTML = '');
        const operatorName = byId('opInput').value;
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
                    mastery: `M${mastery.mastery}`,
                    rating: `${mastery.story.padEnd(4)}/ ${mastery.advanced.padEnd(3)}`,
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
                    level: `L${module.level}`,
                    rating: `${module.moduleRating.padEnd(3)}/ ${module.improveChar.padEnd(3)}/ ${module.priority.padEnd(2)}`,
                }
            }));
            populateTable('opModuleTable', ratedModules);
            const ratedOperators = [{ id: op.id, values: { operator: `${op.name}`, tier: `${op.operator.tier.padEnd(2)}` } }];
            populateTable('opUnownedTable', ratedOperators);
        }
        catch (error) {
            console.error('An error occurred:', error);
        }
    }
    async function userOnClick() {
        const elements = ['masteryTable', 'breakpointTable', 'moduleTable', 'unownedTable'];
        elements.forEach((e) => byId(e).innerHTML = '');
        const username = byId('userInput').value;
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
                    mastery: `M${userOps.find(op => op.op_id === mastery.operator)?.masteries[mastery.skill - 1]} > M${mastery.mastery}`,
                    rating: `${mastery.story.padEnd(4)}/ ${mastery.advanced.padEnd(3)}`,
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
                    mastery: `M${userOps.find(op => op.op_id === mastery.operator)?.masteries[mastery.skill - 1]} > M${mastery.mastery}`
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
                    level: `L${userOps.find(op => op.op_id === module.operator)?.modules[module.module]} > L${module.level}`,
                    rating: `${module.moduleRating.padEnd(3)}/ ${module.improveChar.padEnd(3)}/ ${module.priority.padEnd(2)}`,
                }
            }));
            populateTable('moduleTable', ratedModules);
            const unleveledOperators = sortedOperators
                .filter(operator => userOps.some(op => op.op_id === operator.operator && op.elite !== 2))
                .slice(0, suggestionsLimit)
                .map(operator => ({
                id: operator.operator,
                values: {
                    operator: `${overallRatingDict[operator.operator].name}`,
                    tier: `${operator.tier.padEnd(2)}`,
                }
            }));
            populateTable('unleveledTable', unleveledOperators);
            const ratedOperators = sortedOperators
                .filter(operator => !userOps.some(op => op.op_id === operator.operator))
                .slice(0, suggestionsLimit)
                .map(operator => ({
                id: operator.operator,
                values: {
                    operator: `${overallRatingDict[operator.operator].name}`,
                    tier: `${operator.tier.padEnd(2)}`,
                }
            }));
            populateTable('unownedTable', ratedOperators);
        }
        catch (error) {
            console.error('An error occurred:', error);
        }
    }
});
